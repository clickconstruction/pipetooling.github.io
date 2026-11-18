/**
 * The first line of Bill Customer's yellow box for a billed party with no email
 * (`components/jobs/BillCustomerMissingEmailBanner.tsx`). The words left `SendRecordInvoiceModal` with the box as a pure
 * move, unchanged. They sit here by name because the box is not an empty list: the address field and **Save** under the
 * line are the press, and `check:empty-words` reads a moved sentence that opens on No as a new empty state.
 */
import type { EffectiveBillParty } from '../jobs/billToParty'

/** The line when the job's own customer is billed and has no email. */
export const BILL_CUSTOMER_NO_CUSTOMER_EMAIL = 'No customer email on this job — Stripe and emailed invoices need one.'

/** The box's first line: who has no email, and why one is needed. A GC payer is named, or reads *The GC* when its row did not load. */
export function billCustomerMissingEmailLead(payerParty: EffectiveBillParty, payerName: string | null | undefined): string {
  return payerParty === 'gc'
    ? `${payerName || 'The GC'} pays this job and has no billing email yet — Stripe and emailed invoices need one.`
    : BILL_CUSTOMER_NO_CUSTOMER_EMAIL
}
