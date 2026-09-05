/** Jobs → Job Summary "%" column: latest field-report completion percent with
 * `jobs_ledger.pct_complete` (Edit Job) as the fallback. Pure — no React/supabase. */

/**
 * True when every invoice on the job is `paid` (at least one) and the invoiced total is more
 * than zero. On its own this no longer means "done" — see `paidInvoicesCoverContract`: a job
 * with one paid progress bill is fully collected *so far*, not finished.
 */
export function jobInvoicesAllPaidWithAmount(
  invoices: Array<{ status: string | null; amount: number | null }> | null | undefined,
): boolean {
  if (!invoices || invoices.length === 0) return false
  let total = 0
  for (const inv of invoices) {
    if (inv.status !== 'paid') return false
    total += Number(inv.amount ?? 0)
  }
  return total > 0
}

/** Σ invoice amounts, every status (what has been billed on the job so far). */
export function jobInvoicedTotalUsd(
  invoices: Array<{ amount: number | null }> | null | undefined,
): number {
  if (!invoices) return 0
  let total = 0
  for (const inv of invoices) total += Number(inv.amount ?? 0)
  return total
}

/** Absolute floor of the coverage tolerance — cents of rounding between lines and the contract. */
export const PAID_INVOICES_COVERAGE_TOLERANCE_USD = 1
/** Relative tolerance — small retainage / discount write-downs on a fully billed job. */
export const PAID_INVOICES_COVERAGE_TOLERANCE_PCT = 0.5

/**
 * The gate on the paid-invoices → 100 branch (v2.2840): the invoiced total has to cover the
 * job's contract revenue (within max($1, 0.5 %)). A progress bill that is paid but covers only
 * part of the contract does NOT make the job finished — the % falls through to what the crew
 * and the office say. A job with no contract revenue set (null / $0) has nothing to compare
 * against and keeps the old rule: fully collected ⇒ done (the Quickfill "Complete, no Total
 * Bill" section lists exactly those jobs so the office can set the Job Total).
 */
export function paidInvoicesCoverContract(
  invoicedTotalUsd: number | null | undefined,
  contractRevenueUsd: number | null | undefined,
): boolean {
  const revenue = Number(contractRevenueUsd ?? 0)
  if (!Number.isFinite(revenue) || revenue <= 0) return true
  const invoiced = Number(invoicedTotalUsd ?? 0)
  if (!Number.isFinite(invoiced)) return false
  const tolerance = Math.max(PAID_INVOICES_COVERAGE_TOLERANCE_USD, revenue * (PAID_INVOICES_COVERAGE_TOLERANCE_PCT / 100))
  return invoiced >= revenue - tolerance
}

/** Who said the %: fully paid invoices covering the contract · the latest crew report · the office's Edit-Job % · nobody. */
export type JobSummaryPercentSource = 'paid-invoices' | 'crew-report' | 'office' | 'none'

export type JobSummaryPercentResolution = {
  pct: number | null
  source: JobSummaryPercentSource
}

export type JobSummaryPercentOpts = {
  /** Every invoice paid, total > 0 (`jobInvoicesAllPaidWithAmount`). */
  invoicesAllPaidWithAmount?: boolean
  /** Σ invoice amounts (`jobInvoicedTotalUsd`); required for the paid branch to fire on a job with revenue. */
  invoicedTotalUsd?: number | null
  /** The job's contract (`jobs_ledger.revenue`); null / 0 = no contract to compare against. */
  contractRevenueUsd?: number | null
}

/** Build the resolver's paid-invoice inputs from a job row — the one-liner every caller uses. */
export function jobSummaryPaidInvoiceOpts(
  invoices: Array<{ status: string | null; amount: number | null }> | null | undefined,
  contractRevenueUsd: number | string | null | undefined,
): JobSummaryPercentOpts {
  return {
    invoicesAllPaidWithAmount: jobInvoicesAllPaidWithAmount(invoices),
    invoicedTotalUsd: jobInvoicedTotalUsd(invoices),
    contractRevenueUsd: contractRevenueUsd == null ? null : Number(contractRevenueUsd),
  }
}

function validPct(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v) : null
}

/**
 * Fully paid invoices that cover the contract win (the whole job is billed and the money is
 * in); then the report percent (what the crew last reported — same source as the timeline
 * chart's green line); then the job's manual pct_complete when it is a valid 0–100 value;
 * otherwise null (rendered as —). Returns the % and which source produced it.
 */
export function resolveJobSummaryPercentCompleteWithSource(
  reportPct: number | null | undefined,
  pctComplete: number | null | undefined,
  opts?: JobSummaryPercentOpts,
): JobSummaryPercentResolution {
  if (opts?.invoicesAllPaidWithAmount && paidInvoicesCoverContract(opts.invoicedTotalUsd, opts.contractRevenueUsd)) {
    return { pct: 100, source: 'paid-invoices' }
  }
  const fromReport = validPct(reportPct)
  if (fromReport != null) return { pct: fromReport, source: 'crew-report' }
  const fromOffice = validPct(pctComplete)
  if (fromOffice != null) return { pct: fromOffice, source: 'office' }
  return { pct: null, source: 'none' }
}

/** The % alone — `resolveJobSummaryPercentCompleteWithSource(...).pct`. */
export function resolveJobSummaryPercentComplete(
  reportPct: number | null | undefined,
  pctComplete: number | null | undefined,
  opts?: JobSummaryPercentOpts,
): number | null {
  return resolveJobSummaryPercentCompleteWithSource(reportPct, pctComplete, opts).pct
}

export function formatJobSummaryPercentComplete(pct: number | null): string {
  return pct == null ? '—' : `${pct}%`
}

/**
 * The "%"-column fallback chain when no field report carries a % — paid invoices covering
 * the contract → Edit-Job pct_complete → null. Feeds the Cost Timeline's fallback value point
 * so the chart's value series appears wherever the Job Summary % column shows a percent.
 */
export function resolveJobCurrentPercentFallback(job: {
  pct_complete: number | null
  invoices: Array<{ status: string | null; amount: number | null }> | null | undefined
  revenue?: number | string | null
}): number | null {
  return resolveJobSummaryPercentComplete(null, job.pct_complete, jobSummaryPaidInvoiceOpts(job.invoices, job.revenue))
}
