/**
 * Takeoffs tab view switch (v2.2768, docs/TAKEOFFS_REFRESH_PLAN.md PR 0/1).
 *
 * Three views live on the selected-bid card during the parallel run:
 * `old` (today's tab), `new1` ("One at a time" — the guided pass), `new2`
 * ("Sheet" — the sheet with the cost rail). The ids are what devices have
 * stored, so they stay; only the labels were renamed for what each view is
 * for (v2.2990 — they were "New 1" / "New 2" during the build). The choice is
 * per device, like the Counts / Pricing / Cover Letter pills were
 * (v2.1906 / v2.1909), and defaults to `old` until retirement.
 */

export type TakeoffView = 'old' | 'new1' | 'new2'

export const TAKEOFF_VIEW_STORAGE_KEY = 'bids_takeoff_view_v1'

export const TAKEOFF_VIEWS: ReadonlyArray<{ id: TakeoffView; label: string; title: string }> = [
  { id: 'old', label: 'Old', title: 'The classic Takeoffs tab — the only view with By Stage' },
  { id: 'new1', label: 'One at a time', title: 'A guided pass, one fixture at a time, with the book and your last bids' },
  { id: 'new2', label: 'Sheet', title: 'The whole sheet, plus the cost rail: what Pricing sees, what needs a price, copy from a previous bid' },
]

/** The chooser's hotkeys (v2.3082): 1 · 2 · 3 in card order; anything else is null. */
export function viewForChooserKey(key: string): TakeoffView | null {
  const i = Number(key) - 1
  return Number.isInteger(i) && i >= 0 && i < TAKEOFF_VIEWS.length && key.length === 1 ? TAKEOFF_VIEWS[i]!.id : null
}

/** Pure: a stored value → a view; anything unknown (or nothing) is `old`. */
export function parseTakeoffView(raw: string | null | undefined): TakeoffView {
  return raw === 'new1' || raw === 'new2' ? raw : 'old'
}

/** Reads the device's remembered view; storage failures fall back to `old`. */
export function readStoredTakeoffView(storage: Pick<Storage, 'getItem'> | null | undefined): TakeoffView {
  try {
    return parseTakeoffView(storage?.getItem(TAKEOFF_VIEW_STORAGE_KEY))
  } catch {
    return 'old'
  }
}

/** Remembers the view on this device; storage failures are ignored (the device just won't remember). */
export function writeStoredTakeoffView(storage: Pick<Storage, 'setItem'> | null | undefined, view: TakeoffView): void {
  try {
    storage?.setItem(TAKEOFF_VIEW_STORAGE_KEY, view)
  } catch {
    /* device just won't remember */
  }
}
