import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'

/** Stripe Invoice `description` (Bill Customer memo). */
export function stripeInvoiceDescriptionFromStripe(inv: Stripe.Invoice): string | null {
  const d = typeof inv.description === 'string' ? inv.description.trim() : ''
  return d || null
}

/** Stripe Invoice `footer` (per-invoice or account default materialized on the object). */
export function stripeInvoiceFooterFromStripe(inv: Stripe.Invoice): string | null {
  const f = typeof inv.footer === 'string' ? inv.footer.trim() : ''
  return f || null
}

/**
 * Legacy combined string for one-off display/backfill only.
 * Prefer {@link stripeInvoiceDescriptionFromStripe} + {@link stripeInvoiceFooterFromStripe} for DB columns.
 */
export function stripeInvoiceMemoFromStripe(inv: Stripe.Invoice): string | null {
  const d = stripeInvoiceDescriptionFromStripe(inv)
  const f = stripeInvoiceFooterFromStripe(inv)
  if (d && f && d !== f) return `${d}\n\n${f}`
  if (d) return d
  if (f) return f
  return null
}
