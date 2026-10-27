/**
 * The signing page's words when its link does not load (`/contract/accept`, P5b-1 of GC mode's trade portal,
 * to-dos/gc-mode/mockups/portal-p5b.md on spike/gc-mode). A 404 from `get-contract-for-signer` is a link that no longer
 * works: a newer link replaced it (a resend, the sub portal's sign_link, a trade opening its paper from its portal), or
 * the paper was taken back. The page serves every signer, most with no portal, and a dead token cannot say whose paper
 * it was, so the words name neither.
 */
export const CONTRACT_LINK_GONE_WORDS = 'This link no longer works. A newer link may have replaced it. Ask the office for a new link.'

/** A link the function answered `code: 'expired'`. */
export const CONTRACT_LINK_EXPIRED_WORDS = 'This link has expired. Ask the office for a new link.'

/**
 * The page's own words for a link that did not load: a dead link (404) or an expired one (`code: 'expired'`).
 * Anything else is null, and the page reads the failure's class or the function's own known sentence
 * (`lib/portal/portalFailure.ts`, v2.5965), never other server text.
 */
export function contractLinkErrorWords(status: number, code?: string | null): string | null {
  if (status === 404) return CONTRACT_LINK_GONE_WORDS
  if (code === 'expired') return CONTRACT_LINK_EXPIRED_WORDS
  return null
}
