/**
 * Takeoffs tab view switch (v2.2768, docs/TAKEOFFS_REFRESH_PLAN.md PR 0/1).
 *
 * Three views live on the selected-bid card during the parallel run:
 * `old` (today's tab), `new1` ("One fixture at a time"), `new2` ("Cost rail").
 * The choice is per device, like the Counts / Pricing / Cover Letter pills
 * were (v2.1906 / v2.1909), and defaults to `old` until retirement.
 */

export type TakeoffView = 'old' | 'new1' | 'new2'

export const TAKEOFF_VIEW_STORAGE_KEY = 'bids_takeoff_view_v1'

export const TAKEOFF_VIEWS: ReadonlyArray<{ id: TakeoffView; label: string; title: string }> = [
  { id: 'old', label: 'Old', title: 'The Takeoffs tab as it is today' },
  { id: 'new1', label: 'New 1', title: 'One fixture at a time — a guided pass with the book and your last bids' },
  { id: 'new2', label: 'New 2', title: 'Cost rail — the sheet plus what Pricing sees' },
]

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
