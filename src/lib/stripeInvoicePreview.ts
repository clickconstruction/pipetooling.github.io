/** Line items + totals for UI (amounts in cents). Same shape as Edge `invoice_preview`. */
export type StripeInvoiceLinesSnapshot = {
  currency: string
  subtotal: number
  total: number
  amount_due: number
  lines: Array<{ description: string; amount: number }>
  /** Finalized Stripe invoice number (no # prefix). */
  invoice_number?: string | null
  customer_name?: string | null
  customer_email?: string | null
}

/** Successful JSON body from Edge `preview-stripe-invoice`. */
export type StripeInvoicePreviewSuccess = { success: true } & StripeInvoiceLinesSnapshot

export function parseStripeInvoiceLinesSnapshot(raw: unknown): StripeInvoiceLinesSnapshot | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const currency = o.currency
  if (typeof currency !== 'string' || !currency.trim()) return null
  const subtotal = o.subtotal
  const total = o.total
  const amount_due = o.amount_due
  if (typeof subtotal !== 'number' || Number.isNaN(subtotal)) return null
  if (typeof total !== 'number' || Number.isNaN(total)) return null
  if (typeof amount_due !== 'number' || Number.isNaN(amount_due)) return null
  if (!Array.isArray(o.lines)) return null
  const lines: Array<{ description: string; amount: number }> = []
  for (const item of o.lines) {
    if (item == null || typeof item !== 'object') return null
    const li = item as Record<string, unknown>
    const desc = typeof li.description === 'string' ? li.description : ''
    const amt = li.amount
    if (typeof amt !== 'number' || Number.isNaN(amt)) return null
    lines.push({ description: desc, amount: amt })
  }
  const out: StripeInvoiceLinesSnapshot = {
    currency: currency.trim(),
    subtotal,
    total,
    amount_due,
    lines,
  }
  if (typeof o.invoice_number === 'string' && o.invoice_number.trim()) {
    out.invoice_number = o.invoice_number.trim()
  }
  if (typeof o.customer_name === 'string' && o.customer_name.trim()) {
    out.customer_name = o.customer_name.trim()
  }
  if (typeof o.customer_email === 'string' && o.customer_email.trim()) {
    out.customer_email = o.customer_email.trim()
  }
  return out
}

/** Full successful `preview-stripe-invoice` body including `success: true`. */
export function parseStripeInvoicePreviewResponse(raw: unknown): StripeInvoicePreviewSuccess | null {
  if (raw == null || typeof raw !== 'object') return null
  const body = raw as Record<string, unknown>
  if (body.success !== true) return null
  const snap = parseStripeInvoiceLinesSnapshot(raw)
  if (!snap) return null
  return { success: true, ...snap }
}

export function formatStripeCents(cents: number, currency: string): string {
  const n = cents / 100
  if (currency.toLowerCase() === 'usd') {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `${n.toFixed(2)} ${currency.toUpperCase()}`
}
