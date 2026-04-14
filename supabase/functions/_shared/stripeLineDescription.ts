/** Keep in sync with `src/lib/stripeInvoiceLineDescription.ts` (app UI clamp). Stripe line item description limit. */
export const STRIPE_INVOICE_LINE_DESCRIPTION_MAX = 500

/** Keep in sync with `src/lib/stripeInvoiceLineDescription.ts` (app preview copy). */
export const DEFAULT_STRIPE_INVOICE_LINE_DESCRIPTION = 'Custom service.'

/** Keep in sync with `src/lib/stripeInvoiceLineDescription.ts` (app preview copy). */
export function buildStripeInvoiceLineDescription(
  _customerName: string,
  _jobName: string | null,
  _hcpNumber: string | null,
): string {
  return DEFAULT_STRIPE_INVOICE_LINE_DESCRIPTION
}

export type ResolveInvoiceLineDescriptionResult =
  | { ok: true; lineDesc: string }
  | { ok: false; error: string }

/** Optional client override for the single invoice line item; else `buildStripeInvoiceLineDescription`. */
export function resolveInvoiceLineDescription(params: {
  override?: string | null
  customerName: string
  jobName: string | null
  hcpNumber: string | null
}): ResolveInvoiceLineDescriptionResult {
  const trimmed = typeof params.override === 'string' ? params.override.trim() : ''
  if (trimmed.length > 0) {
    if (trimmed.length > STRIPE_INVOICE_LINE_DESCRIPTION_MAX) {
      return {
        ok: false,
        error: `Line description too long (max ${STRIPE_INVOICE_LINE_DESCRIPTION_MAX} characters)`,
      }
    }
    return { ok: true, lineDesc: trimmed }
  }
  return {
    ok: true,
    lineDesc: buildStripeInvoiceLineDescription(params.customerName, params.jobName, params.hcpNumber),
  }
}
