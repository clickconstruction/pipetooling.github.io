/**
 * A check on a Stripe bill holds the Stripe close (v2.4801). Mark Paid · Check used to tell
 * Stripe "paid" the moment the office typed it, and Stripe never takes that back — so a check
 * applied to the wrong job, or one the bank returned, needed a credit note, a send-back and a
 * fresh bill with a new number. Now the check is a ledger row only: the bill reads Paid here,
 * Stripe keeps the invoice open, and the row moves or comes off like any hand-typed payment.
 * CHECK_CLEAR_DAYS after the check's date the sweep (`close-held-stripe-marks`) closes the
 * Stripe invoice out of band with the same mark Mark Paid used to write. Cash, a wire, ACH and
 * a card close at once as before. Pure.
 */
import { ymdAddDays } from '../../utils/dateUtils'
import { CHECK_CLEAR_DAYS, isCheckPayment } from './checkClearing'
import { formatYmdMonthDay } from './billedExpectedPay'
import type { JobsLedgerInvoiceRow, PaymentRow } from './jobFormTypes'
import { paymentRowLinkedToInvoice } from './jobFormPaymentPredicates'
import { invoiceRecordsThroughStripe } from './paymentInvoiceLinking'
import type { JobWithDetails } from '../../types/jobWithDetails'

/** Mark Paid records the row and leaves Stripe open: a Stripe bill, a check, the whole open balance. */
export function markPaidHoldsStripeClose(args: { stripeHosted: boolean; paymentType: string | null | undefined; planKind: string | null | undefined }): boolean {
  if (!args.stripeHosted) return false
  if (args.planKind !== 'full') return false
  return isCheckPayment({ payment_type: args.paymentType ?? null })
}

/** The day the sweep closes the Stripe invoice: CHECK_CLEAR_DAYS after the check's date. */
export function heldStripeCloseYmd(paidOnYmd: string): string {
  return ymdAddDays(paidOnYmd, CHECK_CLEAR_DAYS)
}

type HeldMarkInvoice = Pick<JobsLedgerInvoiceRow, 'status' | 'stripe_invoice_id' | 'external_send_channel'> & { stripe_invoice_status?: string | null }

/** A Stripe bill the app shows paid while Stripe still shows it open: a held mark. */
export function stripeMarkIsHeld(inv: HeldMarkInvoice): boolean {
  if (inv.status !== 'paid') return false
  if (!invoiceRecordsThroughStripe(inv as JobsLedgerInvoiceRow)) return false
  const st = (inv.stripe_invoice_status ?? '').trim()
  return st !== 'paid' && st !== 'void' && st !== 'uncollectible'
}

/** The held Stripe bill this row pays, or null when its bill is not a held mark. */
export function paymentRowOnHeldStripeMark(row: PaymentRow, job: JobWithDetails | null): JobsLedgerInvoiceRow | null {
  if (!job || !paymentRowLinkedToInvoice(row)) return null
  const inv = (job.invoices ?? []).find((i) => i.id === row.invoice_id)
  if (!inv || !stripeMarkIsHeld(inv as HeldMarkInvoice)) return null
  return inv
}

/** Under the payment type in Mark Paid, when the close is held. */
export function heldStripeMarkNote(paidOnYmd: string): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(paidOnYmd) ? formatYmdMonthDay(heldStripeCloseYmd(paidOnYmd)) : null
  const when = day ? `on ${day}, ${CHECK_CLEAR_DAYS} days after the check's date` : `${CHECK_CLEAR_DAYS} days after the check's date`
  return `The bill reads Paid here now. Stripe closes the invoice ${when}, once the check has cleared. Until then this payment can be moved to another job or taken off like any other, and the pay link stays open.`
}

/** The line under a held check on the job's payment list. */
export function heldStripeMarkLineWords(paidOnYmd: string | null, todayYmd: string): string {
  if (!paidOnYmd || !/^\d{4}-\d{2}-\d{2}$/.test(paidOnYmd)) return 'Stripe closes the bill once the check has cleared'
  const closeYmd = heldStripeCloseYmd(paidOnYmd)
  if (closeYmd <= todayYmd) return 'Stripe closes the bill on the next sweep'
  return `Stripe closes the bill ${formatYmdMonthDay(closeYmd)}, once the check has cleared`
}
