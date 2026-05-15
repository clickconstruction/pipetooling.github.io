import type { JobWithDetails } from '../types/jobWithDetails'
import type { InvoiceWithJob } from './jobsStagesBoard'

/**
 * Locate a `jobs_ledger_invoices` row plus its parent job from a Jobs list snapshot.
 * Used to re-hydrate View bill modal state after refetch (avoid stale invoice objects).
 */
export function findInvoiceWithJobFromJobs(
  jobs: JobWithDetails[],
  invoiceId: string,
): InvoiceWithJob | null {
  const id = invoiceId.trim()
  if (!id) return null
  for (const job of jobs) {
    for (const inv of job.invoices ?? []) {
      if (inv.id === id) {
        return { ...inv, job }
      }
    }
  }
  return null
}
