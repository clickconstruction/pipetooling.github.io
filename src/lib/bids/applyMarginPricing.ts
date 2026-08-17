/**
 * Price-by-margin (v2.1769): the Pricing tab's toolbar that sets Sale Prices
 * from a target margin — unit price = (row cost ÷ (1 − margin)) ÷ count,
 * rounded to whole dollars, matching the grid's margin definition
 * (profit ÷ revenue). Pure helpers + the recent-margins memory (last three,
 * most recent first, localStorage — device-local by design).
 */

export const MARGIN_TARGET_MIN = 1
export const MARGIN_TARGET_MAX = 95
export const RECENT_MARGINS_STORAGE_KEY = 'bidPricingRecentMargins_v1'
export const RECENT_MARGINS_KEPT = 3

/** Whole percent in [1, 95], or null when the input isn't usable. */
export function normalizeMarginTarget(raw: string | number): number | null {
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n)) return null
  const rounded = Math.round(n)
  if (rounded < MARGIN_TARGET_MIN || rounded > MARGIN_TARGET_MAX) return null
  return rounded
}

/**
 * Whole-dollar unit price hitting the target margin for a row whose total
 * cost (labor + materials + tax) is `rowCost` across `count` units. Null when
 * there's no cost basis (uncosted rows are skipped, never priced at $0).
 */
export function unitPriceForTargetMargin(rowCost: number, count: number, marginPct: number): number | null {
  const m = normalizeMarginTarget(marginPct)
  if (m == null) return null
  if (!Number.isFinite(rowCost) || rowCost <= 0) return null
  if (!Number.isFinite(count) || count <= 0) return null
  const price = Math.round(rowCost / (1 - m / 100) / count)
  return price > 0 ? price : null
}

/** Most recent first, deduped, capped at three. */
export function updateRecentMargins(recents: number[], used: number): number[] {
  return [used, ...recents.filter((v) => v !== used)].slice(0, RECENT_MARGINS_KEPT)
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function loadRecentMargins(storage: StorageLike): number[] {
  try {
    const raw = storage.getItem(RECENT_MARGINS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((v) => normalizeMarginTarget(typeof v === 'number' || typeof v === 'string' ? v : NaN))
      .filter((v): v is number => v != null)
      .slice(0, RECENT_MARGINS_KEPT)
  } catch {
    return []
  }
}

export function saveRecentMargins(storage: StorageLike, recents: number[]): void {
  try {
    storage.setItem(RECENT_MARGINS_STORAGE_KEY, JSON.stringify(recents.slice(0, RECENT_MARGINS_KEPT)))
  } catch {
    /* storage full/blocked — the chips just won't persist */
  }
}
