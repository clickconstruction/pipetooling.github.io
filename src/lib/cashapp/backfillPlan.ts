/**
 * The backfill plan (v2.3579): every Cash App and Mercury send the app knows, matched to the
 * payments recorded on pay reports, turned into the calls `npm run pay:backfill` makes through
 * the v2.3578 functions. Pure — the script supplies both sides and applies the actions.
 *
 * Cash App sends go through the reconcile matcher (rules a id · b amount · c split · e memo),
 * then this kernel's own rules:
 *   memo-group — a memo names a send bigger than the row ("1200 sent" on five rows): the rows
 *                for that person sharing the number, summing to the send, all link to it.
 *   memo-fill  — a memo names part of a payment ("500 advance" on $1,014.32; "Mercury 100 +
 *                445.39"): the gap is filled from one unmatched send — Cash App or Mercury — of
 *                exactly that amount, and the payment is split one row per send.
 *   near       — an unlinked payment for the person within the window whose amount is within
 *                `autocorrectUsd` of the send: link it and correct the amount to what was sent
 *                (the owner, 2026-09-17: "go with $5"). A gap beyond the band up to `reviewUsd`
 *                is left for a person with both figures — never recorded again.
 * Mercury sends match an unlinked payment for the alias-resolved person by amount within the
 * window, preferring a memo that says Mercury; within the band they correct too. A Mercury send
 * before the person's first report is counted, not listed.
 *
 * Only a note that says pay or advance becomes a `record` candidate; "Tolls", "Happy Birthday",
 * "Thank you" are left for a person. A payment is consumed at most once across every rule. A
 * send that is already a payment's source is done and skipped.
 */

import { matchCashAppTransactions, memoAmounts, type CashAppTxForMatch, type RecordedPaymentForMatch } from './matchCashAppTransactions'
import { classifyCashAppNote, type CashAppLane, type CashAppNoteKind } from './cashAppLane'
import { paySendMemo, PAY_SEND_AUTOCORRECT_USD, type PaySourceKind } from '../people/paySources'

export type BackfillSend = {
  id: string
  occurredDate: string // YYYY-MM-DD
  /** Positive: dollars sent. */
  amountSent: number
  note: string
  counterparty: string
  lane: CashAppLane
  personName: string | null
  altPersonNames?: readonly string[]
}

export type BackfillPayment = {
  id: string
  payStubId: string
  personName: string
  amount: number
  paidAt: string // YYYY-MM-DD
  memo: string | null
  sourceKind: PaySourceKind | null
  sourceId: string | null
}

export type MercurySend = {
  id: string
  postedDate: string // YYYY-MM-DD
  amountSent: number
  counterparty: string
  memo: string
  personName: string | null
  altPersonNames?: readonly string[]
}

export type SplitPart = { amount: number; source_kind: 'cashapp' | 'mercury'; source_id: string; memo: string }

export type BackfillAction =
  | { kind: 'link'; paymentId: string; payStubId: string; personName: string; sourceKind: 'cashapp' | 'mercury'; sourceId: string; rule: string; amountBefore: number; amountAfter: number; why: string }
  | { kind: 'split'; paymentId: string; payStubId: string; personName: string; total: number; parts: SplitPart[]; why: string }
  | { kind: 'lane'; txId: string; lane: 'expense' | 'before_records'; personName: string | null; amountSent: number; note: string; why: string }
  | { kind: 'record'; txId: string; personName: string; amountSent: number; occurredDate: string; note: string; noteKind: CashAppNoteKind }
  | { kind: 'review'; txId: string; personName: string | null; amountSent: number; occurredDate: string; note: string; why: string }
  | { kind: 'mercury_unmatched'; mercuryId: string; personName: string | null; amountSent: number; postedDate: string; memo: string; why: string }

export type BackfillPlan = {
  actions: BackfillAction[]
  counts: Record<BackfillAction['kind'], number>
  /** Sends skipped because a payment already carries them. */
  alreadyLinked: number
  /** Mercury sends before the person's first report or before `sinceYmd` — counted, not listed. */
  mercuryBeforeRecords: number
  /** Recorded payments before `sinceYmd` — left alone, neither matched nor counted. */
  paymentsBeforeSince: number
  sinceYmd: string | null
}

export type BuildBackfillPlanArgs = {
  sends: readonly BackfillSend[]
  payments: readonly BackfillPayment[]
  mercury?: readonly MercurySend[]
  firstReportStartByPerson?: Readonly<Record<string, string>>
  recordsBeginYmd?: string
  autocorrectUsd?: number
  /** A gap beyond the band but within this is reported with both figures instead of recorded again. */
  reviewUsd?: number
  windowDays?: number
  /** Tracking starts here (the owner, 2026-09-18: "only go back to April first"): sends before it are filed before_records, payments before it are neither matched nor counted, Mercury before it is only counted. */
  sinceYmd?: string
}

const DAY_MS = 86_400_000
const daysBetween = (a: string, b: string) => Math.abs((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / DAY_MS)
const r2 = (n: number) => Math.round(n * 100) / 100
const near = (a: number, b: number, tol = 0.011) => Math.abs(a - b) <= tol
const PAY_NOTE = /\b(week|hours?|pay|paid|remainder|remaining|rest|partial|advance|last|everything|sent|balance|owed)\b|^\s*\d[\d,.]*\s*$/i

/** Whether a send's note says it is pay or an advance — the only sends `record_pay_send` should see unasked. */
export function isPayLikeNote(note: string, noteKind: CashAppNoteKind): boolean {
  if (noteKind === 'expense') return false
  if (noteKind === 'advance') return true
  return PAY_NOTE.test(note.trim())
}

export function buildBackfillPlan(args: BuildBackfillPlanArgs): BackfillPlan {
  const band = args.autocorrectUsd ?? PAY_SEND_AUTOCORRECT_USD
  const reviewBand = args.reviewUsd ?? 100
  const windowDays = args.windowDays ?? 7
  const actions: BackfillAction[] = []
  const used = new Set<string>()
  const paymentById = new Map(args.payments.map((p) => [p.id, p]))
  const floorFor = (person: string | null) => (person ? args.firstReportStartByPerson?.[person] : undefined) ?? args.recordsBeginYmd

  // sends already carried by a payment are done
  const linkedSourceIds = new Set(args.payments.filter((p) => p.sourceId).map((p) => `${p.sourceKind}:${p.sourceId}`))
  let alreadyLinked = 0
  const sends = args.sends.filter((s) => {
    if (linkedSourceIds.has(`cashapp:${s.id}`)) {
      alreadyLinked++
      return false
    }
    return s.lane === 'review' || s.lane === 'recorded' || s.lane === 'advance'
  })
  const since = args.sinceYmd ?? null
  let mercuryBeforeRecords = 0
  const mercury = (args.mercury ?? []).filter((m) => {
    if (linkedSourceIds.has(`mercury:${m.id}`)) {
      alreadyLinked++
      return false
    }
    const floor = floorFor(m.personName)
    if ((floor && m.postedDate < floor) || (since && m.postedDate < since)) {
      mercuryBeforeRecords++
      return false
    }
    return true
  })
  const mercuryUsed = new Set<string>()
  // sends before tracking began are filed, not matched
  const beforeSince = since ? sends.filter((s) => s.occurredDate < since) : []
  const inScope = since ? sends.filter((s) => s.occurredDate >= since) : sends
  for (const s of beforeSince) actions.push({ kind: 'lane', txId: s.id, lane: 'before_records', personName: s.personName, amountSent: s.amountSent, note: s.note, why: `before tracking began (${since})` })

  // the matcher sees only payments without a source, on or after the tracking start
  const paymentsBeforeSince = since ? args.payments.filter((p) => p.paidAt < since).length : 0
  const unlinked = args.payments.filter((p) => !p.sourceId && (!since || p.paidAt >= since))
  const free = (p: BackfillPayment) => !used.has(p.id) && !p.sourceId
  const forMatch: RecordedPaymentForMatch[] = unlinked.map((p) => ({ id: p.id, personName: p.personName, amount: p.amount, paidAt: p.paidAt, memo: p.memo }))
  const txs: CashAppTxForMatch[] = inScope.map((s) => ({ id: s.id, occurredDate: s.occurredDate, amountSent: s.amountSent, note: s.note, personName: s.personName, altPersonNames: s.altPersonNames }))
  const { results } = matchCashAppTransactions(txs, forMatch, { windowDays, firstReportStartByPerson: args.firstReportStartByPerson, recordsBeginYmd: args.recordsBeginYmd })
  const sendById = new Map(inScope.map((s) => [s.id, s]))
  const peopleOf = (s: { personName: string | null; altPersonNames?: readonly string[] }) => (s.personName ? [s.personName, ...(s.altPersonNames ?? [])] : [])

  const link = (p: BackfillPayment, sourceKind: 'cashapp' | 'mercury', sourceId: string, rule: string, amountAfter: number, why: string) => {
    used.add(p.id)
    actions.push({ kind: 'link', paymentId: p.id, payStubId: p.payStubId, personName: p.personName, sourceKind, sourceId, rule, amountBefore: p.amount, amountAfter, why })
  }

  // rule e groups: one payment, the sends its memo lists
  const memoGroups = new Map<string, BackfillSend[]>()
  type Leftover = { send: BackfillSend; personName: string | null; noteKind: CashAppNoteKind; beforeRecords: boolean }
  const leftovers: Leftover[] = []

  for (const r of results) {
    const send = sendById.get(r.txId)!
    if (r.outcome === 'matched') {
      if (r.rule === 'memo') {
        const pid = r.paymentIds[0]!
        memoGroups.set(pid, [...(memoGroups.get(pid) ?? []), send])
        continue
      }
      const stubs = new Set(r.paymentIds.map((id) => paymentById.get(id)?.payStubId))
      if (r.rule === 'split' && stubs.size < r.paymentIds.length) {
        actions.push({ kind: 'review', txId: send.id, personName: r.personName, amountSent: send.amountSent, occurredDate: send.occurredDate, note: send.note, why: 'one send backs two rows on the same report — merge the rows by hand, then link' })
        continue
      }
      for (const pid of r.paymentIds) {
        const p = paymentById.get(pid)!
        link(p, 'cashapp', send.id, r.rule, p.amount, r.rule === 'split' ? `one send of ${send.amountSent.toFixed(2)} covering ${r.paymentIds.length} reports` : `rule ${r.rule}`)
      }
      continue
    }
    leftovers.push({ send, personName: r.personName, noteKind: r.noteKind, beforeRecords: r.outcome === 'before_records' })
  }

  // rule e → memo-group · split · memo-fill · review
  const takeLeftover = (pred: (l: Leftover) => boolean): Leftover | null => {
    const i = leftovers.findIndex(pred)
    if (i < 0) return null
    const [l] = leftovers.splice(i, 1)
    return l ?? null
  }
  for (const [pid, group] of memoGroups) {
    const p = paymentById.get(pid)!
    if (!free(p)) {
      for (const s of group) leftovers.push({ send: s, personName: p.personName, noteKind: classifyCashAppNote(s.note), beforeRecords: false })
      continue
    }
    const sum = r2(group.reduce((a, s) => a + s.amountSent, 0))
    const parts = (): SplitPart[] => group.map((s) => ({ amount: r2(s.amountSent), source_kind: 'cashapp', source_id: s.id, memo: paySendMemo('cashapp', s.id, s.note) }))

    if (near(sum, p.amount, 0.011 * group.length)) {
      if (group.length === 1) link(p, 'cashapp', group[0]!.id, 'memo', p.amount, 'the memo names this send')
      else {
        used.add(pid)
        actions.push({ kind: 'split', paymentId: pid, payStubId: p.payStubId, personName: p.personName, total: p.amount, parts: parts(), why: `the memo lists ${group.length} sends that sum to the payment` })
      }
      continue
    }

    // memo-group: one send bigger than the row, shared by the person's other rows ("1200 sent")
    if (group.length === 1 && group[0]!.amountSent > p.amount + 0.011) {
      const send = group[0]!
      const siblings = unlinked.filter((q) => q.id !== pid && free(q) && q.personName === p.personName && daysBetween(q.paidAt, send.occurredDate) <= 10 && memoAmounts(q.memo).some((n) => near(n, send.amountSent)))
      const all = [p, ...siblings]
      const total = r2(all.reduce((a, q) => a + q.amount, 0))
      if (near(total, send.amountSent, 0.011 * all.length) && new Set(all.map((q) => q.payStubId)).size === all.length) {
        for (const q of all) link(q, 'cashapp', send.id, 'memo-group', q.amount, `one send of ${send.amountSent.toFixed(2)} covering ${all.length} reports, each memo naming it`)
        continue
      }
      actions.push({ kind: 'review', txId: send.id, personName: p.personName, amountSent: send.amountSent, occurredDate: send.occurredDate, note: send.note, why: `the memo on a ${p.amount.toFixed(2)} payment names this ${send.amountSent.toFixed(2)} send, and the rows naming it sum to ${total.toFixed(2)}` })
      continue
    }

    // memo-fill: the listed sends cover part of the payment; one unmatched send of exactly the gap completes it
    if (sum < p.amount) {
      const gap = r2(p.amount - sum)
      const people = new Set([p.personName])
      const fill = takeLeftover((l) => !l.beforeRecords && near(l.send.amountSent, gap) && peopleOf(l.send).some((n) => people.has(n)) && daysBetween(l.send.occurredDate, p.paidAt) <= 10)
      if (fill) {
        used.add(pid)
        actions.push({ kind: 'split', paymentId: pid, payStubId: p.payStubId, personName: p.personName, total: p.amount, parts: [...parts(), { amount: gap, source_kind: 'cashapp', source_id: fill.send.id, memo: paySendMemo('cashapp', fill.send.id, fill.send.note) }], why: `the memo lists ${group.length} send(s); the ${gap.toFixed(2)} gap is the ${fill.send.occurredDate} send` })
        continue
      }
      const m = mercury.find((x) => !mercuryUsed.has(x.id) && near(x.amountSent, gap) && peopleOf(x).some((n) => people.has(n)) && daysBetween(x.postedDate, p.paidAt) <= 10)
      if (m) {
        mercuryUsed.add(m.id)
        used.add(pid)
        actions.push({ kind: 'split', paymentId: pid, payStubId: p.payStubId, personName: p.personName, total: p.amount, parts: [...parts(), { amount: gap, source_kind: 'mercury', source_id: m.id, memo: paySendMemo('mercury', m.id, m.memo) }], why: `the memo lists ${group.length} send(s); the ${gap.toFixed(2)} gap is the ${m.postedDate} Mercury send` })
        continue
      }
    }
    for (const s of group) actions.push({ kind: 'review', txId: s.id, personName: p.personName, amountSent: s.amountSent, occurredDate: s.occurredDate, note: s.note, why: `the memo on a ${p.amount.toFixed(2)} payment lists it, but the listed sends (${sum.toFixed(2)}) do not sum to the payment` })
  }

  // near → correct · beyond the band → review · else lane / record / review
  for (const { send, personName, noteKind, beforeRecords } of leftovers) {
    if (personName && !beforeRecords && noteKind !== 'expense') {
      let hit: BackfillPayment | null = null
      for (const person of peopleOf(send)) {
        const cands = unlinked
          .filter((p) => free(p) && p.personName === person && daysBetween(p.paidAt, send.occurredDate) <= windowDays && Math.abs(r2(p.amount - send.amountSent)) <= reviewBand)
          .sort((x, y) => Math.abs(x.amount - send.amountSent) - Math.abs(y.amount - send.amountSent) || daysBetween(x.paidAt, send.occurredDate) - daysBetween(y.paidAt, send.occurredDate))
        if (cands[0]) {
          hit = cands[0]
          break
        }
      }
      if (hit) {
        const gap = r2(hit.amount - send.amountSent)
        if (Math.abs(gap) <= band) {
          link(hit, 'cashapp', send.id, 'near', r2(send.amountSent), `recorded ${hit.amount.toFixed(2)}, sent ${send.amountSent.toFixed(2)} — within $${band}, corrected to the send`)
        } else {
          actions.push({ kind: 'review', txId: send.id, personName, amountSent: send.amountSent, occurredDate: send.occurredDate, note: send.note, why: `recorded ${hit.amount.toFixed(2)} on ${hit.paidAt} (payment ${hit.id.slice(0, 8)}), sent ${send.amountSent.toFixed(2)} — $${Math.abs(gap).toFixed(2)} apart, beyond $${band}; fix the row, then link` })
        }
        continue
      }
    }
    if (beforeRecords) {
      actions.push({ kind: 'lane', txId: send.id, lane: 'before_records', personName, amountSent: send.amountSent, note: send.note, why: 'before the first pay report' })
    } else if (noteKind === 'expense') {
      actions.push({ kind: 'lane', txId: send.id, lane: 'expense', personName, amountSent: send.amountSent, note: send.note, why: 'the note says expense' })
    } else if (!personName) {
      actions.push({ kind: 'review', txId: send.id, personName: null, amountSent: send.amountSent, occurredDate: send.occurredDate, note: send.note, why: 'no alias for this counterparty — name them in the reconcile modal' })
    } else if (isPayLikeNote(send.note, noteKind)) {
      // the first week after records begin: a "last week" send pays the week before the first report
      const floor = floorFor(personName)
      if (floor && daysBetween(send.occurredDate, floor) < 7 && send.occurredDate >= floor) {
        actions.push({ kind: 'review', txId: send.id, personName, amountSent: send.amountSent, occurredDate: send.occurredDate, note: send.note, why: `within the first week of records (first report ${floor}) — probably pays the week before records began; file as before_records or record by hand` })
      } else {
        actions.push({ kind: 'record', txId: send.id, personName, amountSent: send.amountSent, occurredDate: send.occurredDate, note: send.note, noteKind })
      }
    } else {
      actions.push({ kind: 'review', txId: send.id, personName, amountSent: send.amountSent, occurredDate: send.occurredDate, note: send.note, why: 'the note does not say pay or advance — decide in the reconcile modal' })
    }
  }

  // Mercury
  for (const m of mercury) {
    if (mercuryUsed.has(m.id)) continue
    if (!m.personName) {
      actions.push({ kind: 'mercury_unmatched', mercuryId: m.id, personName: null, amountSent: m.amountSent, postedDate: m.postedDate, memo: m.memo, why: `no alias for "${m.counterparty}"` })
      continue
    }
    const people = peopleOf(m)
    let hit: BackfillPayment | null = null
    for (const person of people) {
      const cands = unlinked
        .filter((p) => free(p) && p.personName === person && daysBetween(p.paidAt, m.postedDate) <= windowDays && Math.abs(r2(p.amount - m.amountSent)) <= band)
        .sort((x, y) => {
          const xm = /mercury|ach/i.test(x.memo ?? '') ? 0 : 1
          const ym = /mercury|ach/i.test(y.memo ?? '') ? 0 : 1
          return xm - ym || Math.abs(x.amount - m.amountSent) - Math.abs(y.amount - m.amountSent) || daysBetween(x.paidAt, m.postedDate) - daysBetween(y.paidAt, m.postedDate)
        })
      if (cands[0]) {
        hit = cands[0]
        break
      }
    }
    if (!hit) {
      actions.push({ kind: 'mercury_unmatched', mercuryId: m.id, personName: m.personName, amountSent: m.amountSent, postedDate: m.postedDate, memo: m.memo, why: `no unlinked payment for ${people.join(' / ')} within ${windowDays} days and $${band}` })
      continue
    }
    const exact = near(hit.amount, m.amountSent)
    link(hit, 'mercury', m.id, exact ? 'mercury' : 'mercury-near', exact ? hit.amount : r2(m.amountSent), exact ? `Mercury ${m.postedDate} ${m.amountSent.toFixed(2)} to ${m.counterparty}` : `recorded ${hit.amount.toFixed(2)}, Mercury sent ${m.amountSent.toFixed(2)} — within $${band}, corrected`)
  }

  const counts: BackfillPlan['counts'] = { link: 0, split: 0, lane: 0, record: 0, review: 0, mercury_unmatched: 0 }
  for (const a of actions) counts[a.kind]++
  return { actions, counts, alreadyLinked, mercuryBeforeRecords, paymentsBeforeSince, sinceYmd: since }
}

/** The plan as Markdown — what the owner reads before `--apply`. */
export function renderBackfillPlan(plan: BackfillPlan, opts: { title?: string } = {}): string {
  const out: string[] = []
  const money = (n: number) => `$${n.toFixed(2)}`
  out.push(`# ${opts.title ?? 'Pay backfill plan'}`, '')
  if (plan.sinceYmd) out.push(`Tracking starts ${plan.sinceYmd}: sends before it are filed as before records, payments before it (${plan.paymentsBeforeSince}) are neither matched nor counted.`, '')
  out.push(`links ${plan.counts.link} · splits ${plan.counts.split} · lanes ${plan.counts.lane} · to record ${plan.counts.record} · review ${plan.counts.review} · Mercury unmatched ${plan.counts.mercury_unmatched} · already linked ${plan.alreadyLinked} · Mercury before records ${plan.mercuryBeforeRecords}`, '')
  const section = (title: string, rows: string[]) => {
    if (rows.length === 0) return
    out.push(`## ${title} (${rows.length})`, '', ...rows, '')
  }
  const links = plan.actions.filter((a): a is Extract<BackfillAction, { kind: 'link' }> => a.kind === 'link')
  section('Link', links.map((a) => `- ${a.personName} · payment ${a.paymentId.slice(0, 8)} ${money(a.amountBefore)}${a.amountAfter !== a.amountBefore ? ` → ${money(a.amountAfter)}` : ''} ← ${a.sourceKind} ${a.sourceId} · ${a.rule} · ${a.why}`))
  const splits = plan.actions.filter((a): a is Extract<BackfillAction, { kind: 'split' }> => a.kind === 'split')
  section('Split', splits.map((a) => `- ${a.personName} · payment ${a.paymentId.slice(0, 8)} ${money(a.total)} → ${a.parts.map((p) => `${money(p.amount)} ${p.source_kind} ${p.source_id}`).join(' + ')} · ${a.why}`))
  const lanes = plan.actions.filter((a): a is Extract<BackfillAction, { kind: 'lane' }> => a.kind === 'lane')
  section('File', lanes.map((a) => `- ${a.txId} ${money(a.amountSent)} "${a.note}" ${a.personName ?? '(unknown)'} → ${a.lane} · ${a.why}`))
  const records = plan.actions.filter((a): a is Extract<BackfillAction, { kind: 'record' }> => a.kind === 'record')
  section('To record (pay or advance with no recorded payment — `--record-review` plans these through record_pay_send)', records.map((a) => `- ${a.personName} · ${a.occurredDate} ${money(a.amountSent)} "${a.note}" (${a.noteKind}) · ${a.txId}`))
  const reviews = plan.actions.filter((a): a is Extract<BackfillAction, { kind: 'review' }> => a.kind === 'review')
  section('Left for a person', reviews.map((a) => `- ${a.personName ?? '(unknown)'} · ${a.occurredDate} ${money(a.amountSent)} "${a.note}" · ${a.txId} · ${a.why}`))
  const mu = plan.actions.filter((a): a is Extract<BackfillAction, { kind: 'mercury_unmatched' }> => a.kind === 'mercury_unmatched')
  section('Mercury sends with no payment to link', mu.map((a) => `- ${a.personName ?? '(unknown)'} · ${a.postedDate} ${money(a.amountSent)} "${a.memo}" · ${a.mercuryId.slice(0, 8)} · ${a.why}`))
  return out.join('\n')
}

// ── by person (v2.3581) ──────────────────────────────────────────────────────────────────────────

export type PersonStanding = {
  personName: string
  /** What the app says is still owed (net − paid over open reports), from pay_position. */
  open: number
  /** Recorded payments no send backs after every rule — client-direct memos excluded. */
  unverified: { count: number; amount: number; rows: Array<{ paymentId: string; paidAt: string; amount: number; memo: string | null }> }
  /** Sends whose note says pay or advance and that no payment records. */
  unrecorded: { count: number; amount: number }
  /** Recorded minus sent over the corrected links: positive means the app recorded more than went out. */
  corrections: number
  /** Sends left for a person, with their reasons. */
  review: { count: number; amount: number }
  /** Payments linked or split by the plan (already-linked ones included). */
  linked: { count: number; amount: number }
  /** open + unverified + corrections − unrecorded: positive still owed, negative ahead. */
  standing: number
}

const CLIENT_DIRECT = /client/i

/**
 * Where each person stands once the plan is applied: the app's open balance, corrected by what
 * was recorded but never sent, what was sent but never recorded, and the amount corrections.
 * Positive is still owed; negative is ahead. Pure.
 */
export function summarizeBackfillByPerson(args: {
  plan: BackfillPlan
  payments: readonly BackfillPayment[]
  openByPerson: Readonly<Record<string, number>>
}): PersonStanding[] {
  const consumed = new Set<string>()
  for (const a of args.plan.actions) if (a.kind === 'link' || a.kind === 'split') consumed.add(a.paymentId)
  const since = args.plan.sinceYmd
  const payments = since ? args.payments.filter((p) => p.paidAt >= since) : args.payments
  const people = new Set<string>([...Object.keys(args.openByPerson), ...payments.map((p) => p.personName)])
  for (const a of args.plan.actions) if ('personName' in a && a.personName) people.add(a.personName)
  const out: PersonStanding[] = []
  for (const person of [...people].sort()) {
    const mine = payments.filter((p) => p.personName === person)
    const unverifiedRows = mine.filter((p) => !p.sourceId && !consumed.has(p.id) && !CLIENT_DIRECT.test(p.memo ?? '')).map((p) => ({ paymentId: p.id, paidAt: p.paidAt, amount: p.amount, memo: p.memo }))
    const links = args.plan.actions.filter((a): a is Extract<BackfillAction, { kind: 'link' }> => a.kind === 'link' && a.personName === person)
    const splits = args.plan.actions.filter((a): a is Extract<BackfillAction, { kind: 'split' }> => a.kind === 'split' && a.personName === person)
    const records = args.plan.actions.filter((a): a is Extract<BackfillAction, { kind: 'record' }> => a.kind === 'record' && a.personName === person)
    const reviews = args.plan.actions.filter((a): a is Extract<BackfillAction, { kind: 'review' }> => a.kind === 'review' && a.personName === person)
    const sum = (xs: readonly number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100
    const already = mine.filter((p) => p.sourceId)
    const unverified = { count: unverifiedRows.length, amount: sum(unverifiedRows.map((r) => r.amount)), rows: unverifiedRows }
    const unrecorded = { count: records.length, amount: sum(records.map((r) => r.amountSent)) }
    const corrections = sum(links.map((l) => l.amountBefore - l.amountAfter))
    const review = { count: reviews.length, amount: sum(reviews.map((r) => r.amountSent)) }
    const linked = { count: links.length + splits.length + already.length, amount: sum([...links.map((l) => l.amountAfter), ...splits.map((s) => s.total), ...already.map((p) => p.amount)]) }
    const open = Math.round((args.openByPerson[person] ?? 0) * 100) / 100
    const standing = Math.round((open + unverified.amount + corrections - unrecorded.amount) * 100) / 100
    if (open === 0 && mine.length === 0 && records.length === 0 && reviews.length === 0) continue
    out.push({ personName: person, open, unverified, unrecorded, corrections, review, linked, standing })
  }
  return out
}

/** The standings as a Markdown table plus the unverified rows per person — what the owner reads. */
export function renderByPerson(rows: readonly PersonStanding[]): string {
  const money = (n: number) => (n < 0 ? `−$${Math.abs(n).toFixed(2)}` : `$${n.toFixed(2)}`)
  const out: string[] = ['## Where each person stands (after the plan)', '']
  out.push('Positive = still owed; negative = ahead. Standing = app open (reports ending on or after the tracking start) + recorded-but-unbacked + corrections − sent-but-unrecorded. Review sends are not counted either way.', '')
  out.push('| Person | App open | Recorded, no send | Sent, not recorded | Corrections | Review | Linked | Standing |', '|---|---:|---:|---:|---:|---:|---:|---:|')
  for (const r of rows) {
    out.push(`| ${r.personName} | ${money(r.open)} | ${money(r.unverified.amount)} (${r.unverified.count}) | ${money(r.unrecorded.amount)} (${r.unrecorded.count}) | ${money(r.corrections)} | ${money(r.review.amount)} (${r.review.count}) | ${money(r.linked.amount)} (${r.linked.count}) | **${money(r.standing)}** |`)
  }
  const withRows = rows.filter((r) => r.unverified.count > 0)
  if (withRows.length) {
    out.push('', '### Recorded payments no send backs', '')
    for (const r of withRows) {
      out.push(`- **${r.personName}** (${r.unverified.count}, ${money(r.unverified.amount)})`)
      for (const p of r.unverified.rows.sort((a, b) => a.paidAt.localeCompare(b.paidAt))) out.push(`  - ${p.paidAt} ${money(p.amount)} "${p.memo ?? ''}" · ${p.paymentId.slice(0, 8)}`)
    }
  }
  return out.join('\n')
}

/**
 * A counterparty with no alias whose first name is exactly one person's first name on the pay
 * reports — "Trace Whites" → Trace, "Juan M Farias Jr" → Juan. A person recorded with an initial
 * ("Michael A", "Julia W") also needs the counterparty's surname to start with it, so "Michael
 * Zinna" never lands on Michael A. Null when nothing or more than one person fits; nicknames
 * ("Mike Z" for Michael Zinna, "Jesse" for Jessie Lopez) stay a person's alias to add.
 */
export function guessPersonByName(counterparty: string, personNames: readonly string[]): string | null {
  const tokens = counterparty.trim().split(/\s+/).filter(Boolean)
  const first = tokens[0]?.toLowerCase()
  if (!first) return null
  const rest = tokens.slice(1).map((t) => t.toLowerCase())
  const hits = personNames.filter((name) => {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts[0]?.toLowerCase() !== first) return false
    const initial = parts[1]
    if (initial && initial.replace('.', '').length === 1) return rest.some((t) => t.startsWith(initial.replace('.', '').toLowerCase()))
    return parts.length === 1
  })
  return hits.length === 1 ? hits[0]! : null
}
