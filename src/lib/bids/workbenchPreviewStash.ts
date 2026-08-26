/**
 * Workbench preview stash (v2.2354): solver results and hand-typed prices are
 * previews until Apply, and the preview used to live only in component state —
 * so visiting any other tab silently destroyed it. Each price option now keeps
 * its own stash in sessionStorage: previews wait out navigation and reloads on
 * this device, never outlive the browser session, and never leave it. Nothing
 * here is customer-visible — Share/Print/Cover Letter read saved prices only.
 */

const KEY_PREFIX = 'bids_wb_preview_v1:'

/** The slice of Storage the stash needs — lets tests pass a plain fake. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function previewStashKey(pricingVersionId: string): string {
  return `${KEY_PREFIX}${pricingVersionId}`
}

/**
 * The stash for one price option, or null when absent/invalid/empty. Entries
 * that aren't finite numbers are dropped rather than poisoning the whole stash.
 */
export function readPreviewStash(storage: StorageLike, pricingVersionId: string): Record<string, number> | null {
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
  const preview: Record<string, number> = {}
  for (const [rowId, value] of Object.entries(parsed)) {
    if (typeof value === 'number' && Number.isFinite(value)) preview[rowId] = value
  }
  return Object.keys(preview).length > 0 ? preview : null
}

/** Persist (or, for null/empty, clear) one price option's stash. Storage failures are swallowed — the preview still lives in state. */
export function writePreviewStash(storage: StorageLike, pricingVersionId: string, preview: Record<string, number> | null): void {
  try {
    if (preview == null || Object.keys(preview).length === 0) {
      storage.removeItem(previewStashKey(pricingVersionId))
    } else {
      storage.setItem(previewStashKey(pricingVersionId), JSON.stringify(preview))
    }
  } catch {
    /* full or unavailable storage just means the preview won't survive navigation */
  }
}
