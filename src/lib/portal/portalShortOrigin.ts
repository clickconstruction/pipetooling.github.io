/**
 * The short customer-facing origin for custom portal addresses (portal
 * custom-links train). The globe modal's hero address and Copy button use
 * this; the token "Direct link" fallback always uses window.location.origin.
 *
 * Backed by the Cloudflare redirect rule "portal short links" on the
 * clickplumbing.com zone (my.clickplumbing.com/* → 301 pipetooling.com/p/*,
 * proxied A record `my` → 192.0.2.1), live since 2026-08-21.
 */
export const PORTAL_SHORT_ORIGIN = 'https://my.clickplumbing.com/'

export function portalShortUrl(slug: string): string {
  return `${PORTAL_SHORT_ORIGIN}${slug}`
}
