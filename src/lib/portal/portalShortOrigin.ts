/**
 * The short customer-facing origin for custom portal addresses (portal
 * custom-links train). The globe modal's hero address and Copy button use
 * this; the token "Direct link" fallback always uses window.location.origin.
 *
 * Backed by the Cloudflare Worker `portal-link-shell` on the clickplumbing.com
 * zone (route my.clickplumbing.com/*, proxied A record `my` → 192.0.2.1):
 * serves the OG card shell (v2.2033) then bounces humans to
 * clicktooling.com/p/<slug> (v2.2495). Reference copy:
 * scripts/cloudflare/portal-link-shell.worker.js.
 */
export const PORTAL_SHORT_ORIGIN = 'https://my.clickplumbing.com/'

export function portalShortUrl(slug: string): string {
  return `${PORTAL_SHORT_ORIGIN}${slug}`
}
