import { formatCurrency } from './jobFormMoney'

/**
 * Edit Job invoice send-back kernels (v2.1653): eligibility for the billed-row
 * "Send back" action in the Invoices list, and the remedy hint appended to the
 * "Would bill through 100%" warning when pulling back an unpaid bill is the
 * better move than stacking a new invoice. Server guards remain authoritative
 * (`delete_billed_invoice_on_send_back` / `void-stripe-invoice-for-revert`
 * both hard-block on linked payments) — these mirror them for the UI.
 */

export type SendBackPaymentPick = { invoice_id: string | null; amount: number | string | null }
export type SendBackInvoicePick = { id: string; status: string; amount: number | string | null }

/** Dollars of recorded payments referencing the invoice. */
export function paymentsAppliedToInvoice(invoiceId: string, payments: SendBackPaymentPick[]): number {
  return payments.filter((p) => p.invoice_id === invoiceId).reduce((s, p) => s + (Number(p.amount) || 0), 0)
}

/** The server blocks send-back when any payment references the invoice. */
export function sendBackBlockedByPayments(invoiceId: string, payments: SendBackPaymentPick[]): boolean {
  return payments.some((p) => p.invoice_id === invoiceId && (Number(p.amount) || 0) !== 0)
}

/** Billed rows the send-back button is live for (unpaid — no linked payments). */
export function sendBackEligibleBilledInvoices<T extends SendBackInvoicePick>(
  invoices: T[],
  payments: SendBackPaymentPick[],
): T[] {
  return invoices.filter((i) => i.status === 'billed' && !sendBackBlockedByPayments(i.id, payments))
}

/**
 * Remedy line for the bills-ahead-of-field warning: names the unpaid bill(s)
 * that could be pulled back instead of stacking a new invoice. Null when no
 * billed row is eligible (nothing to suggest).
 */
export function billsAheadRemedyHint(
  invoices: SendBackInvoicePick[],
  payments: SendBackPaymentPick[],
): string | null {
  const eligible = sendBackEligibleBilledInvoices(invoices, payments)
  if (eligible.length === 0) return null
  if (eligible.length === 1) {
    const amount = Number(eligible[0]?.amount ?? 0)
    return `Or send back the unpaid $${formatCurrency(amount)} bill below and rebill to match the field.`
  }
  const total = eligible.reduce((s, i) => s + (Number(i.amount) || 0), 0)
  return `Or send back an unpaid bill below (${eligible.length} unpaid · $${formatCurrency(total)}) and rebill to match the field.`
}
