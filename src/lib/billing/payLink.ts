/**
 * Pay links on the client (punch list #35, v2.3754): the address a QR code carries for one
 * bill, and the read of what the `pay-link` function answers. The pure kernel is shared with
 * the function (`supabase/functions/_shared/payLink.ts`); tests live beside this file.
 *
 * The address is always the public site's, never `window.location.origin`: a code is printed
 * on paper and scanned by a customer, so a code drawn on a dev server must still open the real
 * page.
 */
export {
  buildPayLinkPayload,
  formatPayLinkCents,
  isPayLinkId,
  parsePayLinkResponse,
  payLinkRowEligible,
  payLinkStateFrom,
  type PayLinkPayload,
  type PayLinkRow,
  type PayLinkState,
  type PayLinkStripeFacts,
} from '../../../supabase/functions/_shared/payLink'

/** The public site — GitHub Pages' CNAME (v2.2442); `pipetooling.com` redirects here. */
export const PAY_LINK_ORIGIN = 'https://clicktooling.com'

/** `/pay/<bill id>` — the route `src/pages/PayLink.tsx` serves. */
export function payLinkPath(invoiceId: string): string {
  return `/pay/${invoiceId.trim().toLowerCase()}`
}

/** The full address a code carries; `origin` is only overridden by tests. */
export function payLinkUrl(invoiceId: string, origin: string = PAY_LINK_ORIGIN): string {
  return `${origin.replace(/\/+$/, '')}${payLinkPath(invoiceId)}`
}

/** The address without its scheme, for the line printed in words under a code. */
export function payLinkDisplay(invoiceId: string): string {
  return payLinkUrl(invoiceId).replace(/^https?:\/\//, '')
}
