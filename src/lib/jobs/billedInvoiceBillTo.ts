/**
 * Who a billed invoice's paper names as Bill to (v2.7956). Its own file, client only: `billToParty.ts` is copied to the
 * edge functions (`scripts/edge-kernels.mjs`), and this rule is for papers the client draws.
 */
import { effectiveInvoiceParty, type InvoicePartyFields, type PayerNamedJob } from './billToParty'
import { applyBillToToJobBillingContext, invoiceBillToFromRow, type InvoiceBillToRowFields } from './invoiceBillTo'

/** The lines of a paper's Bill to block. */
export type BillToFace = { customer_name: string | null; customer_email: string | null; customer_phone?: string | null }

/**
 * Who a billed invoice's paper names as Bill to (v2.7956): whoever the bill went to, by the rule every billing reader
 * shares (`effectiveInvoiceParty`). Bill Customer overlays the payer while it sends (`applyPayerToJobBillingContext`,
 * `applyBillToToJobBillingContext`). A paper drawn again later from the job read the job's customer alone, so a bill
 * that went to the GC printed "Customer" on a GC job and the customer's name on any other.
 *
 *   1. a bill typed to someone else → that name, email and phone (the per-invoice override, v2.1086)
 *   2. a bill to the GC → the GC's name. The job's email and phone stay only when the job has no other customer (a GC
 *      job, or the GC entered as the customer): on any other job they are the customer's, who was not billed.
 *   3. else the job's customer, as before.
 *
 * A GC whose name the job did not load changes nothing: the paper never names a party it cannot spell.
 */
export function billedInvoiceBillTo<T extends BillToFace>(
  face: T,
  job: PayerNamedJob,
  inv: (InvoicePartyFields & InvoiceBillToRowFields) | null | undefined,
): T {
  const party = effectiveInvoiceParty(job, inv ?? null)
  if (party === 'other') return applyBillToToJobBillingContext(face, invoiceBillToFromRow(inv))
  if (party !== 'gc') return face
  const gcName = (job.gcCustomer?.name ?? '').trim()
  if (!gcName) return face
  const customerId = (job.customer_id ?? '').trim()
  const gcIsTheOnlyParty = !customerId || customerId === (job.gc_customer_id ?? '').trim()
  return gcIsTheOnlyParty ? { ...face, customer_name: gcName } : { ...face, customer_name: gcName, customer_email: '', customer_phone: '' }
}
