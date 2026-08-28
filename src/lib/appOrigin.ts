/**
 * THE app's canonical public origin — the single client-side flip point for the
 * clicktooling.com domain cutover (v2.2440 prep; runbook: docs/DOMAIN_CUTOVER.md).
 *
 * Most client code correctly uses window.location.origin (right for whatever domain
 * served the page); this constant exists for the few places that need the canonical
 * origin with no window (SSR-ish fallbacks) or must name the production host
 * explicitly. On cutover day this value changes to 'https://clicktooling.com' — and
 * nothing else in src/ should hardcode the domain.
 *
 * Deliberately NOT centralized here (different lifecycles — see the runbook):
 *   - team@noreply.pipetooling.com — the email sending domain (Resend-verified; keeps
 *     working after the app moves; migrating it is separate, optional work).
 *   - share.pipetooling.com (jobShare.ts) and my.clickplumbing.com (portalShortOrigin) —
 *     Cloudflare-fronted subdomains with their own rules to update at cutover.
 */
export const APP_ORIGIN = 'https://clicktooling.com'

/** The production hostname (for "are we on the real app?" checks). */
export const APP_HOSTNAME = new URL(APP_ORIGIN).hostname

export function appUrl(path: string): string {
  return `${APP_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`
}
