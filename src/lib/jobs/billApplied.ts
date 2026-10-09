import type { JobWithDetails } from '../../types/jobWithDetails'
import { attributeJobPayments } from './paymentAttribution'

/**
 * What one bill has been paid, under the one rule (v2.5006; the owner's call of 2026-10-09): a
 * payment put on the job with no bill picked counts too. The shared kernel (`attributeJobPayments`)
 * gives each bill its own linked payments in full; unlinked money first pays the part of the job on
 * no sent bill (v2.4534, given the job's total), then the sent bills oldest first. Before this the
 * Billed board, GC Review and the GC statement counted linked payments only, while the portal, the
 * bill paper, the demand letter and the Bill tab followed the rule — job 273 read $17,585 owed on
 * the board and $16,685 everywhere else.
 *
 * A ready-to-bill draft takes no unlinked money (the customer never had it), so it reads its linked
 * payments alone, as before.
 */
export function billAppliedOnJob(job: Pick<JobWithDetails, 'invoices' | 'payments' | 'revenue'>, invoiceId: string): number {
  return attributeJobPayments(job.invoices ?? [], job.payments ?? [], job.revenue).byBill.get(invoiceId)?.applied ?? 0
}
