/**
 * Predicates for payment rows in the Job form: Mercury/Stripe/invoice linkage
 * and whether a row may be removed or unlinked. Extracted verbatim from
 * JobFormModal. Pure.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import { isAssistantLike } from '../subcontractorLikeRole'
import type { JobsLedgerInvoiceRow, PaymentRow } from './jobFormTypes'
import { invoiceRecordsThroughStripe } from './paymentInvoiceLinking'

export function mercuryLinkedPaymentRow(row: PaymentRow): boolean {
  return row.mercury_transaction_id != null && String(row.mercury_transaction_id).trim().length > 0
}

/** Same roles as Accounts Receivable bank payment apply. */
export function canUnlinkMercuryPayment(role: string | null): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary'
}

export function paymentRowLinkedToInvoice(row: PaymentRow): boolean {
  return row.invoice_id != null && String(row.invoice_id).trim().length > 0
}

/** A bill whose payments Stripe records — one definition, in paymentInvoiceLinking (v2.3692). */
export function jobsLedgerInvoiceIsStripeLinked(inv: JobsLedgerInvoiceRow): boolean {
  return invoiceRecordsThroughStripe(inv)
}

export function stripeBillInvoiceForPaymentRow(
  row: PaymentRow,
  job: JobWithDetails | null,
): JobsLedgerInvoiceRow | null {
  if (!job || !paymentRowLinkedToInvoice(row)) return null
  const inv = (job.invoices ?? []).find((i) => i.id === row.invoice_id)
  if (!inv || !jobsLedgerInvoiceIsStripeLinked(inv)) return null
  return inv
}

/**
 * Why a payment on a Stripe bill cannot be unlinked here (v2.3784): Stripe
 * holds a record of it that its own door reverses — a credit note on the row
 * (Undo part payment) or a bill marked paid in Stripe (Unwind). A bank deposit
 * matched to an open Stripe bill with neither (a check the bank later
 * returned, say) is only a ledger row, and the remove RPC deletes it like any
 * other. `null` means nothing stands in the way.
 */
export function stripeHoldsPaymentReason(
  row: PaymentRow,
  job: JobWithDetails | null,
): 'credit_note' | 'paid_in_stripe' | null {
  if (!job || !paymentRowLinkedToInvoice(row)) return null
  const inv = (job.invoices ?? []).find((i) => i.id === row.invoice_id)
  if (!inv || !jobsLedgerInvoiceIsStripeLinked(inv)) return null
  if ((row.stripe_credit_note_id ?? '').trim()) return 'credit_note'
  if ((inv.stripe_invoice_status ?? '').trim() === 'paid') return 'paid_in_stripe'
  return null
}

/** The words for `stripeHoldsPaymentReason` — the same sentence the RPC answers with. */
export function stripeHoldsPaymentWords(reason: 'credit_note' | 'paid_in_stripe'): string {
  return reason === 'credit_note'
    ? 'This part payment sits on the Stripe bill as a credit note — press Undo part payment on the row instead.'
    : 'This bill is marked paid in Stripe — unwind the out-of-band payment on the bill first.'
}

/** Mercury unlink is refused while Stripe holds a record of the payment (`stripeHoldsPaymentReason`); hide/disable unlink when this applies. */
export function mercuryUnlinkBlockedByStripeHostedInvoice(row: PaymentRow, job: JobWithDetails | null): boolean {
  return stripeHoldsPaymentReason(row, job) != null
}

/** The row sits on a Stripe bill that Stripe never learned this payment about — the unlink deletes the ledger row and leaves the pay link as it is. */
export function unlinkLeavesStripeBillUntouched(row: PaymentRow, job: JobWithDetails | null): boolean {
  if (!job || !paymentRowLinkedToInvoice(row)) return false
  const inv = (job.invoices ?? []).find((i) => i.id === row.invoice_id)
  if (!inv || !jobsLedgerInvoiceIsStripeLinked(inv)) return false
  return stripeHoldsPaymentReason(row, job) == null
}

/** What the bank says about the deposit behind a Mercury-linked row — `status` as Mercury syncs it, the reason when it failed. */
export interface MercuryDepositVerdict {
  status: string
  failureReason: string
}

/** The bank returned the deposit (Mercury status `failed` — a bounced check). */
export function mercuryDepositFailed(v: MercuryDepositVerdict | null | undefined): boolean {
  return (v?.status ?? '').trim() === 'failed'
}

/** "Returned by the bank · Insufficient funds" — the chip on a row whose deposit failed. */
export function mercuryDepositFailedWords(v: MercuryDepositVerdict | null | undefined): string {
  const reason = (v?.failureReason ?? '').trim()
  return reason ? `Returned by the bank · ${reason}` : 'Returned by the bank'
}

/** The success toast after Unlink and remove, from the RPC's reply (v2.3784). */
export function unlinkedPaymentToastText(
  payload: { bank_failed?: boolean; bank_reason?: string; marked_returned?: boolean } | null | undefined,
): string {
  if (payload?.marked_returned) {
    const reason = (payload.bank_reason ?? '').trim()
    return `Payment removed from job. The bank returned this deposit${reason ? ` (${reason})` : ''}, so it is marked returned in Accounts Receivable.`
  }
  return 'Payment removed from job. The bank deposit is available in Accounts Receivable again.'
}

/** Manual payment lines that may be removed from the form (persist on Save); Stripe/Mercury/invoice-linked excluded. */
export function canRemovePaymentRowFromForm(row: PaymentRow, job: JobWithDetails | null): boolean {
  if (mercuryLinkedPaymentRow(row)) return false
  if (paymentRowLinkedToInvoice(row)) return false
  if (stripeBillInvoiceForPaymentRow(row, job)) return false
  return true
}
