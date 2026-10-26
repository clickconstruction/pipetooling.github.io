/**
 * The customer accept-URL's words and its per-tab memory (Estimates detail).
 *
 * The accept URL comes back from the send and resend edge calls and is shown
 * on the sent/accepted view; the page remembers it per estimate in
 * sessionStorage so a reload inside the tab still has it. A usable URL points
 * at /estimate/accept and carries a non-blank `t` token — the preview
 * sentinel and anything else never count. Storage reads and writes swallow
 * their errors (private windows, blocked site data).
 */

export const PREVIEW_EMAIL_ACCEPT_URL = 'https://example.com/estimate/accept?t=preview'

const ESTIMATE_ACCEPT_URL_SESSION_PREFIX = 'estimate_accept_url:'

export function isUsableCustomerAcceptUrl(url: string): boolean {
  const t = url.trim()
  if (!t || t === PREVIEW_EMAIL_ACCEPT_URL) return false
  try {
    const u = new URL(t)
    if (!u.pathname.includes('/estimate/accept')) return false
    if (!u.searchParams.get('t')?.trim()) return false
    return true
  } catch {
    return false
  }
}

export function normalizeCustomerAcceptUrlCandidate(raw: string | null | undefined): string | null {
  const s = raw?.trim()
  if (!s || !isUsableCustomerAcceptUrl(s)) return null
  return s
}

/** The stored value for this estimate, trimmed — or null when absent, blank, or storage is unusable. */
export function readStoredEstimateAcceptUrl(estimateId: string): string | null {
  try {
    if (typeof sessionStorage === 'undefined') return null
    const stored = sessionStorage.getItem(`${ESTIMATE_ACCEPT_URL_SESSION_PREFIX}${estimateId}`)
    const t = stored?.trim()
    return t || null
  } catch {
    return null
  }
}

export function storeEstimateAcceptUrl(estimateId: string, url: string): void {
  if (!estimateId) return
  try {
    if (typeof sessionStorage === 'undefined') return
    sessionStorage.setItem(`${ESTIMATE_ACCEPT_URL_SESSION_PREFIX}${estimateId}`, url)
  } catch {
    /* ignore */
  }
}
