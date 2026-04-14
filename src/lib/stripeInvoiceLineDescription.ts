/** Keep in sync with `supabase/functions/_shared/stripeLineDescription.ts` (Edge). */
export const STRIPE_INVOICE_LINE_DESCRIPTION_MAX = 500

/** Default Stripe invoice line item description when the user has not overridden it. */
export const DEFAULT_STRIPE_INVOICE_LINE_DESCRIPTION = 'Custom service.'

/**
 * Legacy signature preserved for call sites; returns the fixed default line description.
 * (Previously: `Customer · Job · HCP n`.)
 */
export function buildStripeInvoiceLineDescription(
  _customerName: string,
  _jobName: string | null,
  _hcpNumber: string | null,
): string {
  return DEFAULT_STRIPE_INVOICE_LINE_DESCRIPTION
}
