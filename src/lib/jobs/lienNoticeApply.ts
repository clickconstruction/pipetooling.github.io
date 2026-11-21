/**
 * A § 53.056 notice that already went, applied to a job the desk did not record it on (v2.7508). Pure.
 *
 * One paper can go out for several jobs at a property. It is then recorded on some of them, or with the months it
 * printed and not the month the desk later asks about, and the desk keeps asking a job for a notice that went. The
 * office picks the paper off the record, ticks which of this job's months it stands for, and one new filing row is
 * written on this job that points at the paper's row (`applied_from`). The paper's own row is never changed.
 *
 * The owner's picks, 2026-11-16: a paper applies at the same property only (the same owner of record and the same
 * original contractor), and a month the paper does not print goes through with a typed reason. Whether such a paper
 * does what the law asks of a notice is counsel's to say: this kernel records what the office decided and why.
 */
import { formatYmdMonthDay } from './billedExpectedPay'
import { workMonthShort } from './forecastWorkMonths'
import { noticeDeadlineForMonth } from './lienDeadlines'
import { propertyKey } from './ownerConfirm'

/** A recorded filing, as much of it as this reads. */
export type LienApplyFilingRow = {
  id: string
  job_id: string
  kind: string
  months_covered?: ReadonlyArray<string> | null
  sends?: unknown
  amount?: number | null
  printed_claim?: number | null
  packet_id?: string | null
  document_url?: string | null
  document_note?: string | null
  fields?: unknown
  voided_at?: string | null
  applied_from?: string | null
  created_at?: string | null
}

type Send = { recipient: string; method: string; tracking: string; sent_on: string }

const YMD = /^\d{4}-\d{2}-\d{2}$/
const YM = /^\d{4}-\d{2}$/

function sendsOf(row: Pick<LienApplyFilingRow, 'sends'>): Send[] {
  const out: Send[] = []
  for (const raw of Array.isArray(row.sends) ? row.sends : []) {
    if (!raw || typeof raw !== 'object') continue
    const s = raw as Record<string, unknown>
    out.push({
      recipient: typeof s.recipient === 'string' ? s.recipient : '',
      method: typeof s.method === 'string' ? s.method : '',
      tracking: typeof s.tracking === 'string' ? s.tracking.trim() : '',
      sent_on: typeof s.sent_on === 'string' && YMD.test(s.sent_on) ? s.sent_on : '',
    })
  }
  return out
}

const ownerSend = (row: Pick<LienApplyFilingRow, 'sends'>) => sendsOf(row).find((s) => s.recipient === 'owner' && s.sent_on) ?? null
const digits = (s: string) => s.replace(/\D/g, '')

/**
 * What ties the rows of one mailed paper: the day it went to the owner and that envelope's number. A packet id is
 * not enough, because one paper recorded in two sittings holds two. A row with no dated send to the owner stands
 * alone under its packet, else under itself.
 */
export function lienPaperKey(row: LienApplyFilingRow): string {
  const o = ownerSend(row)
  if (o) return `sent:${o.sent_on}:${o.method}:${digits(o.tracking) || o.tracking.toLowerCase()}`
  return row.packet_id ? `packet:${row.packet_id}` : `row:${row.id}`
}

/** One mailed paper, read off every row that records it. */
export type LienRecordedPaper = {
  key: string
  /** The row a new record points at: one that records the paper itself, on another job when there is one. */
  sourceFilingId: string
  sourceJobId: string
  /** That job's number, as the office reads it. */
  sourceJobLabel: string
  /** The day it went to the owner; '' when no dated send to the owner is on record. */
  sentOn: string
  method: string
  tracking: string
  toOwner: boolean
  toContractor: boolean
  /** The paper's total: the claim printed on it, else the sum of the jobs it is recorded on. */
  claimAsPrinted: number
  /** The months the rows that record the paper itself name, oldest first. */
  monthsPrinted: string[]
  /** The jobs it is recorded on, by number. */
  jobLabels: string[]
  documentUrl: string
  /** The sends a new record carries: the owner's and the original contractor's, each once. */
  sends: Send[]
  packetId: string | null
  fields: unknown
}

/**
 * The papers on record among these filings, newest first. Voided rows and other kinds are left out. `thisJobId` is
 * the job the office is working: a paper recorded on it is still listed, since its record may lack a month.
 */
export function lienRecordedPapers(filings: ReadonlyArray<LienApplyFilingRow>, opts: { thisJobId: string; jobLabel: (jobId: string) => string }): LienRecordedPaper[] {
  const groups = new Map<string, LienApplyFilingRow[]>()
  for (const f of filings) {
    if (f.kind !== 'notice_53_056' || f.voided_at) continue
    const key = lienPaperKey(f)
    const list = groups.get(key)
    if (list) list.push(f)
    else groups.set(key, [f])
  }
  const papers: LienRecordedPaper[] = []
  for (const [key, rows] of groups) {
    const own = rows.filter((r) => !r.applied_from)
    const pool = own.length > 0 ? own : rows
    const ranked = [...pool].sort((a, b) => {
      const other = Number(a.job_id === opts.thisJobId) - Number(b.job_id === opts.thisJobId)
      if (other !== 0) return other
      const at = (a.created_at ?? '').localeCompare(b.created_at ?? '')
      return at !== 0 ? at : a.id.localeCompare(b.id)
    })
    const source = ranked[0]!
    const sourceOwner = ownerSend(source) ?? rows.map(ownerSend).find((s) => s !== null) ?? null
    const contractor = rows.flatMap(sendsOf).find((s) => s.recipient === 'original_contractor') ?? null
    const months = new Set<string>()
    for (const r of pool) for (const m of r.months_covered ?? []) if (YM.test(m)) months.add(m)
    const printed = Math.max(0, ...rows.map((r) => Number(r.printed_claim) || 0))
    const perJob = new Map<string, number>()
    for (const r of rows) perJob.set(r.job_id, Math.max(perJob.get(r.job_id) ?? 0, Number(r.amount) || 0))
    const summed = [...perJob.values()].reduce((s, n) => s + n, 0)
    const jobLabels = [...new Set(rows.map((r) => opts.jobLabel(r.job_id)).filter(Boolean))]
    papers.push({
      key,
      sourceFilingId: source.id,
      sourceJobId: source.job_id,
      sourceJobLabel: opts.jobLabel(source.job_id),
      sentOn: sourceOwner?.sent_on ?? '',
      method: sourceOwner?.method ?? '',
      tracking: sourceOwner?.tracking ?? '',
      toOwner: sourceOwner !== null,
      toContractor: contractor !== null,
      claimAsPrinted: Math.round((printed > 0 ? printed : summed) * 100) / 100,
      monthsPrinted: [...months].sort(),
      jobLabels,
      documentUrl: (rows.find((r) => (r.document_url ?? '').trim())?.document_url ?? '').trim(),
      sends: [...(sourceOwner ? [sourceOwner] : []), ...(contractor ? [contractor] : [])],
      packetId: source.packet_id ?? rows.find((r) => r.packet_id)?.packet_id ?? null,
      fields: source.fields ?? {},
    })
  }
  return papers.sort((a, b) => (a.sentOn !== b.sentOn ? (a.sentOn < b.sentOn ? 1 : -1) : a.key.localeCompare(b.key)))
}

/** The months this job's own live notices already name. */
export function lienNoticedMonthsOnJob(filings: ReadonlyArray<LienApplyFilingRow>, jobId: string): string[] {
  const months = new Set<string>()
  for (const f of filings) if (f.job_id === jobId && f.kind === 'notice_53_056' && !f.voided_at) for (const m of f.months_covered ?? []) if (YM.test(m)) months.add(m)
  return [...months].sort()
}

/** A property as its saved record reads, as much as the match needs. */
export type LienApplyProperty = { addressId: string | null; parcelId: string; county: string; ownerName: string; address: string }

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * The same property, so the same owner of record: the same saved record; else the same parcel in the same county;
 * else the same street and the same owner's name. One property can sit on two saved records (a job entered under
 * the contractor, the rest under the homeowner), so the saved record alone is not the test. Two records that share
 * a street and name different owners are not the same property here.
 */
export function sameLienProperty(a: LienApplyProperty, b: LienApplyProperty): boolean {
  if (a.addressId && a.addressId === b.addressId) return true
  const pa = norm(a.parcelId)
  const pb = norm(b.parcelId)
  if (pa && pb) return pa === pb && norm(a.county) === norm(b.county)
  const ka = propertyKey(a.address)
  const kb = propertyKey(b.address)
  return Boolean(ka) && ka === kb && norm(a.ownerName) !== '' && norm(a.ownerName) === norm(b.ownerName)
}

const andList = (xs: ReadonlyArray<string>) => (xs.length <= 1 ? xs[0] ?? '' : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const monthName = (ym: string) => {
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return names[Number(ym.slice(5, 7)) - 1] ?? ym
}

export type LienApplyCheckInput = {
  paper: LienRecordedPaper
  /** The months ticked, 'YYYY-MM'. */
  months: ReadonlyArray<string>
  /** The months this job's own notices already name. */
  noticedMonths: ReadonlyArray<string>
  propertyKind: string
  /** The job's last day of work when one is set by hand. */
  lastWorkYmd?: string | null
}

export type LienApplyChecks = {
  /** What stops the record. Nothing is written while any stands. */
  refusals: string[]
  /** What the office is told and lets through with a reason. */
  warnings: string[]
}

/**
 * What must hold before a paper is applied, and what is only said. Refused: no month ticked, a paper with no dated
 * send to the owner, a month the job already has a notice for, and a paper that went before the month began (it
 * cannot be notice of work not yet done). Warned: a month the paper does not print, no copy to the original
 * contractor on record, a day after the month's deadline, and a day before the job's last day of work.
 */
export function lienApplyChecks(input: LienApplyCheckInput): LienApplyChecks {
  const { paper } = input
  const refusals: string[] = []
  const warnings: string[] = []
  const months = [...new Set(input.months.filter((m) => YM.test(m)))].sort()
  if (months.length === 0) refusals.push('Tick the month this paper stands for.')
  if (!paper.toOwner || !paper.sentOn) refusals.push('This paper has no dated send to the owner on record. Add the day it went to the paper first.')
  const day = paper.sentOn ? formatYmdMonthDay(paper.sentOn) : ''
  for (const m of months) {
    if (input.noticedMonths.includes(m)) {
      refusals.push(`${monthName(m)} already has a notice on this job.`)
      continue
    }
    if (!paper.sentOn) continue
    if (paper.sentOn < `${m}-01`) {
      refusals.push(`The paper went ${day}, before ${monthName(m)} began. It cannot be notice of that month's work.`)
      continue
    }
    if (!paper.monthsPrinted.includes(m)) {
      warnings.push(paper.monthsPrinted.length > 0 ? `The paper lists ${andList(paper.monthsPrinted.map(workMonthShort))}. ${monthName(m)} is not printed on it.` : `The paper's record names no month. ${monthName(m)} is not printed on it.`)
    }
    const deadline = noticeDeadlineForMonth(`${m}-01`, input.propertyKind)
    if (deadline && paper.sentOn > deadline) warnings.push(`The paper went ${day}, after ${monthName(m)}'s deadline of ${formatYmdMonthDay(deadline)}. It reads as late.`)
    const last = (input.lastWorkYmd ?? '').slice(0, 10)
    if (YMD.test(last) && last.slice(0, 7) === m && paper.sentOn < last) warnings.push(`The paper went ${day}, before this job's last day of work, ${formatYmdMonthDay(last)}.`)
  }
  if (paper.toOwner && !paper.toContractor) warnings.push('No copy to the original contractor is on record for this paper.')
  return { refusals, warnings }
}

/** The fewest letters a reason holds: enough for a sentence, so a stray key is not a reason. */
export const LIEN_APPLY_REASON_MIN = 12

/** '' when the reason will do: none is asked when nothing was warned about. */
export function lienApplyReasonProblem(warnings: ReadonlyArray<string>, reason: string): string {
  if (warnings.length === 0) return ''
  return reason.trim().length >= LIEN_APPLY_REASON_MIN ? '' : 'Say why this paper stands for the month. The reason is kept on the record.'
}

/**
 * The `job_lien_filings` insert: a notice row on this job with the months it stands on, the paper's own sends,
 * packet, total and saved copy, and the pointer at the paper's row with the reason and who applied it.
 */
export function lienApplyPayload(input: { paper: LienRecordedPaper; job: { id: string; amount: number }; months: ReadonlyArray<string>; reason: string; userId: string | null; userName: string }): Record<string, unknown> {
  const amount = Math.round(input.job.amount * 100) / 100
  const url = input.paper.documentUrl
  return {
    job_id: input.job.id,
    created_by: input.userId,
    kind: 'notice_53_056',
    amount,
    months_covered: [...new Set(input.months.filter((m) => YM.test(m)))].sort(),
    fields: JSON.parse(JSON.stringify(input.paper.fields ?? {})) as Record<string, unknown>,
    sends: input.paper.sends.map((s) => ({ ...s })),
    by_hand: true,
    packet_id: input.paper.packetId,
    printed_claim: Math.abs(input.paper.claimAsPrinted - amount) < 0.005 ? null : input.paper.claimAsPrinted,
    ...(url ? { document_url: url } : {}),
    applied_from: input.paper.sourceFilingId,
    applied_from_label: input.paper.sourceJobLabel,
    applied_reason: input.reason.trim(),
    applied_by_name: input.userName.trim(),
  }
}

const METHOD: Record<string, string> = { certified_mail: 'certified mail', mail: 'mail', traceable_courier: 'traceable courier', email: 'email', hand: 'hand delivery' }
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n % 1 === 0 ? 0 : 2 })

/** A paper's two lines in the list: the day, how and the total; then the jobs, the months and who it went to. */
export function lienPaperWords(paper: LienRecordedPaper): { head: string; detail: string } {
  const head = [paper.sentOn ? formatYmdMonthDay(paper.sentOn) : 'No day on record', METHOD[paper.method] ?? paper.method.replace(/_/g, ' '), money(paper.claimAsPrinted)].filter(Boolean).join(' · ')
  const jobs = paper.jobLabels.length > 0 ? `On ${paper.jobLabels.length === 1 ? 'job' : 'jobs'} ${andList(paper.jobLabels)}` : ''
  const months = paper.monthsPrinted.length > 0 ? `names ${andList(paper.monthsPrinted.map(workMonthShort))}` : 'names no month'
  const to = paper.toOwner ? (paper.toContractor ? 'to the owner and the contractor' : 'to the owner') : paper.toContractor ? 'to the contractor' : 'no send on record'
  return { head, detail: [jobs, months, to].filter(Boolean).join(' · ') }
}

/** A filing row that applies a paper, as much as its words need. */
export type LienAppliedRow = { applied_from?: string | null; applied_from_label?: string | null; applied_reason?: string | null; applied_by_name?: string | null; created_at?: string | null }

export const isLienAppliedRow = (row: LienAppliedRow | null | undefined): boolean => Boolean(row?.applied_from)

/** *as part of the notice on job 4101 · applied by Dana, Nov 16*: what an applied row says after its months. '' on any other row. */
export function lienAppliedRowWords(row: LienAppliedRow, appliedOnYmd: string): string {
  if (!isLienAppliedRow(row)) return ''
  const from = (row.applied_from_label ?? '').trim()
  const by = (row.applied_by_name ?? '').trim()
  const on = YMD.test(appliedOnYmd) ? formatYmdMonthDay(appliedOnYmd) : ''
  const part = from ? `as part of the notice on job ${from}` : 'as part of a notice already on record'
  const who = by ? `applied by ${by}${on ? `, ${on}` : ''}` : on ? `applied ${on}` : ''
  return [part, who].filter(Boolean).join(' · ')
}

/** What the desk item keeps when its notice is set aside: the record that covers it, and who set it aside. */
export type LienSetAsideNoticed = { filingId: string; at: string; by: string | null; byName: string; sentOn: string; fromLabel: string }

/** The key on a desk item's `fields`. An item set aside carries it and `voided_at`; undo clears both. */
export const LIEN_SET_ASIDE_KEY = 'setAsideNoticed'

export function fieldsWithSetAside(fields: unknown, mark: LienSetAsideNoticed): Record<string, unknown> {
  const base = fields && typeof fields === 'object' && !Array.isArray(fields) ? (fields as Record<string, unknown>) : {}
  return { ...base, [LIEN_SET_ASIDE_KEY]: mark }
}

export function fieldsWithoutSetAside(fields: unknown): Record<string, unknown> {
  const base = fields && typeof fields === 'object' && !Array.isArray(fields) ? { ...(fields as Record<string, unknown>) } : {}
  delete base[LIEN_SET_ASIDE_KEY]
  return base
}

/**
 * The months the step offers to tick (v2.8027, Grace's yes of 2026-11-20): the notice's own, and on a missed notice
 * with no month still due the closed months the desk calls missed too, so a paper already on record can stand for one.
 * The notice's own months were empty there, which left the step's Apply with nothing to tick. Elsewhere a closed month
 * is not offered, so a draft opens the step with its own months ticked and no closed month beside them. The checks
 * (`lienApplyChecks`) still rule on every month ticked, and a warning still asks for the reason.
 */
export function lienApplyMonthsOffered(input: { pile: string; months: ReadonlyArray<string>; dueMonths: ReadonlyArray<string>; missedMonths: ReadonlyArray<string> }): string[] {
  if (input.pile !== 'missed' || input.dueMonths.length > 0) return [...input.months]
  return [...new Set([...input.months, ...input.missedMonths])].sort()
}

/**
 * Whether the step opens with no paper picked and no month ticked (the owner's answer of 2026-11-20 to the audit of
 * punch list #361): on a missed notice with no month still due. The months offered there are closed ones the desk is
 * not asking for, so the office says which the paper stood for. Ticked on arrival, one typed reason cleared the
 * warnings for all of them, and the record and the affidavit then read every one as noticed. Everywhere else the
 * months are the notice's own, so they start ticked and a lone paper starts picked.
 */
export function lienApplyStartsBlank(input: { pile: string; dueMonths: ReadonlyArray<string> }): boolean {
  return input.pile === 'missed' && input.dueMonths.length === 0
}

/**
 * Whether the notice waiting on the desk is set aside with the record: only when every month it names has a notice
 * afterwards. A waiting notice that names another month too stays where it is, so that month is not lost.
 */
export function lienApplySetsAside(itemMonths: ReadonlyArray<string>, months: ReadonlyArray<string>, noticedMonths: ReadonlyArray<string>): boolean {
  if (itemMonths.length === 0) return false
  const after = new Set([...months, ...noticedMonths])
  return itemMonths.every((m) => after.has(m))
}

/** The button's words: *Apply the Sep 22 notice to job 4107*. */
export function lienApplyButtonWords(paper: LienRecordedPaper | null, jobLabel: string): string {
  if (!paper) return 'Pick the paper that went'
  return `Apply the ${paper.sentOn ? `${formatYmdMonthDay(paper.sentOn)} ` : ''}notice to job ${jobLabel}`
}
