/**
 * The short customer-facing origin for custom portal addresses (portal
 * custom-links train). The globe modal's hero address and Copy button use
 * this; the token "Direct link" fallback always uses window.location.origin.
 *
 * Flip to 'https://my.clickplumbing.com/' once the Cloudflare redirect
 * (my.clickplumbing.com/* → pipetooling.com/p/*) is live — one-line PR.
 */
export const PORTAL_SHORT_ORIGIN = 'https://pipetooling.com/p/'

export function portalShortUrl(slug: string): string {
  return `${PORTAL_SHORT_ORIGIN}${slug}`
}
