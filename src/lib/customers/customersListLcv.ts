/**
 * Customers list — lifetime value rollup (Customer Hub train, PR 6).
 *
 * Per-customer lifetime billed over org-wide lean rows, using the SAME
 * per-job rule as customerProfileStats.lifetimeBilled (keep in sync):
 * Σ billed/paid invoice amounts per job; jobs with no billed/paid invoice
 * rows fall back to the job shell (revenue) once the job itself is
 * billed/paid. Pure — two flat arrays in, a customer_id → dollars map out.
 */

export type LcvJobRow = { id: string; customer_id: string | null; status: string | null; revenue: number | null }
export type LcvInvoiceRow = { job_id: string; status: string; amount: number | null }

export function lifetimeValueByCustomer(jobs: LcvJobRow[], invoices: LcvInvoiceRow[]): Record<string, number> {
  const invoicedBilledByJob = new Map<string, number>()
  for (const inv of invoices) {
    if (inv.status !== 'billed' && inv.status !== 'paid') continue
    invoicedBilledByJob.set(inv.job_id, (invoicedBilledByJob.get(inv.job_id) ?? 0) + Number(inv.amount ?? 0))
  }
  const byCustomer: Record<string, number> = {}
  for (const job of jobs) {
    if (!job.customer_id) continue
    const invoiced = invoicedBilledByJob.get(job.id) ?? 0
    let contribution = 0
    if (invoiced > 0) contribution = invoiced
    else if (job.status === 'billed' || job.status === 'paid') contribution = Number(job.revenue ?? 0)
    if (contribution === 0) continue
    byCustomer[job.customer_id] = (byCustomer[job.customer_id] ?? 0) + contribution
  }
  return byCustomer
}
