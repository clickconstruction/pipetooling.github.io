/**
 * The workflow tabs' shared bid pointer, remembered across a refresh (J11-F2 / N2).
 *
 * Picking a bid stamps `bidId` into the URL; clicking a workflow tab deliberately
 * strips it again (v2.2043: a tab click means "take me to the page", never
 * "replay my deep-link jump"). So a refresh right after picking restored the bid
 * and a refresh after the next tab click lost it — users learned "refresh works"
 * and then it didn't. The pointer now also lives in `sessionStorage` (this tab
 * only, gone when the tab closes), and a workflow tab opened with no `bidId`
 * restores it silently — the URL semantics are untouched.
 */

export const SHARED_BID_POINTER_KEY = 'bids.sharedBidId'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function storage(explicit?: StorageLike | null): StorageLike | null {
  if (explicit !== undefined) return explicit
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

/** Remember (or, with null, forget) the selected bid. Never throws — storage may be unavailable. */
export function rememberSharedBidId(bidId: string | null, store?: StorageLike | null): void {
  const s = storage(store)
  if (!s) return
  try {
    if (bidId) s.setItem(SHARED_BID_POINTER_KEY, bidId)
    else s.removeItem(SHARED_BID_POINTER_KEY)
  } catch {
    /* quota / privacy mode — the pointer is a convenience only */
  }
}

/** The remembered bid id, or null. */
export function readSharedBidId(store?: StorageLike | null): string | null {
  const s = storage(store)
  if (!s) return null
  try {
    const v = s.getItem(SHARED_BID_POINTER_KEY)
    return v && v.trim() ? v : null
  } catch {
    return null
  }
}
