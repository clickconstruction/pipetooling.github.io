/**
 * The lien side of the legal packet's Paper section (punch list #41, PR 1):
 *
 *   - WHERE EACH JOB STANDS — the job's Chapter 53 timeline, the same kernel
 *     the Lien desk and the Lien window draw (`buildLienTimelineFromWindow`),
 *     fed from the packet's own rows: the approved clock sessions folded into
 *     work months, the job's filings, the job row's retainage facts.
 *   - THE PAPER THAT WENT OUT — the filings grouped by envelope: one row per
 *     packet (a run's notice, a notice recorded by hand, a combined notice over
 *     several jobs — v2.3770 / v2.3777) with every job's share, how it went,
 *     the copy, and the months as printed with *as information* where the
 *     month's window had already closed when the paper went out (counsel,
 *     v2.3745). An affidavit or a release is its own envelope.
 *   - UNDER A NOTICE (PR 1b) — the answers the paper asked for, read off the
 *     desk items that sent it: the owner's call and counsel's pile (#33 PR 3),
 *     letter two's clock (#33 PR 2), the GC's written okay to pay Click direct.
 *     A letter two is its own envelope, named as one, with no band of its own.
 *
 * Pure: no React, no supabase. The office desk, the firm's portal and the
 * packet print all read these, so the three never disagree on a date.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { JobLienFilingRow } from '../jobs/lienDeadlines'
import { noticeDeadlineForMonth } from '../jobs/lienDeadlines'
import { buildLienTimelineFromWindow } from '../jobs/lienTimelineDesk'
import type { LienTimeline } from '../jobs/lienTimeline'
import type { JobWorkMonths, WorkMonth } from '../jobs/forecastWorkMonths'
import { workMonthLabel, workMonthShort } from '../jobs/forecastWorkMonths'
import { BY_HAND_METHODS } from '../jobs/lienNoticeByHand'
import { normalizeDocumentUrl } from '../jobs/lienFilingDocumentLink'
import { parsePaymentBond } from '../jobs/lienDeskRetainage'
import type { LienDeskItemRow } from '../jobs/lienDesk'
import { parseLienNoticeSentFacts } from '../jobs/lienNoticeDraft'
import { affidavitPileFor, parseOwnerCall, reservationHoldEndsOn, type AffidavitPile, type OwnerCall } from '../jobs/lienOwnerCall'
import { LETTER_TWO_FROM_DAY, LETTER_TWO_NONE, letterTwoKindLabel, letterTwoStatus, type LetterTwoKind, type LetterTwoStatus } from '../jobs/lienLetterTwo'

// ---------------------------------------------------------------------------
// Where each job stands
// ---------------------------------------------------------------------------

export type LegalPaperSessionLike = { jobId: string; workDate: string; clockedInAt: string; clockedOutAt: string | null; approved: boolean; disqualified: boolean }

function hoursBetween(inIso: string, outIso: string | null): number {
  if (!outIso) return 0
  const ms = new Date(outIso).getTime() - new Date(inIso).getTime()
  return ms > 0 ? ms / 3_600_000 : 0
}

/**
 * The forecast's work months, folded from the packet's sessions — approved
 * and not rejected or revoked, the evidence rule the packet already applies.
 * The timeline reads only each month's key (the notice is dated by the
 * kernel), so weeks and people stay empty here. Null when there are none.
 */
export function workMonthsFromSessions(jobId: string, sessions: ReadonlyArray<LegalPaperSessionLike>, opts: { isSub: boolean; propertyKind: string }): JobWorkMonths | null {
  const byMonth = new Map<string, { hours: number; days: Set<string>; count: number }>()
  for (const s of sessions) {
    if (s.jobId !== jobId || s.disqualified || !s.approved) continue
    const key = (s.workDate ?? '').slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(key)) continue
    const m = byMonth.get(key) ?? { hours: 0, days: new Set<string>(), count: 0 }
    m.hours += hoursBetween(s.clockedInAt, s.clockedOutAt)
    m.days.add(s.workDate.slice(0, 10))
    m.count += 1
    byMonth.set(key, m)
  }
  if (byMonth.size === 0) return null
  const keys = [...byMonth.keys()].sort()
  const totalHours = keys.reduce((sum, k) => sum + (byMonth.get(k)?.hours ?? 0), 0)
  const months: WorkMonth[] = keys.map((key) => {
    const m = byMonth.get(key)!
    return { key, label: workMonthLabel(key), weeks: [], people: [], hours: Math.round(m.hours * 10) / 10, pendingHours: 0, dayCount: m.days.size, hoursShare: totalHours > 0 ? Math.round((m.hours / totalHours) * 100) : 0, notice: null }
  })
  return {
    jobId,
    role: opts.isSub ? 'sub' : 'direct',
    propertyKind: opts.propertyKind,
    months,
    totalHours: Math.round(totalHours * 10) / 10,
    sessionCount: keys.reduce((n, k) => n + (byMonth.get(k)?.count ?? 0), 0),
    pendingSessions: 0,
    lastMonthKey: keys[keys.length - 1] ?? '',
    affidavitDue: '',
  }
}

export type LegalJobTimeline = {
  jobId: string
  jobLabel: string
  /** 'YYYY-MM-DD' of the last approved session, else the ledger's last_work_date; null when neither. */
  lastWorkYmd: string | null
  openBalance: number
  timeline: LienTimeline
  /** The § 53.057 facts the job row carries — `contract ended Nov 30 · retainage held $2,400 · payment bond on the project`; '' when the row holds none. */
  retainageWords: string
}

type LienJobRowLike = Pick<JobWithDetails, 'id' | 'created_at' | 'last_work_date'> & { lien_contract_ended_on?: string | null; lien_retainage_held?: number | null; lien_payment_bond?: string | null }

/** `Nov 30` / `Nov 30, 2027` — the timeline's own short date, kept local so the print needs no React. */
function shortDay(ymd: string, todayYmd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const base = `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`
  return m[1] === todayYmd.slice(0, 4) ? base : `${base}, ${m[1]}`
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export function retainageWordsFor(job: Pick<LienJobRowLike, 'lien_contract_ended_on' | 'lien_retainage_held' | 'lien_payment_bond'>, todayYmd: string): string {
  const parts: string[] = []
  if (job.lien_contract_ended_on) parts.push(`contract ended ${shortDay(job.lien_contract_ended_on, todayYmd)}`)
  if (typeof job.lien_retainage_held === 'number' && job.lien_retainage_held > 0) parts.push(`retainage held ${money(job.lien_retainage_held)}`)
  const bond = parsePaymentBond(job.lien_payment_bond)
  if (bond === 'yes') parts.push('payment bond on the project')
  else if (bond === 'no') parts.push('no payment bond')
  return parts.join(' · ')
}

export function buildLegalJobTimelines(args: {
  jobs: ReadonlyArray<LienJobRowLike>
  labelOf: (jobId: string) => string
  openBalanceOf: (jobId: string) => number
  lastWorkOf: (jobId: string) => string | null
  sessions: ReadonlyArray<LegalPaperSessionLike>
  filings: ReadonlyArray<JobLienFilingRow>
  propertyKind: string
  isSub: boolean
  todayYmd: string
}): LegalJobTimeline[] {
  return args.jobs.map((j) => {
    const openBalance = args.openBalanceOf(j.id)
    const timeline = buildLienTimelineFromWindow({
      workMonths: workMonthsFromSessions(j.id, args.sessions, { isSub: args.isSub, propertyKind: args.propertyKind }),
      filings: args.filings,
      job: { id: j.id, created_at: j.created_at ?? null, last_work_date: j.last_work_date ?? null, lien_contract_ended_on: j.lien_contract_ended_on ?? null },
      isSub: args.isSub,
      propertyKind: args.propertyKind,
      openBalance,
      todayYmd: args.todayYmd,
    })
    return { jobId: j.id, jobLabel: args.labelOf(j.id), lastWorkYmd: args.lastWorkOf(j.id), openBalance, timeline, retainageWords: retainageWordsFor(j, args.todayYmd) }
  })
}

// ---------------------------------------------------------------------------
// The paper that went out
// ---------------------------------------------------------------------------

export type LegalEnvelopeSend = { recipient: string; recipientLabel: string; method: string; methodLabel: string; tracking: string; sentOn: string }
export type LegalEnvelopeMonth = { key: string; label: string; asInformation: boolean }
export type LegalEnvelopeShare = { jobId: string; jobLabel: string; amount: number }

export type LegalEnvelope = {
  /** The packet id, or the filing id when the row has none. */
  key: string
  /** A, B, C … in the order the paper went out. */
  letter: string
  kind: string
  kindLabel: string
  /** The day it went out: a send's date, else filed_at, else the record's day. */
  wentOutYmd: string | null
  byHand: boolean
  sends: LegalEnvelopeSend[]
  /** The figure on the paper — `printed_claim` when the paper's total differs from a job's share, else the shares summed. */
  claim: number
  shares: LegalEnvelopeShare[]
  months: LegalEnvelopeMonth[]
  filedYmd: string | null
  servedYmd: string | null
  serveDueYmd: string | null
  county: string
  recordingNumber: string
  documentUrl: string
  documentNote: string
  /** Every filing row in the envelope — the desk items that sent it point here (`sent_filing_id`). */
  filingIds: string[]
  /** This paper is a letter two (#33 PR 2) — which letter; null for a first packet, an affidavit or a release. */
  letterTwo: { kind: LetterTwoKind } | null
  /** The band under a first-packet notice (PR 1b); null until `attachEnvelopeAnswers` runs, and on every other kind. */
  answers: LegalEnvelopeAnswers | null
}

const RECIPIENT_LABEL: Record<string, string> = { owner: 'owner of record', original_contractor: 'original contractor' }
const KIND_LABEL: Record<string, string> = { notice_53_056: '§ 53.056 notice', retainage_53_057: '§ 53.057 retainage notice', affidavit: "Mechanic's lien affidavit", release_of_record: 'Release of record' }

function ymdOf(iso: string | null | undefined): string | null {
  if (!iso) return null
  const s = String(iso)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}

function parseSends(raw: unknown): LegalEnvelopeSend[] {
  if (!Array.isArray(raw)) return []
  const out: LegalEnvelopeSend[] = []
  for (const s of raw) {
    if (!s || typeof s !== 'object') continue
    const r = s as Record<string, unknown>
    const recipient = typeof r.recipient === 'string' ? r.recipient : ''
    const method = typeof r.method === 'string' ? r.method : ''
    out.push({
      recipient,
      recipientLabel: RECIPIENT_LABEL[recipient] ?? recipient,
      method,
      methodLabel: BY_HAND_METHODS.find((m) => m.key === method)?.label ?? method,
      tracking: typeof r.tracking === 'string' ? r.tracking.trim() : '',
      sentOn: typeof r.sent_on === 'string' ? r.sent_on.slice(0, 10) : '',
    })
  }
  return out
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Filings → envelopes. Rows sharing a `packet_id` are one paper (one row per
 * covered job, v2.3770 / v2.3777); a row without one is its own. Only live
 * rows belong (the caller has already dropped voided ones). Ordered by the day
 * the paper went out, oldest first, lettered in that order.
 */
export function buildLegalEnvelopes(filings: ReadonlyArray<JobLienFilingRow>, opts: { labelOf: (jobId: string) => string; propertyKind: string }): LegalEnvelope[] {
  type Group = { key: string; rows: JobLienFilingRow[] }
  const groups = new Map<string, Group>()
  for (const f of filings) {
    const packet = (f as unknown as { packet_id?: string | null }).packet_id
    const key = packet && String(packet).trim() ? `p:${packet}` : `f:${f.id}`
    const g = groups.get(key) ?? { key, rows: [] }
    g.rows.push(f)
    groups.set(key, g)
  }
  const envelopes: LegalEnvelope[] = []
  for (const g of groups.values()) {
    const first = g.rows.slice().sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
    if (!first) continue
    const sends = parseSends(first.sends)
    const wentOutYmd = sends.map((s) => s.sentOn).filter(Boolean).sort()[0] ?? ymdOf(first.filed_at) ?? ymdOf(first.created_at)
    const shares: LegalEnvelopeShare[] = g.rows
      .map((r) => ({ jobId: r.job_id, jobLabel: opts.labelOf(r.job_id), amount: Number(r.amount ?? 0) }))
      .sort((a, b) => a.jobLabel.localeCompare(b.jobLabel, undefined, { numeric: true }))
    const printed = (first as unknown as { printed_claim?: number | null }).printed_claim
    const claim = typeof printed === 'number' && printed > 0 ? printed : shares.reduce((s, x) => s + x.amount, 0)
    const monthKeys = [...new Set(g.rows.flatMap((r) => r.months_covered ?? []))].sort()
    const months: LegalEnvelopeMonth[] = monthKeys.map((key) => ({
      key,
      label: workMonthShort(key),
      asInformation: first.kind === 'notice_53_056' && wentOutYmd != null && noticeDeadlineForMonth(`${key}-01`, opts.propertyKind) < wentOutYmd,
    }))
    const doc = first as unknown as { document_url?: string | null; document_note?: string | null; by_hand?: boolean | null }
    envelopes.push({
      key: g.key,
      letter: '',
      kind: first.kind,
      kindLabel: KIND_LABEL[first.kind] ?? first.kind,
      wentOutYmd,
      byHand: Boolean(doc.by_hand),
      sends,
      claim: Math.round(claim * 100) / 100,
      shares,
      months,
      filedYmd: ymdOf(first.filed_at),
      servedYmd: ymdOf(first.served_at),
      serveDueYmd: first.serve_due,
      county: first.county ?? '',
      recordingNumber: first.recording_number ?? '',
      documentUrl: normalizeDocumentUrl(doc.document_url),
      documentNote: (doc.document_note ?? '').trim(),
      filingIds: g.rows.map((r) => r.id),
      letterTwo: null,
      answers: null,
    })
  }
  envelopes.sort((a, b) => (a.wentOutYmd ?? '9999').localeCompare(b.wentOutYmd ?? '9999') || a.key.localeCompare(b.key))
  return envelopes.map((e, i) => ({ ...e, letter: LETTERS[i] ?? '?' }))
}

/** `April (as information), June (as information), July, August` — the months line as the paper printed it. */
export function envelopeMonthsWords(e: Pick<LegalEnvelope, 'months'>): string {
  return e.months.map((m) => (m.asInformation ? `${m.label} (as information)` : m.label)).join(', ')
}

/** `Sep 22 · by hand · certified mail 9407 …` — how the paper went, one line. */
export function envelopeWentOutWords(e: Pick<LegalEnvelope, 'wentOutYmd' | 'byHand' | 'sends' | 'kind' | 'filedYmd' | 'servedYmd' | 'serveDueYmd'>, todayYmd: string): string {
  const parts: string[] = []
  if (e.kind === 'affidavit' || e.kind === 'release_of_record') {
    parts.push(e.filedYmd ? `filed ${shortDay(e.filedYmd, todayYmd)}` : 'not filed')
    if (e.kind === 'affidavit' && e.filedYmd) parts.push(e.servedYmd ? `served ${shortDay(e.servedYmd, todayYmd)}` : e.serveDueYmd ? `serve by ${shortDay(e.serveDueYmd, todayYmd)}` : 'not served')
  } else {
    parts.push(e.wentOutYmd ? shortDay(e.wentOutYmd, todayYmd) : 'not sent')
    if (e.byHand) parts.push('by hand')
  }
  const methods = [...new Set(e.sends.map((s) => s.methodLabel).filter(Boolean))]
  if (methods.length) parts.push(methods.join(' + ').toLowerCase())
  const tracking = [...new Set(e.sends.map((s) => s.tracking).filter(Boolean))]
  if (tracking.length) parts.push(tracking.join(', '))
  return parts.join(' · ')
}

/** `273 $17,585 · 858 $6,952 · 866 $4,450` — every job's share; one job reads just its label when the paper is its own. */
export function envelopeSharesWords(e: Pick<LegalEnvelope, 'shares' | 'claim'>, formatMoney: (n: number) => string = money): string {
  const only = e.shares[0]
  if (e.shares.length === 1 && only) return only.jobLabel
  return e.shares.map((s) => `${s.jobLabel} ${formatMoney(s.amount)}`).join(' · ')
}

// ---------------------------------------------------------------------------
// Under a notice: the owner's answers, letter two, the GC's okay (PR 1b)
// ---------------------------------------------------------------------------

/**
 * A notice's desk item as the band reads it: the desk's own rows, or the
 * portal's items shaped down to the three sent-notice facts in `fields`
 * (`letterTwo`, `gcAuthorizedDirectPay`, `ownerCall` — the office's other
 * draft fields never leave).
 */
export type LegalDeskItemLike = Pick<LienDeskItemRow, 'id' | 'job_id' | 'kind' | 'status' | 'sent_at' | 'sent_filing_id' | 'fields' | 'created_at' | 'voided_at'>

export type LegalEnvelopeAnswers = {
  /** The latest owner's call recorded on the paper's items; null until the owner phones. */
  ownerCall: OwnerCall | null
  pile: AffidavitPile | null
  /** The § 53.101 hold's end when the owner named their contract's completion; '' otherwise. */
  holdEndsOn: string
  gcAuthorized: { at: string; name: string; note: string } | null
  /** Letter two's clock per job the paper covered — `none` on a job whose first packet is a later paper. */
  letterTwo: Array<{ jobId: string; jobLabel: string; status: LetterTwoStatus }>
}

/**
 * Reads the answers off each § 53.056 envelope's desk items: the items whose
 * `sent_filing_id` is one of the envelope's rows. One of them carrying
 * `letterTwo` makes the envelope a letter two (named, no band). Otherwise the
 * band: the latest owner's call across the items, the GC's okay, and letter
 * two's clock per covered job — the clock belongs to the job's first packet,
 * so an older notice on the job reads `none`. Affidavits and releases pass
 * through untouched.
 */
export function attachEnvelopeAnswers(envelopes: ReadonlyArray<LegalEnvelope>, args: { items: ReadonlyArray<LegalDeskItemLike>; openBalanceOf: (jobId: string) => number; todayYmd: string }): LegalEnvelope[] {
  const live = args.items.filter((it) => it.kind === 'notice_53_056' && !it.voided_at)
  const byFiling = new Map<string, LegalDeskItemLike[]>()
  const byJob = new Map<string, LegalDeskItemLike[]>()
  for (const it of live) {
    if (it.sent_filing_id) byFiling.set(it.sent_filing_id, [...(byFiling.get(it.sent_filing_id) ?? []), it])
    byJob.set(it.job_id, [...(byJob.get(it.job_id) ?? []), it])
  }
  return envelopes.map((e) => {
    if (e.kind !== 'notice_53_056') return { ...e, letterTwo: null, answers: null }
    const linked = e.filingIds.flatMap((id) => byFiling.get(id) ?? [])
    const facts = linked.map((it) => parseLienNoticeSentFacts(it.fields))
    const two = facts.find((f) => f.letterTwo)?.letterTwo
    if (two) return { ...e, letterTwo: { kind: two.kind }, answers: null }
    const linkedIds = new Set(linked.map((it) => it.id))
    let call: OwnerCall | null = null
    for (const f of facts) {
      const c = parseOwnerCall(f.ownerCall)
      if (c && (!call || c.at > call.at)) call = c
    }
    const gcAuthorized = facts.find((f) => f.gcAuthorizedDirectPay)?.gcAuthorizedDirectPay ?? null
    const letterTwo = e.shares.map((sh) => {
      const status = letterTwoStatus({ items: byJob.get(sh.jobId) ?? [], openBalance: args.openBalanceOf(sh.jobId), todayYmd: args.todayYmd })
      return { jobId: sh.jobId, jobLabel: sh.jobLabel, status: status.firstItemId && linkedIds.has(status.firstItemId) ? status : LETTER_TWO_NONE }
    })
    return { ...e, letterTwo: null, answers: { ownerCall: call, pile: affidavitPileFor(call), holdEndsOn: reservationHoldEndsOn(call?.originalContractCompletedOn), gcAuthorized, letterTwo } }
  })
}

/** `§ 53.056 notice` / `§ 53.056 notice · letter two, paid-out` — the Paper cell. */
export function envelopeKindWords(e: Pick<LegalEnvelope, 'kindLabel' | 'letterTwo'>): string {
  return e.letterTwo ? `${e.kindLabel} · letter two, ${letterTwoKindLabel(e.letterTwo.kind)}` : e.kindLabel
}

/** What each pile means to the reader of the paper — counsel's own short call. */
const PILE_WORDS: Record<AffidavitPile, string> = {
  A: 'the claim is trapped under § 53.081',
  B: 'a reserved-funds lien to the extent of the 10% (§ 53.105)',
  C: 'the property lien — file promptly',
}

export type LegalEnvelopeAnswerWords = { owner: string; letterTwo: string; gcOkay: string }

function letterTwoClockWords(s: LetterTwoStatus, day: (ymd: string) => string): string {
  switch (s.state) {
    case 'none': return '—'
    case 'waiting': return `day ${s.day} · not due until day ${LETTER_TWO_FROM_DAY}`
    case 'due': return `day ${s.day} · due, not sent`
    case 'overdue': return `day ${s.day} · overdue, not sent`
    case 'paid': return 'not needed — paid'
    case 'gc_authorized': return 'not needed — the GC authorized direct pay'
    case 'owner_called': return `day ${s.day} · turned off by the owner's call`
    case 'in_flight': return `${letterTwoKindLabel(s.letterTwo!.kind)} · drafted at the office, not yet sent`
    case 'sent': return `sent${s.letterTwo?.sentAt ? ` ${day(s.letterTwo.sentAt.slice(0, 10))}` : ''} · ${letterTwoKindLabel(s.letterTwo!.kind)}`
  }
}

/**
 * The band's three lines, one wording for the firm's page, the desk's Paper
 * tab and the print: `Oct 1, Taunya — still owes Lenox $41,200 · reserved the
 * 10% and still holds it · their contract completes Nov 30 → pile A: the claim
 * is trapped under § 53.081; the § 53.101 hold runs to Dec 30`.
 */
export function envelopeAnswersWords(a: LegalEnvelopeAnswers, opts: { todayYmd: string; gcName: string; formatMoney?: (n: number) => string }): LegalEnvelopeAnswerWords {
  const fmt = opts.formatMoney ?? money
  const day = (ymd: string) => shortDay(ymd, opts.todayYmd)
  const gc = opts.gcName || 'the GC'
  let owner: string
  const c = a.ownerCall
  if (!c) owner = 'no call recorded yet — the three answers the letter asks for are still owed'
  else {
    const when = `${day(c.at.slice(0, 10))}${c.name ? `, ${c.name}` : ''}`
    const owes = c.owesGc === 'yes' ? `still owes ${gc}${c.owesAmount != null ? ` ${fmt(c.owesAmount)}` : ''}` : c.owesGc === 'no' ? `owes ${gc} nothing` : `whether they still owe ${gc}: unknown`
    const reserved = c.reserved === 'held' ? 'reserved the 10% and still holds it' : c.reserved === 'released' ? 'reserved the 10% and released it to the GC' : c.reserved === 'never' ? 'never reserved the 10%' : 'the 10%: unknown'
    const done = c.originalContractCompletedOn ? `their contract ${c.originalContractCompletedOn <= opts.todayYmd ? 'completed' : 'completes'} ${day(c.originalContractCompletedOn)}` : 'their contract is still open or undated'
    const hold = a.holdEndsOn ? `the § 53.101 hold runs to ${day(a.holdEndsOn)}` : ''
    const pile = a.pile ? ` → pile ${a.pile}: ${PILE_WORDS[a.pile]}${hold ? `; ${hold}` : ''}` : hold ? ` · ${hold}` : ''
    owner = `${when} — ${owes} · ${reserved} · ${done}${pile}${c.note.trim() ? ` · “${c.note.trim()}”` : ''}`
  }
  const clocks = a.letterTwo.map((l) => ({ label: l.jobLabel, words: letterTwoClockWords(l.status, day) }))
  const distinct = [...new Set(clocks.map((x) => x.words))]
  const letterTwo = clocks.length === 0 ? '—' : distinct.length === 1 ? distinct[0]! : clocks.map((x) => `${x.label}: ${x.words}`).join(' · ')
  const g = a.gcAuthorized
  const gcOkay = g ? `${day(g.at.slice(0, 10))}${g.name ? ` · ${g.name}` : ''}${g.note.trim() ? ` · ${g.note.trim()}` : ''}` : 'none'
  return { owner, letterTwo, gcOkay }
}
