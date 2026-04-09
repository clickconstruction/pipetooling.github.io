/** Successful JSON body from Edge `preview-stripe-invoice` (amounts in cents). */
export type StripeInvoicePreviewSuccess = {
  success: true
  currency: string
  subtotal: number
  total: number
  amount_due: number
  lines: Array<{ description: string; amount: number }>
}

export function formatStripeCents(cents: number, currency: string): string {
  const n = cents / 100
  if (currency.toLowerCase() === 'usd') {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `${n.toFixed(2)} ${currency.toUpperCase()}`
}
