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
