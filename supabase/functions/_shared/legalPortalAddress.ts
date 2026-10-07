/**
 * The firm's portal address from its key (v2.4750). A key minted since v2.4750 is a slug —
 * the firm's name and a random tail, `snell-law-firm-pllc-k4tp9x2mq7zr` — and reads as a
 * short address on the customer-facing domain, like a GC's: my.clickplumbing.com/<key>.
 * The Worker there bounces to /p/<key>, the customer page finds no customer, probes the
 * legal portal and lands on /legal?t=<key>. A key minted before (64 hex characters) is not
 * a slug the short domain should carry, so it keeps the direct form on the app's origin.
 *
 * Shared by the office's link list (src/lib/legal/legalPortalAddress.ts re-exports this
 * file), legal-send-firm-link and legal-notify-dispatch, so every copy of a link reads the same.
 */

export const LEGAL_PORTAL_SHORT_ORIGIN = 'https://my.clickplumbing.com/'

/** A key the short domain carries through unchanged: lowercase letters, digits and dashes, 3 to 60 long. */
const SLUG_KEY = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/

export function isLegalPortalSlugKey(token: string): boolean {
  return SLUG_KEY.test(token)
}

/** The address to copy, send or print for one key. */
export function legalPortalAddress(origin: string, token: string): string {
  if (isLegalPortalSlugKey(token)) return `${LEGAL_PORTAL_SHORT_ORIGIN}${token}`
  return `${origin.replace(/\/$/, '')}/legal?t=${encodeURIComponent(token)}`
}

/** The same address without its scheme, the way it is read aloud or printed. */
export function legalPortalAddressWords(origin: string, token: string): string {
  return legalPortalAddress(origin, token).replace(/^https?:\/\//, '')
}
