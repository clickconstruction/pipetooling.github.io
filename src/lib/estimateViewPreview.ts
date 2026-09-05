/**
 * Office previews of the customer accept page must not count as customer opens
 * (journey-map Tier-2 #37 / #34, 2026-09-05). Every 200 from
 * `get-estimate-for-customer` used to stamp a `public_link_view`, so a staff
 * member pressing **Open customer link** to check their own work looked, on the
 * Pipeline, exactly like the customer opening it.
 *
 * The skip is decided on the client and carried as `?preview=1` on the edge-fn
 * call: the office's Open customer link appends the marker to the page URL, and
 * a signed-in staff session on the page adds it too. The edge function skips
 * the view RPC when it sees the marker. The marker can only *under*-count, so
 * it needs no server-side proof — a customer who forged it would only hide
 * their own open.
 */

export const ESTIMATE_VIEW_PREVIEW_PARAM = 'preview'

/** True when this page load is the office looking, not the customer. */
export function isEstimateViewStaffPreview(
  search: string | URLSearchParams | null | undefined,
  hasStaffSession: boolean,
): boolean {
  if (hasStaffSession) return true
  if (!search) return false
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  return params.get(ESTIMATE_VIEW_PREVIEW_PARAM) === '1'
}

/** Append `preview=1` to an accept-page URL (idempotent; leaves other params alone). */
export function withEstimatePreviewMarker(url: string): string {
  try {
    const u = new URL(url)
    u.searchParams.set(ESTIMATE_VIEW_PREVIEW_PARAM, '1')
    return u.toString()
  } catch {
    const sep = url.includes('?') ? '&' : '?'
    return url.includes(`${ESTIMATE_VIEW_PREVIEW_PARAM}=1`) ? url : `${url}${sep}${ESTIMATE_VIEW_PREVIEW_PARAM}=1`
  }
}

/** The edge-fn query string for the page's fetch: the token, plus the marker when this is a preview. */
export function estimateCustomerFetchQuery(token: string, preview: boolean): string {
  const q = new URLSearchParams({ token })
  if (preview) q.set(ESTIMATE_VIEW_PREVIEW_PARAM, '1')
  return q.toString()
}
