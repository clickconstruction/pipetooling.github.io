/**
 * The notice on your property (v2.3825, punch list #45 PR 2).
 *
 * An owner whose jobs are billed to the GC opens their portal and, until now, read "You're all
 * paid up" while a § 53.056 notice of claim was on its way to them about the same house. Once a
 * notice is RECORDED as sent (a `job_lien_filings` row of kind `notice_53_056`, not voided), the
 * owner's portal shows it on its own — the owner's decision of 2026-09-25: the owner already
 * holds the paper. Facts only, taken from the recorded filing — the day it went to the owner, the
 * claim as printed, the months, the GC's and the claimant's names, the signer — never a draft,
 * never an amount the paper did not carry. A job paid off drops its card.
 *
 * Dependency-free Deno module shared by the customer-portal edge function and the client page
 * (`src/lib/portal/portalPayload.ts` re-parses it); unit-tested from vitest.
 */

export type PortalNoticeJobRow = {
  id: string
  hcp_number?: string | null
  click_number?: string | null
  job_address?: string | null
  customer_id?: string | null
  gc_customer_id?: string | null
  revenue?: number | null
  payments_made?: number | null
}

export type PortalNoticeFilingRow = {
  id: string
  job_id: string
  kind: string
  amount: number | string | null
  printed_claim?: number | string | null
  months_covered?: string[] | null
  packet_id?: string | null
  created_at?: string | null
  voided_at?: string | null
  sends?: unknown
  fields?: unknown
}

export type PortalPropertyNotice = {
  /** The filing (or the packet when one paper covered several jobs). */
  key: string
  /** The property, as the job carries it. */
  address: string
  /** Job numbers the paper covered — the shared-bills card marks those rows "on the notice above". */
  jobNumbers: string[]
  gcName: string
  claimantName: string
  /** The signer — the master plumber. */
  contactPerson: string
  /** The claim as printed on the form. */
  claim: number
  /** 'YYYY-MM', oldest first. */
  months: string[]
  /** 'YYYY-MM-DD' the owner's copy went out (the owner send, else the filing day). */
  mailedOn: string
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "April, June, July and August 2026" — "December 2025 and January 2026" across a year. */
export function portalNoticeMonthsWords(months: ReadonlyArray<string>): string {
  const ms = [...new Set(months.filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort()
  if (ms.length === 0) return ''
  const years = new Set(ms.map((m) => m.slice(0, 4)))
  const name = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1] ?? m
  const parts = years.size === 1 ? ms.map(name) : ms.map((m) => `${name(m)} ${m.slice(0, 4)}`)
  const joined = parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return years.size === 1 ? `${joined} ${ms[0]!.slice(0, 4)}` : joined
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : 0
}

function str(o: unknown, k: string): string {
  const v = o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined
  return typeof v === 'string' ? v.trim() : ''
}

function ownerSentOn(sends: unknown): string {
  if (!Array.isArray(sends)) return ''
  const owner = sends.find((s) => s && typeof s === 'object' && (s as Record<string, unknown>).recipient === 'owner') as Record<string, unknown> | undefined
  const on = typeof owner?.sent_on === 'string' ? owner.sent_on.slice(0, 10) : ''
  return /^\d{4}-\d{2}-\d{2}$/.test(on) ? on : ''
}

/**
 * The notices this viewer sees as the property's owner: recorded § 53.056 notices on jobs where
 * the viewer is the customer and a GC is on the job, while the job still owes. One card per
 * paper — a packet that covered several jobs at one property is one card with its printed total.
 * Newest first.
 */
export function buildPortalPropertyNotices(args: {
  jobs: ReadonlyArray<PortalNoticeJobRow>
  filings: ReadonlyArray<PortalNoticeFilingRow>
  viewerCustomerId: string
}): PortalPropertyNotice[] {
  const owes = (j: PortalNoticeJobRow) => num(j.revenue) - num(j.payments_made) > 0.005
  const jobs = new Map(args.jobs.filter((j) => j.customer_id === args.viewerCustomerId && (j.gc_customer_id ?? '').trim() !== '' && j.gc_customer_id !== args.viewerCustomerId && owes(j)).map((j) => [j.id, j]))
  const groups = new Map<string, PortalNoticeFilingRow[]>()
  for (const f of args.filings) {
    if (f.kind !== 'notice_53_056' || f.voided_at || !jobs.has(f.job_id)) continue
    const key = (f.packet_id ?? '').trim() || f.id
    groups.set(key, [...(groups.get(key) ?? []), f])
  }
  const out: PortalPropertyNotice[] = []
  for (const [key, fs] of groups) {
    const first = fs[0]!
    const job = jobs.get(first.job_id)!
    const printed = fs.map((f) => f.printed_claim).find((p) => p != null && p !== '')
    const claim = printed != null ? num(printed) : fs.reduce((s, f) => s + num(f.amount), 0)
    const mailedOn = ownerSentOn(first.sends) || (first.created_at ?? '').slice(0, 10)
    out.push({
      key,
      address: (job.job_address ?? '').trim(),
      jobNumbers: fs.map((f) => { const j = jobs.get(f.job_id)!; return ((j.hcp_number ?? '').trim() || (j.click_number ?? '').trim()) }).filter(Boolean),
      gcName: str(first.fields, 'originalContractorName'),
      claimantName: str(first.fields, 'claimantName'),
      contactPerson: str(first.fields, 'contactPerson'),
      claim: Math.round(claim * 100) / 100,
      months: [...new Set(fs.flatMap((f) => f.months_covered ?? []))].sort(),
      mailedOn,
    })
  }
  return out.sort((a, b) => b.mailedOn.localeCompare(a.mailedOn) || a.key.localeCompare(b.key))
}
