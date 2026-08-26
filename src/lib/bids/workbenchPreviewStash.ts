/**
 * Workbench preview stash (v2.2354, reworked v2.2373): solver results are
 * previews until Apply, and the stash is what lets them outlive navigation.
 * v2.2354 kept it in sessionStorage — which dies with the tab, exactly the
 * "leave" an estimator means (close the laptop, reopen tomorrow). Each price
 * option now keeps its stash in localStorage instead: previews wait on this
 * device — across reloads, tab closes, and parallel tabs — until Apply or
 * Discard. `at` records the last change so a restore can say how old the
 * solve is. Nothing here is customer-visible — Share/Print/Cover Letter read
 * saved prices only.
 */

// v2 bump: the payload grew a written-at timestamp and the store moved from
// sessionStorage to localStorage, so v1 keys just age out with their tabs.
const KEY_PREFIX = 'bids_wb_preview_v2:'

/** The slice of Storage the stash needs — lets tests pass a plain fake. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type PreviewStash = {
  /** Previewed unit prices by count-row id. */
  prices: Record<string, number>
  /** Epoch ms of the last change — lets the strip label a restored solve's age. */
  at: number
}

export function previewStashKey(pricingVersionId: string): string {
  return `${KEY_PREFIX}${pricingVersionId}`
}

/**
 * The stash for one price option, or null when absent/invalid/empty. Entries
 * that aren't finite numbers are dropped rather than poisoning the whole stash.
 */
export function readPreviewStash(storage: StorageLike, pricingVersionId: string): PreviewStash | null {
  let raw: string | null
  try {
    raw = storage.getItem(previewStashKey(pricingVersionId))
  } catch {
    return null
  }
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const { prices: rawPrices, at: rawAt } = parsed as { prices?: unknown; at?: unknown }
  if (typeof rawPrices !== 'object' || rawPrices === null || Array.isArray(rawPrices)) return null
  const prices: Record<string, number> = {}
  for (const [rowId, value] of Object.entries(rawPrices)) {
    if (typeof value === 'number' && Number.isFinite(value)) prices[rowId] = value
  }
  if (Object.keys(prices).length === 0) return null
  const at = typeof rawAt === 'number' && Number.isFinite(rawAt) ? rawAt : 0
  return { prices, at }
}

/** Persist (or, for null/empty, clear) one price option's stash. Storage failures are swallowed — the preview still lives in state. */
export function writePreviewStash(
  storage: StorageLike,
  pricingVersionId: string,
  prices: Record<string, number> | null,
  at: number
): void {
  try {
    if (prices == null || Object.keys(prices).length === 0) {
      storage.removeItem(previewStashKey(pricingVersionId))
    } else {
      const stash: PreviewStash = { prices, at }
      storage.setItem(previewStashKey(pricingVersionId), JSON.stringify(stash))
    }
  } catch {
    /* full or unavailable storage just means the preview won't survive navigation */
  }
}
