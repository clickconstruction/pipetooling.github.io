/**
 * Mirrors the `ensure_single_ready_to_bill_invoice_for_job` branch that returns
 * "Nothing left to bill for this job" (no RTB rows, no unallocated gross after RTB+billed lines).
 * When true, Bill Customer opened with `kind: 'job'` would show that ensure error.
 */
export type InvoiceRowForEnsureNothingLeft = {
  job_id: string
  status: string
  amount: number | null
}

export function wouldEnsureNothingLeftToBillForJob(
  jobId: string,
  job: Pick<{ revenue: number | null; payments_made: number | null }, 'revenue' | 'payments_made'> | null,
  invoices: InvoiceRowForEnsureNothingLeft[],
): boolean {
  if (!job) return false

  const grossCents = Math.round(
    Math.max(0, Number(job.revenue ?? 0) - Number(job.payments_made ?? 0)) * 100,
  )
  let allocCents = 0
  let rtbCount = 0
  for (const inv of invoices) {
    if (inv.job_id !== jobId) continue
    if (inv.status === 'ready_to_bill') rtbCount += 1
    if (inv.status === 'ready_to_bill' || inv.status === 'billed') {
      allocCents += Math.round(Number(inv.amount ?? 0) * 100)
    }
  }
  const unallocCents = Math.max(0, grossCents - allocCents)
  return unallocCents <= 0 && rtbCount === 0
}
