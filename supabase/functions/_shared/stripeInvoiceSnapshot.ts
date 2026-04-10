import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'

/** Plain JSON shape aligned with app `StripeInvoiceLinesSnapshot` (amounts in cents). */
export function stripeInvoiceToPreviewPayload(inv: Stripe.Invoice): {
  currency: string
  subtotal: number
  total: number
  amount_due: number
  lines: Array<{ description: string; amount: number }>
  invoice_number: string | null
  customer_name: string | null
  customer_email: string | null
} {
  const rawLines = inv.lines?.data ?? []
  const lines = rawLines.map((li) => ({
    description: li.description ?? '',
    amount: typeof li.amount === 'number' ? li.amount : 0,
  }))
  const num = inv.number
  const cname = inv.customer_name
  const cemail = inv.customer_email
  return {
    currency: inv.currency ?? 'usd',
    subtotal: inv.subtotal ?? 0,
    total: inv.total ?? 0,
    amount_due: inv.amount_due ?? inv.total ?? 0,
    lines,
    invoice_number: typeof num === 'string' && num.trim() ? num.trim() : null,
    customer_name: typeof cname === 'string' && cname.trim() ? cname.trim() : null,
    customer_email: typeof cemail === 'string' && cemail.trim() ? cemail.trim() : null,
  }
}

/** Ensure line items are populated (finalize response may omit expanded lines). */
export async function stripeInvoiceSnapshotForResponse(
  stripe: Stripe,
  inv: Stripe.Invoice,
): Promise<ReturnType<typeof stripeInvoiceToPreviewPayload>> {
  let payload = stripeInvoiceToPreviewPayload(inv)
  if (payload.lines.length > 0) return payload
  const full = await stripe.invoices.retrieve(inv.id, { expand: ['lines.data'] })
  payload = stripeInvoiceToPreviewPayload(full)
  return payload
}
