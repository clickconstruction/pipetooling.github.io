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

/**
 * The host the estimate text's link rides (v2.6678, punch list #281 PR 3): the same Worker answers
 * `my.clickplumbing.com/e/<code>` with a 301 to the app's `/e/:code` route, lower-cased, before the
 * slug check (the rule went live 2026-11-08 and a curl of `/e/abc` answers 301). Null would send the
 * text back to the accept page on the app's own origin (`estimateTextShareUrl`). The apex is served
 * by GitHub Pages with no Cloudflare proxy, so it could not carry a redirect rule.
 */
export const ESTIMATE_SHORT_ORIGIN: string | null = 'https://my.clickplumbing.com'

/** `https://my.clickplumbing.com/e/<code>` for a code. */
export function estimateShortUrl(code: string, origin: string = ESTIMATE_SHORT_ORIGIN ?? PORTAL_SHORT_ORIGIN): string {
  return `${origin.replace(/\/$/, '')}/e/${encodeURIComponent(code)}`
}

/**
 * The host the bill text's link rides (v2.6768, punch list #290): the same Worker answers
 * `my.clickplumbing.com/pay/<bill id or code>` with a 301 to the app's `/pay/:id` route, lower-cased, before the slug
 * check. That page asks Stripe for the bill's current payment link when it is opened, so the texted link never
 * expires as Stripe's own does. Null would send the text back to `clicktooling.com/pay/<id>` (`billTextLink`).
 */
export const BILL_SHORT_ORIGIN: string | null = 'https://my.clickplumbing.com'

/** `https://my.clickplumbing.com/pay/<bill id or code>`; the app's own origin when the short host is null. */
export function billShortUrl(idOrCode: string, origin: string = BILL_SHORT_ORIGIN ?? 'https://clicktooling.com'): string {
  return `${origin.replace(/\/$/, '')}/pay/${encodeURIComponent(idOrCode.trim().toLowerCase())}`
}
