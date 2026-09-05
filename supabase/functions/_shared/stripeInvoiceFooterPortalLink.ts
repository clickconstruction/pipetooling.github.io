/**
 * Stripe receipt → portal return path (journey-map J22-F3 / Tier-2 #38).
 *
 * Stripe's hosted invoice page has no post-payment redirect: the Invoice
 * object takes no `return_url` (that is a Checkout / Payment Link field —
 * verified against the API reference for the pinned 2024-06-20 version), so
 * after paying the customer sits on Stripe's receipt with nothing pointing
 * home. The one field that renders on the hosted page, the PDF and the
 * receipt is the invoice `footer` — so the portal link rides there.
 *
 * Pure kernel (no Deno, no Stripe): tested from
 * `src/lib/portal/stripeInvoiceFooterPortalLink.test.ts`.
 */
import { STRIPE_INVOICE_FOOTER_MAX_CHARS } from './stripeInvoiceFooter.ts'

/** The one sentence the customer reads on the receipt. */
export function portalReturnFooterLine(portalUrl: string): string {
  return `See your updated statement any time at ${portalUrl}`
}

/**
 * The footer the Stripe invoice is created with.
 *
 * - No portal URL → the custom footer as-is (trimmed; `null` when blank, so
 *   Stripe falls back to the account default).
 * - Portal URL, no custom footer → just the return line.
 * - Both → the custom footer keeps priority; the return line is appended
 *   after a blank line ONLY when the total stays within Stripe's footer cap
 *   (`STRIPE_INVOICE_FOOTER_MAX_CHARS`). Over the cap, the office's own
 *   footer wins untouched — never truncate what they typed.
 */
export function stripeInvoiceFooter(
  customFooter: string | null | undefined,
  portalUrl: string | null | undefined,
): string | null {
  const custom = (customFooter ?? '').trim()
  const url = (portalUrl ?? '').trim()
  if (!url) return custom || null
  const line = portalReturnFooterLine(url)
  if (!custom) return line.length <= STRIPE_INVOICE_FOOTER_MAX_CHARS ? line : null
  const joined = `${custom}\n\n${line}`
  return joined.length <= STRIPE_INVOICE_FOOTER_MAX_CHARS ? joined : custom
}
