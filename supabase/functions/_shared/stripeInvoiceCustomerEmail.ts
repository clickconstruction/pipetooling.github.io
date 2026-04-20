import type Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'

/**
 * Payer email for UI and pre-send checks: expanded Customer.email first (matches
 * customers.update / Dashboard), then invoice.customer_email (guest / snapshot).
 * Same resolution for get-stripe-invoice-details and send-stripe-invoice.
 */
export function customerEmailFromStripeInvoice(inv: Stripe.Invoice): string {
  const cust = inv.customer
  if (cust != null && typeof cust === 'object' && !('deleted' in cust && (cust as { deleted?: boolean }).deleted)) {
    const c = cust as Stripe.Customer
    const em = typeof c.email === 'string' ? c.email.trim() : ''
    if (em) return em
  }
  const direct = typeof inv.customer_email === 'string' ? inv.customer_email.trim() : ''
  if (direct) return direct
  return ''
}
