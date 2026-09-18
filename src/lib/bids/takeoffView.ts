/**
 * Takeoffs tab view switch (v2.2768, docs/TAKEOFFS_REFRESH_PLAN.md PR 0/1;
 * Old retired v2.3588).
 *
 * Two views live on the selected-bid card of a Combined bid: `new1` ("One at
 * a time" — the guided pass) and `new2` ("Sheet" — the sheet with the cost
 * rail). The ids are what devices have stored during the parallel run, so
 * they stay; the labels say what each view is for (v2.2990). The choice is
 * per device, like the Counts / Pricing / Cover Letter pills were
 * (v2.1906 / v2.1909), and defaults to One at a time. A device that had
 * picked the retired `old` lands on One at a time and is not asked again.
 * By Stage bids have no view switch — they keep the classic editor.
 */

export type TakeoffView = 'new1' | 'new2'

export const TAKEOFF_VIEW_STORAGE_KEY = 'bids_takeoff_view_v1'

export const DEFAULT_TAKEOFF_VIEW: TakeoffView = 'new1'

export const TAKEOFF_VIEWS: ReadonlyArray<{ id: TakeoffView; label: string; title: string }> = [
  { id: 'new1', label: 'One at a time', title: 'A guided pass, one fixture at a time, with the book and your last bids' },
  { id: 'new2', label: 'Sheet', title: 'The whole sheet, plus the cost rail: what Pricing sees, what needs a price, copy from a previous bid' },
]

/** The chooser's hotkeys (v2.3082): 1 · 2 in card order; anything else is null. */
export function viewForChooserKey(key: string): TakeoffView | null {
  const i = Number(key) - 1
  return Number.isInteger(i) && i >= 0 && i < TAKEOFF_VIEWS.length && key.length === 1 ? TAKEOFF_VIEWS[i]!.id : null
}

/** Pure: a stored value → a view; anything unknown (or nothing, or the retired `old`) is One at a time. */
export function parseTakeoffView(raw: string | null | undefined): TakeoffView {
  return raw === 'new2' ? 'new2' : DEFAULT_TAKEOFF_VIEW
}

/**
 * Has this device ever picked a view (v2.3165)? The chooser asks only while this
 * is false — one pick (from the box or the pills) is remembered and opens straight
 * away from then on. A pick of the retired `old` still counts: that device lands
 * on One at a time without being asked again. Storage failures read as "never
 * picked", so a device that cannot remember keeps asking rather than silently
 * landing on a view.
 */
export function hasStoredTakeoffView(storage: Pick<Storage, 'getItem'> | null | undefined): boolean {
  try {
    const raw = storage?.getItem(TAKEOFF_VIEW_STORAGE_KEY)
    return raw === 'old' || raw === 'new1' || raw === 'new2'
  } catch {
    return false
  }
}

/** Reads the device's remembered view; storage failures fall back to One at a time. */
export function readStoredTakeoffView(storage: Pick<Storage, 'getItem'> | null | undefined): TakeoffView {
  try {
    return parseTakeoffView(storage?.getItem(TAKEOFF_VIEW_STORAGE_KEY))
  } catch {
    return DEFAULT_TAKEOFF_VIEW
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
