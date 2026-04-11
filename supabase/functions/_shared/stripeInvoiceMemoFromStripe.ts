import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'

/** Customer-visible memo text: Stripe `description` and/or `footer` (Dashboard may use either). */
export function stripeInvoiceMemoFromStripe(inv: Stripe.Invoice): string | null {
  const d = typeof inv.description === 'string' ? inv.description.trim() : ''
  const f = typeof inv.footer === 'string' ? inv.footer.trim() : ''
  if (d && f && d !== f) return `${d}\n\n${f}`
  if (d) return d
  if (f) return f
  return null
}
