/**
 * The Customers page's follow-up data as one bundle (v2.3365): what the
 * `get_customers_list_bundle` RPC returns in a single round trip, and the
 * per-customer reads the page derives from it. The money math stays in
 * `customersListRollup`; this module only shapes rows and counts.
 */
import { customersListRollup, type CustomerListRollup, type LcvInvoiceRow, type LcvJobRow, type LcvPaymentRow } from './customersListLcv'

export type CustomerListCounts = { projects: number; jobs: number; bids: number; notes: number }

export type CustomersListBundle = {
  jobs: LcvJobRow[]
  invoices: LcvInvoiceRow[]
  payments: LcvPaymentRow[]
  /** customer_id → count, from the projects / bids / customer_contacts tables. */
  projectCounts: Record<string, number>
  bidCounts: Record<string, number>
  noteCounts: Record<string, number>
  /** customer_id → the newest bid or estimate `created_at` (ISO), the "recent signal". */
  latestSignal: Record<string, string>
  /** Jobs with no customer at all — the "link jobs" nudge. */
  unlinkedJobs: number | null
}

export type CustomersListDerived = {
  countsByCustomerId: Record<string, CustomerListCounts>
  rollupByCustomerId: Record<string, CustomerListRollup>
  recentSignalByCustomerId: Record<string, string>
  /** Paid jobs with revenue and no payment rows (HCP imports) — shown as $0 collected until backfilled. */
  unrecordedPaidCount: number
  unlinkedJobsCount: number | null
}

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}
function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v.filter((x) => x != null && typeof x === 'object') as Record<string, unknown>[]) : []
}

/** The RPC's jsonb → a bundle. Null when the payload is not an object (a stale or missing function). */
export function parseCustomersListBundle(raw: unknown): CustomersListBundle | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const projectCounts: Record<string, number> = {}
  for (const p of arr(r.projects)) {
    const cid = str(p.customer_id)
    if (cid) projectCounts[cid] = num(p.n) ?? 0
  }
  const bidCounts: Record<string, number> = {}
  const latestSignal: Record<string, string> = {}
  const stamp = (cid: string | null, iso: string | null) => {
    if (!cid || !iso) return
    const prev = latestSignal[cid]
    if (!prev || iso > prev) latestSignal[cid] = iso
  }
  for (const b of arr(r.bids)) {
    const cid = str(b.customer_id)
    if (!cid) continue
    bidCounts[cid] = num(b.n) ?? 0
    stamp(cid, str(b.latest))
  }
  for (const e of arr(r.estimates)) stamp(str(e.customer_id), str(e.latest))
  const noteCounts: Record<string, number> = {}
  for (const n of arr(r.notes)) {
    const cid = str(n.customer_id)
    if (cid) noteCounts[cid] = num(n.n) ?? 0
  }
  const jobs: LcvJobRow[] = []
  for (const j of arr(r.jobs)) {
    const id = str(j.id)
    if (!id) continue
    jobs.push({
      id,
      customer_id: str(j.customer_id),
      status: str(j.status),
      revenue: num(j.revenue),
      payments_made: num(j.payments_made),
      created_at: str(j.created_at),
    })
  }
  const invoices: LcvInvoiceRow[] = []
  for (const i of arr(r.invoices)) {
    const jobId = str(i.job_id)
    if (!jobId) continue
    invoices.push({ id: str(i.id) ?? undefined, job_id: jobId, status: str(i.status) ?? '', amount: num(i.amount) })
  }
  const payments: LcvPaymentRow[] = []
  for (const p of arr(r.payments)) {
    const jobId = str(p.job_id)
    if (!jobId) continue
    payments.push({ job_id: jobId, invoice_id: str(p.invoice_id), amount: num(p.amount), paid_on: str(p.paid_on) })
  }
  return { jobs, invoices, payments, projectCounts, bidCounts, noteCounts, latestSignal, unlinkedJobs: num(r.unlinked_jobs) }
}

/** The per-customer reads the page renders, for the customers it lists. */
export function deriveCustomersList(bundle: CustomersListBundle, customerIds: string[]): CustomersListDerived {
  const countsByCustomerId: Record<string, CustomerListCounts> = {}
  for (const id of customerIds) {
    countsByCustomerId[id] = {
      projects: bundle.projectCounts[id] ?? 0,
      jobs: 0,
      bids: bundle.bidCounts[id] ?? 0,
      notes: bundle.noteCounts[id] ?? 0,
    }
  }
  for (const j of bundle.jobs) {
    const entry = j.customer_id ? countsByCustomerId[j.customer_id] : undefined
    if (entry) entry.jobs++
  }
  const rollupByCustomerId = customersListRollup(bundle.jobs, bundle.invoices, bundle.payments)
  const jobIdsWithPaymentRows = new Set(bundle.payments.map((p) => p.job_id))
  const unrecordedPaidCount = bundle.jobs.filter(
    (j) => j.status === 'paid' && Number(j.revenue ?? 0) > 0 && !jobIdsWithPaymentRows.has(j.id),
  ).length
  const recentSignalByCustomerId: Record<string, string> = {}
  for (const id of customerIds) {
    const s = bundle.latestSignal[id]
    if (s) recentSignalByCustomerId[id] = s
  }
  return { countsByCustomerId, rollupByCustomerId, recentSignalByCustomerId, unrecordedPaidCount, unlinkedJobsCount: bundle.unlinkedJobs }
}

/** PostgREST's "function not found" — the deploy window before the migration is pushed. */
export function isMissingRpcError(message: string | null | undefined): boolean {
  return /could not find the function|PGRST202/i.test(message ?? '')
}
