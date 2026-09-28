/**
 * The job form's payment lines: what an edit may change, what Remove does to the list, what a
 * Remove is answered with, and how the remove RPC's reply reads. Pure — built on the predicates
 * in `jobFormPaymentPredicates`; the form holds the rows and makes the calls.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { PaymentRow } from './jobFormTypes'
import { canRemovePaymentRowFromForm, mercuryLinkedPaymentRow, paymentRowLinkedToInvoice, stripeBillInvoiceForPaymentRow } from './jobFormPaymentPredicates'

/**
 * An edit to a payment line. A line on a Stripe bill or matched to a bank deposit keeps its
 * amount, its date and both links whatever the edit says; the rest of the edit lands.
 */
export function mergePaymentRowUpdate(row: PaymentRow, updates: Partial<PaymentRow>, job: JobWithDetails | null): PaymentRow {
  const merged = { ...row, ...updates }
  if (stripeBillInvoiceForPaymentRow(row, job) || mercuryLinkedPaymentRow(row)) {
    merged.amount = row.amount
    merged.paid_on = row.paid_on
    merged.mercury_transaction_id = row.mercury_transaction_id
    merged.invoice_id = row.invoice_id
  }
  return merged
}

/**
 * The list after a line leaves the form. The same list comes back when the line is not there or
 * is linked (to a bank deposit, an invoice, a Stripe bill); an emptied list is one fresh line.
 */
export function paymentRowsAfterRemove(rows: PaymentRow[], id: string, job: JobWithDetails | null, newEmptyRow: () => PaymentRow): PaymentRow[] {
  const row = rows.find((r) => r.id === id)
  if (!row) return rows
  if (mercuryLinkedPaymentRow(row) || paymentRowLinkedToInvoice(row) || stripeBillInvoiceForPaymentRow(row, job)) return rows
  const next = rows.filter((r) => r.id !== id)
  if (next.length === 0) return [newEmptyRow()]
  return next
}

/** What pressing Remove on a line gets: the confirm, a refusal with its reason, or nothing. */
export type PaymentRemoveRequest = 'confirm' | 'mercury-linked' | 'stripe-bill' | 'invoice-linked' | 'nothing'

/**
 * A bank-matched line and a line on a Stripe bill are refused. Any other line the form may drop
 * opens the confirm — and so does a saved line on an ordinary invoice, which the remove RPC
 * reconciles. An unsaved line on an invoice is refused.
 */
export function planPaymentRemoveRequest(row: PaymentRow, job: JobWithDetails | null, persistedPaymentIds: ReadonlySet<string>): PaymentRemoveRequest {
  if (mercuryLinkedPaymentRow(row)) return 'mercury-linked'
  if (stripeBillInvoiceForPaymentRow(row, job)) return 'stripe-bill'
  const persisted = Boolean(job && persistedPaymentIds.has(row.id))
  if (canRemovePaymentRowFromForm(row, job) || (persisted && paymentRowLinkedToInvoice(row))) return 'confirm'
  return paymentRowLinkedToInvoice(row) ? 'invoice-linked' : 'nothing'
}

/** The words for a refused Remove. */
export function paymentRemoveRefusalWords(refusal: 'mercury-linked' | 'stripe-bill' | 'invoice-linked'): string {
  if (refusal === 'mercury-linked') return 'This payment is linked to a bank transaction. Remove it from Jobs Pipeline → Bank Payments workflow if needed.'
  if (refusal === 'stripe-bill') return 'This payment is linked to a Stripe invoice and can’t be removed in Edit Job. Use Stripe reversal flows.'
  return 'This payment is linked to an invoice and can’t be removed in Edit Job. Change it from Outstanding billing or the mark-paid flow.'
}

/**
 * Confirming the remove writes at once (the RPC) for a saved line that is neither bank-matched
 * nor on a Stripe bill; any other line only leaves the form.
 */
export function paymentRemoveWritesNow(row: PaymentRow, job: JobWithDetails | null, persistedPaymentIds: ReadonlySet<string>): boolean {
  return persistedPaymentIds.has(row.id) && !mercuryLinkedPaymentRow(row) && !stripeBillInvoiceForPaymentRow(row, job)
}

/** How `remove_jobs_ledger_payment_and_reconcile` answered. */
export type RemovePaymentReply = { kind: 'error'; message: string } | { kind: 'warning'; message: string } | { kind: 'ok' }

/** A non-empty `error` is a refusal; else a `warning` is a removal with a caveat; else it went through. */
export function removePaymentReply(raw: unknown): RemovePaymentReply {
  const payload = raw as { error?: unknown; warning?: unknown } | null
  if (payload && typeof payload === 'object' && typeof payload.error === 'string' && payload.error) return { kind: 'error', message: payload.error }
  if (payload && typeof payload === 'object' && payload.warning) return { kind: 'warning', message: payload.warning as string }
  return { kind: 'ok' }
}
