/**
 * The search the Jobs page's Billing tab ran, kept for the Dashboard's Assigned Jobs box, which reads it.
 * The tab left the page in v2.8698 (punch list #190, decision 5) and took its sort, its two cells, its
 * labor flag and its totals with it. This predicate is what is left of its kernels.
 */

export type BillingSearchableJob = {
  hcp_number?: string | null
  click_number?: string | null
  job_name?: string | null
  job_address?: string | null
  customer_name?: string | null
  /** v2.1619: the search reaches a job's line-item text. */
  fixtures?: Array<{ name?: string | null; line_description?: string | null }>
  materials?: Array<{ description?: string | null }>
}

export function billingJobMatchesSearch(job: BillingSearchableJob, query: string): boolean {
  const q = query.toLowerCase().trim()
  if (!q) return true
  if (
    (job.hcp_number ?? '').toLowerCase().includes(q) ||
    // Rows display the Click number when there is no HCP — it must be findable
    // by typing it too (the audit's display/match mismatch).
    (job.click_number ?? '').toLowerCase().includes(q) ||
    (job.job_name ?? '').toLowerCase().includes(q) ||
    (job.job_address ?? '').toLowerCase().includes(q) ||
    (job.customer_name ?? '').toLowerCase().includes(q)
  ) {
    return true
  }
  // Specific Work and Other job charges are searchable too (v2.1619): "which job
  // replaced that water heater?" works.
  for (const f of job.fixtures ?? []) {
    if ((f.name ?? '').toLowerCase().includes(q)) return true
    if ((f.line_description ?? '').toLowerCase().includes(q)) return true
  }
  for (const m of job.materials ?? []) {
    if ((m.description ?? '').toLowerCase().includes(q)) return true
  }
  return false
}
