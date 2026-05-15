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

function clampStripeFixtureLineDescription(text: string): string {
  const t = text.trim()
  if (t.length <= STRIPE_INVOICE_LINE_DESCRIPTION_MAX) return t
  return t.slice(0, STRIPE_INVOICE_LINE_DESCRIPTION_MAX)
}

/**
 * Final Stripe invoice line description string for one Specific Work fixture row after Edge rules.
 * Must stay in sync with `fixtureStripeDescription` in
 * `supabase/functions/_shared/stripeInvoiceItemsFromFixtures.ts`.
 */
export function buildFixtureStripeLineDescriptionForStripe(
  name: string,
  lineDescription: string | null | undefined,
): string {
  const n = (name ?? '').trim()
  const scope = (lineDescription ?? '').trim()
  let s = n
  if (scope) s = `${n} — ${scope}`
  if (!s.trim()) s = 'Line item'
  return clampStripeFixtureLineDescription(s)
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
