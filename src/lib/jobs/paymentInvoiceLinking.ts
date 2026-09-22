/**
 * Manual payment ↔ invoice linking rules (v2.2240) — the Billing Truth Plan's
 * "payments always know their invoice" leak fix.
 *
 * A payment row that isn't applied to a bill can never feed the pay-speed
 * model (no bill date → no bill-to-paid gap), which is how ~155 hand-entered
 * check payments went unmeasured. These kernels drive the Edit-Job payments
 * table: default the Applies-to selector when the answer is unambiguous, flag
 * rows that still need a choice, and catch paid-before-billed dates (the
 * exact error class the HCP jobs-export import mass-produced).
 *
 * v2.3692: a bill that went out through Stripe records its payments through
 * Stripe — a card payment via the webhook, cash or a check via the Record
 * payment window (`record-stripe-invoice-out-of-band-payment`, which marks the
 * Stripe invoice paid and lets the webhook write the row). A hand-typed row
 * must therefore never attach itself to a Stripe bill: the Edit-Job table
 * draws any row on a Stripe bill read-only (it assumes Stripe wrote it), so
 * the old auto-default locked the row on its first keystroke and left the
 * app counting cash Stripe never heard of. `openStripeBills` is what the
 * table offers the hand-off to instead.
 */

export type LinkableInvoiceSlice = {
  id: string
  status: string
  billed_at?: string | null
  estimated_bill_date?: string | null
  /** Set when the bill is a hosted Stripe invoice. */
  stripe_invoice_id?: string | null
  /** 'stripe' when the bill went out through Stripe (set by create-stripe-invoice). */
  external_send_channel?: string | null
}

type LinkablePaymentSlice = {
  amount: number | string | null
  invoice_id: string | null
  paid_on?: string | null
}

/**
 * True when the bill's payments are recorded through Stripe — the row has a
 * Stripe invoice id, or it was sent through Stripe. The single definition;
 * `jobsLedgerInvoiceIsStripeLinked` (the form predicates) delegates here.
 */
export function invoiceRecordsThroughStripe(inv: Pick<LinkableInvoiceSlice, 'stripe_invoice_id' | 'external_send_channel'>): boolean {
  if ((inv.stripe_invoice_id ?? '').trim()) return true
  return (inv.external_send_channel ?? '').trim() === 'stripe'
}

/** The job's open bills that a hand-typed payment may apply to: billed, and not Stripe's. */
function handTypedBillsOf(invoices: LinkableInvoiceSlice[] | null | undefined): LinkableInvoiceSlice[] {
  return (invoices ?? []).filter((i) => i.status === 'billed' && !invoiceRecordsThroughStripe(i))
}

/**
 * The job's open Stripe bills — the ones a hand-typed row cannot attach to,
 * and the targets the table's "Record on the bill" hand-off offers instead.
 */
export function openStripeBills<T extends LinkableInvoiceSlice>(invoices: T[] | null | undefined): T[] {
  return (invoices ?? []).filter((i) => i.status === 'billed' && invoiceRecordsThroughStripe(i))
}

/**
 * The invoice a fresh manual payment should default to: the job's single
 * open, non-Stripe bill. Two or more is a real choice (null — the selector
 * asks); zero means there's nothing a hand-typed row can link to (null).
 * A Stripe bill never counts, even when it is the only open bill.
 */
export function autoApplyInvoiceId(invoices: LinkableInvoiceSlice[] | null | undefined): string | null {
  const billed = handTypedBillsOf(invoices)
  return billed.length === 1 ? billed[0]!.id : null
}

/**
 * True when a real (positive-amount) unlinked payment sits on a job that has
 * open non-Stripe bills it could apply to — the row the office should finish
 * linking. Jobs whose only open bills are Stripe's don't flag here: those
 * rows get the Stripe hand-off note instead (`openStripeBills`).
 */
export function paymentRowNeedsInvoiceLink(
  row: LinkablePaymentSlice,
  invoices: LinkableInvoiceSlice[] | null | undefined,
): boolean {
  if (row.invoice_id) return false
  if (!(Number(row.amount) > 0)) return false
  return handTypedBillsOf(invoices).length > 0
}

/** The linked invoice's bill reference day (YYYY-MM-DD): billed_at's date part, else the est. bill date. */
function invoiceBilledYmd(inv: LinkableInvoiceSlice | undefined): string | null {
  if (!inv) return null
  const billed = (inv.billed_at ?? '').trim()
  if (billed.length >= 10) return billed.slice(0, 10)
  const est = (inv.estimated_bill_date ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}/.test(est) ? est.slice(0, 10) : null
}

/**
 * True when the row's paid date lands strictly before its linked invoice's
 * bill date — money can't arrive for a bill that hasn't gone out, so this is
 * almost always a typo'd date (or a date imported with the wrong meaning).
 * Same-day pay is legitimate and does not warn.
 */
export function paymentDateBeforeBilled(
  row: LinkablePaymentSlice,
  invoices: LinkableInvoiceSlice[] | null | undefined,
): boolean {
  const paid = (row.paid_on ?? '').trim()
  if (!row.invoice_id || !/^\d{4}-\d{2}-\d{2}/.test(paid)) return false
  const billedYmd = invoiceBilledYmd((invoices ?? []).find((i) => i.id === row.invoice_id))
  if (!billedYmd) return false
  return paid.slice(0, 10) < billedYmd
}
