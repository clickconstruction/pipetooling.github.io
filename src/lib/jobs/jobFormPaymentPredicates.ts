/**
 * Predicates for payment rows in the Job form: Mercury/Stripe/invoice linkage
 * and whether a row may be removed or unlinked. Extracted verbatim from
 * JobFormModal. Pure.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import { isAssistantLike } from '../subcontractorLikeRole'
import type { JobsLedgerInvoiceRow, PaymentRow } from './jobFormTypes'

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

export function jobsLedgerInvoiceIsStripeLinked(inv: JobsLedgerInvoiceRow): boolean {
  if ((inv.stripe_invoice_id ?? '').trim()) return true
  return (inv.external_send_channel ?? '').trim() === 'stripe'
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

/** Mercury unlink RPC rejects Stripe-hosted invoices; hide/disable unlink when this applies. */
export function mercuryUnlinkBlockedByStripeHostedInvoice(row: PaymentRow, job: JobWithDetails | null): boolean {
  if (!job || !paymentRowLinkedToInvoice(row)) return false
  const inv = (job.invoices ?? []).find((i) => i.id === row.invoice_id)
  if (!inv) return false
  return jobsLedgerInvoiceIsStripeLinked(inv)
}

/** Manual payment lines that may be removed from the form (persist on Save); Stripe/Mercury/invoice-linked excluded. */
export function canRemovePaymentRowFromForm(row: PaymentRow, job: JobWithDetails | null): boolean {
  if (mercuryLinkedPaymentRow(row)) return false
  if (paymentRowLinkedToInvoice(row)) return false
  if (stripeBillInvoiceForPaymentRow(row, job)) return false
  return true
}
