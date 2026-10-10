/**
 * The signing page's words when its link does not load (`/contract/accept`, P5b-1 of GC mode's trade portal,
 * to-dos/gc-mode/mockups/portal-p5b.md on spike/gc-mode). A 404 from `get-contract-for-signer` is a link that no longer
 * works: a newer link replaced it (a resend, the sub portal's sign_link, a trade opening its paper from its portal), or
 * the paper was taken back. The page serves every signer, most with no portal, and a dead token cannot say whose paper
 * it was, so the words name neither.
 */
export const CONTRACT_LINK_GONE_WORDS = 'This link no longer works. A newer link may have replaced it. Ask the office for a new link.'

/** What the page says when the load was refused: the plain words for a dead link, else the function's own. */
export function contractLinkErrorWords(status: number, error: string | null | undefined): string {
  if (status === 404) return CONTRACT_LINK_GONE_WORDS
  return error || 'Unable to load contract.'
}
