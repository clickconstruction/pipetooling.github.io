/**
 * A § 53.056 notice that went out by hand (punch list #35, PR 2): the office
 * printed the paper from the app and mailed it outside the run — one paper
 * for several jobs at one property, claiming what it claimed. This kernel
 * turns what the office types (when, how, to whom, what the paper said, where
 * the copy lives, which jobs it covered) into one `job_lien_filings` row per
 * covered job on one packet, and words the difference between the paper's
 * claim and the app's. Pure; the IO writes the rows and moves the desk items.
 */
import type { LienNoticeFields } from '../jobsDocuments/lienFilingDocuments'
import { filingDocumentPayload } from './lienFilingDocumentLink'
import { propertyKey } from './ownerConfirm'

export type ByHandRecipient = 'owner' | 'original_contractor'
export type ByHandMethod = 'certified_mail' | 'mail' | 'traceable_courier' | 'email' | 'hand'

export const BY_HAND_METHODS: ReadonlyArray<{ key: ByHandMethod; label: string }> = [
  { key: 'certified_mail', label: 'certified mail' },
  { key: 'mail', label: 'mail' },
  { key: 'traceable_courier', label: 'traceable courier' },
  { key: 'email', label: 'email' },
  { key: 'hand', label: 'hand delivery' },
]

/** A job the paper covered — the one the door opened on first, then the ticked others at the property. */
export type ByHandJob = {
  jobId: string
  /** "273 · Dudley (Lennox)" */
  label: string
  /** The job's own share — its open balance (or the claim set by hand). */
  amount: number
  /** The live desk item to mark sent, when the job has one. */
  itemId: string | null
}

export type ByHandInput = {
  /** 'YYYY-MM-DD' — the day it went out. */
  sentOn: string
  method: ByHandMethod
  tracking: string
  recipients: ByHandRecipient[]
  /** The total the paper claimed. */
  printedClaim: number
  /** 'YYYY-MM' — the months the paper named. */
  printedMonths: string[]
  documentUrl: string
  documentNote: string
  jobs: ByHandJob[]
}

/** What stops the record, in the order the form lists its fields. Empty when it can be written. */
export function byHandProblems(input: ByHandInput, todayYmd: string): string[] {
  const out: string[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sentOn)) out.push('When it went out')
  else if (input.sentOn > todayYmd) out.push('The send date is in the future')
  if (input.recipients.length === 0) out.push('Who received it — the statute names the owner and the original contractor')
  if (!(input.printedClaim > 0)) out.push('The claim as printed')
  if (input.printedMonths.length === 0) out.push('The months as printed')
  if (input.jobs.length === 0) out.push('At least one job')
  if (input.method === 'email' && !input.tracking.trim()) out.push('An email needs the address it went to, in the tracking box')
  return out
}

/** The paper's total against the app's, in words: '' when they agree. */
export function byHandClaimWords(printedClaim: number, appClaim: number, opts: { timely?: boolean } = {}): string {
  if (!(printedClaim > 0) || Math.abs(printedClaim - appClaim) < 0.005) return ''
  const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  return `printed ${money(printedClaim)} · the app's ${opts.timely ? 'timely ' : ''}claim would have been ${money(appClaim)}`
}

/** The delivery record every covered job's filing carries. */
export function byHandSends(input: Pick<ByHandInput, 'sentOn' | 'method' | 'tracking' | 'recipients'>): Array<{ recipient: ByHandRecipient; method: ByHandMethod; tracking: string; sent_on: string }> {
  return input.recipients.map((recipient) => ({ recipient, method: input.method, tracking: input.tracking.trim(), sent_on: input.sentOn }))
}

/**
 * One `job_lien_filings` insert per covered job: the job's own amount, the
 * paper's months and total, both sends, the saved copy, all on one packet.
 * `printed_claim` is set only when the paper's total is not this job's amount
 * (one paper over several jobs, or a hand-set figure).
 */
export function byHandFilingPayloads(
  input: ByHandInput,
  opts: { userId: string | null; packetId: string; fieldsFor: (job: ByHandJob) => LienNoticeFields },
): Array<Record<string, unknown>> {
  const sends = byHandSends(input)
  return input.jobs.map((job) => ({
    job_id: job.jobId,
    created_by: opts.userId,
    kind: 'notice_53_056',
    amount: Math.round(job.amount * 100) / 100,
    months_covered: input.printedMonths.slice().sort(),
    fields: JSON.parse(JSON.stringify(opts.fieldsFor(job))) as Record<string, unknown>,
    sends,
    by_hand: true,
    packet_id: opts.packetId,
    printed_claim: Math.abs(input.printedClaim - job.amount) < 0.005 ? null : Math.round(input.printedClaim * 100) / 100,
    ...filingDocumentPayload({ url: input.documentUrl, note: input.documentNote }),
  }))
}

export type PropertyJobLike = {
  id: string
  customer_address_id: string | null
  job_address: string | null
  revenue: number | null
  payments_made: number | null
}

/**
 * The other unpaid jobs at the same property — the ones one paper could have
 * covered: the same saved property record when both have one, else the same
 * street number and street; money open; never the job itself. Biggest first.
 */
export function otherJobsAtProperty<T extends PropertyJobLike>(primary: PropertyJobLike, jobs: ReadonlyArray<T>): T[] {
  const key = primary.customer_address_id ? null : propertyKey(primary.job_address ?? '')
  return jobs
    .filter((j) => j.id !== primary.id)
    .filter((j) => (Number(j.revenue) || 0) - (Number(j.payments_made) || 0) > 0)
    .filter((j) => (primary.customer_address_id ? j.customer_address_id === primary.customer_address_id : Boolean(key) && propertyKey(j.job_address ?? '') === key))
    .sort((a, b) => ((Number(b.revenue) || 0) - (Number(b.payments_made) || 0)) - ((Number(a.revenue) || 0) - (Number(a.payments_made) || 0)))
}

/** The months as the office types them — "Apr, Jun, Jul, Aug 2026" or "2026-04 2026-06" — as 'YYYY-MM' keys, in order, deduplicated. */
export function parsePrintedMonths(text: string, fallbackYear: number): string[] {
  const out: string[] = []
  const push = (k: string) => { if (/^\d{4}-\d{2}$/.test(k) && !out.includes(k)) out.push(k) }
  const names = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const yearMatches = text.match(/\b(20\d{2})\b/g)
  const year = yearMatches ? Number(yearMatches[yearMatches.length - 1]) : fallbackYear
  for (const tok of text.split(/[\s,;+/]+/)) {
    const t = tok.trim().toLowerCase()
    if (!t) continue
    const ym = /^(\d{4})-(\d{1,2})$/.exec(t)
    if (ym) { push(`${ym[1]}-${String(Number(ym[2])).padStart(2, '0')}`); continue }
    const i = names.findIndex((n) => t.startsWith(n))
    if (i >= 0) push(`${year}-${String(i + 1).padStart(2, '0')}`)
  }
  return out.sort()
}
