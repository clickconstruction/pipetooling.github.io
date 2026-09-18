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
  /** Mercury sends before the person's first report — counted, not listed. */
  mercuryBeforeRecords: number
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
  let mercuryBeforeRecords = 0
  const mercury = (args.mercury ?? []).filter((m) => {
    if (linkedSourceIds.has(`mercury:${m.id}`)) {
      alreadyLinked++
      return false
    }
    const floor = floorFor(m.personName)
    if (floor && m.postedDate < floor) {
      mercuryBeforeRecords++
      return false
    }
    return true
  })
  const mercuryUsed = new Set<string>()

  // the matcher sees only payments without a source
  const unlinked = args.payments.filter((p) => !p.sourceId)
  const free = (p: BackfillPayment) => !used.has(p.id) && !p.sourceId
  const forMatch: RecordedPaymentForMatch[] = unlinked.map((p) => ({ id: p.id, personName: p.personName, amount: p.amount, paidAt: p.paidAt, memo: p.memo }))
  const txs: CashAppTxForMatch[] = sends.map((s) => ({ id: s.id, occurredDate: s.occurredDate, amountSent: s.amountSent, note: s.note, personName: s.personName, altPersonNames: s.altPersonNames }))
  const { results } = matchCashAppTransactions(txs, forMatch, { windowDays, firstReportStartByPerson: args.firstReportStartByPerson, recordsBeginYmd: args.recordsBeginYmd })
  const sendById = new Map(sends.map((s) => [s.id, s]))
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
  return { actions, counts, alreadyLinked, mercuryBeforeRecords }
}

/** The plan as Markdown — what the owner reads before `--apply`. */
export function renderBackfillPlan(plan: BackfillPlan, opts: { title?: string } = {}): string {
  const out: string[] = []
  const money = (n: number) => `$${n.toFixed(2)}`
  out.push(`# ${opts.title ?? 'Pay backfill plan'}`, '')
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
