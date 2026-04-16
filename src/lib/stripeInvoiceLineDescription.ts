/** Keep in sync with `supabase/functions/_shared/stripeLineDescription.ts` (Edge). */
export const STRIPE_INVOICE_LINE_DESCRIPTION_MAX = 500

/**
 * Length of the Stripe invoice line description for one Specific Work row **before** clamping.
 * Must stay in sync with `fixtureStripeDescription` in
 * `supabase/functions/_shared/stripeInvoiceItemsFromFixtures.ts` (name + optional ` — ` + scope).
 */
export function stripeInvoiceFixtureLineLength(name: string, lineDescription: string): number {
  const nameTrim = (name ?? '').trim()
  const scopeTrim = (lineDescription ?? '').trim()
  if (!scopeTrim) return nameTrim.length
  return nameTrim.length + 3 + scopeTrim.length
}

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
