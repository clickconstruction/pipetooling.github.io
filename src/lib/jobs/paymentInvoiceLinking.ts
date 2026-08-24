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
 */

export type LinkableInvoiceSlice = {
  id: string
  status: string
  billed_at?: string | null
  estimated_bill_date?: string | null
}

type LinkablePaymentSlice = {
  amount: number | string | null
  invoice_id: string | null
  paid_on?: string | null
}

/** The job's open bills — the only invoices a manual payment can apply to. */
function billedOf(invoices: LinkableInvoiceSlice[] | null | undefined): LinkableInvoiceSlice[] {
  return (invoices ?? []).filter((i) => i.status === 'billed')
}

/**
 * The invoice a fresh manual payment should default to: the job's single
 * billed invoice. Two or more open bills is a real choice (null — the
 * selector asks); zero open bills means there's nothing to link (null).
 */
export function autoApplyInvoiceId(invoices: LinkableInvoiceSlice[] | null | undefined): string | null {
  const billed = billedOf(invoices)
  return billed.length === 1 ? billed[0]!.id : null
}

/**
 * True when a real (positive-amount) unlinked payment sits on a job that has
 * open bills it could apply to — the row the office should finish linking.
 * Jobs with no billed invoices don't flag: there is nothing to pick.
 */
export function paymentRowNeedsInvoiceLink(
  row: LinkablePaymentSlice,
  invoices: LinkableInvoiceSlice[] | null | undefined,
): boolean {
  if (row.invoice_id) return false
  if (!(Number(row.amount) > 0)) return false
  return billedOf(invoices).length > 0
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
