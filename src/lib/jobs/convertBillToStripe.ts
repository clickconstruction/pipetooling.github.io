/**
 * Convert-a-bill-to-Stripe eligibility + inputs (v2.2045): a BILLED invoice
 * line recorded outside Stripe (HouseCall Pro / physical / plain) can gain
 * the real hosted Stripe invoice with one button. The ledger's billed_at is
 * preserved by construction server-side; these kernels decide when the
 * button shows and what due date / memo the conversion sends.
 */

type ConvertInvoicePick = {
  id: string
  status: string | null
  stripe_invoice_id: string | null
  external_send_channel: string | null
  amount: number | null
}

type ConvertPaymentPick = { invoice_id: string | null }

type ConvertJobPick = {
  customer_id: string | null
  customer_email: string | null
}

export type ConvertToStripeEligibility = { ok: true } | { ok: false; reason: string }

/**
 * The button renders only when conversion can actually succeed; when close
 * but blocked (payments applied / missing email) the caller may show it
 * disabled with the reason as the tooltip.
 */
export function convertToStripeEligibility(
  invoice: ConvertInvoicePick,
  payments: ConvertPaymentPick[],
  job: ConvertJobPick,
): ConvertToStripeEligibility {
  if (invoice.status !== 'billed') return { ok: false, reason: 'Only billed lines can convert.' }
  if (invoice.stripe_invoice_id || invoice.external_send_channel === 'stripe') {
    return { ok: false, reason: 'Already a Stripe bill.' }
  }
  if (!(Number(invoice.amount ?? 0) > 0)) return { ok: false, reason: 'No amount on this line.' }
  if (!job.customer_id) return { ok: false, reason: 'Link a customer to this job first (Edit tab).' }
  if (!(job.customer_email ?? '').trim()) {
    return { ok: false, reason: 'Add a customer email first (Edit tab) — Stripe needs one.' }
  }
  if (payments.some((p) => p.invoice_id === invoice.id)) {
    return {
      ok: false,
      reason: 'Payments are applied to this bill — unlink them first (Payments received below).',
    }
  }
  return { ok: true }
}

/**
 * Due date sent to create-stripe-invoice: the ORIGINAL billed date. Stripe
 * refuses past due dates — the server's daysUntilDue clamps to 1 day, i.e.
 * "due now" — but passing the real date makes the Stripe invoice NUMBER
 * inherit it (880-<YYMMDD>…), so the paperwork carries the true date.
 * Falls back to today when the row somehow has no billed_at.
 */
export function convertDueDateYmd(billedAt: string | null, todayYmd: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(billedAt ?? '')
  return m ? m[1]! : todayYmd
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "July 6, 2026" from a YMD/ISO string, TZ-safe (no Date parsing of bare dates). */
export function formatConvertLongDate(billedAt: string | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(billedAt ?? '')
  if (!m) return null
  const month = MONTHS[Number(m[2]) - 1]
  if (!month) return null
  return `${month} ${Number(m[3])}, ${m[1]}`
}

/** Memo line for the converted Stripe invoice — the customer-visible true story. */
export function convertMemoLine(billedAt: string | null): string {
  const long = formatConvertLongDate(billedAt)
  return long
    ? `Originally billed ${long} — payment due on receipt.`
    : 'Payment due on receipt.'
}
