/**
 * Bids → Labor view switch (v2.3275, the Labor refresh PR 1 — `to-dos/bids-labor-refresh/`).
 *
 * Two views live on the selected-bid card during the parallel run, the same
 * way Takeoffs ran Old beside One at a time / Sheet (`takeoffView.ts`):
 * `old` (today's HOURS grid) and `new` ("Hours that learn" — the completeness
 * meter and sanity strip, the queue of rows the book could not answer, and the
 * grid with a source chip on every row). The choice is per device and defaults
 * to `old` until retirement.
 */

export type LaborView = 'old' | 'new'

export const LABOR_VIEW_STORAGE_KEY = 'bids_labor_view_v1'

export const LABOR_VIEWS: ReadonlyArray<{ id: LaborView; label: string; title: string }> = [
  { id: 'old', label: 'Old', title: 'The classic HOURS grid: every row, every cell' },
  { id: 'new', label: 'New', title: 'Hours that learn: the rows the book could not answer first, a source on every row, and whether the whole bid makes sense' },
]

/** Pure: a stored value → a view; anything unknown (or nothing) is `old`. */
export function parseLaborView(raw: string | null | undefined): LaborView {
  return raw === 'new' ? 'new' : 'old'
}

/** Reads the device's remembered view; storage failures fall back to `old`. */
export function readStoredLaborView(storage: Pick<Storage, 'getItem'> | null | undefined): LaborView {
  try {
    return parseLaborView(storage?.getItem(LABOR_VIEW_STORAGE_KEY))
  } catch {
    return 'old'
  }
}

/** Remembers the view on this device; storage failures are ignored (the device just won't remember). */
export function writeStoredLaborView(storage: Pick<Storage, 'setItem'> | null | undefined, view: LaborView): void {
  try {
    storage?.setItem(LABOR_VIEW_STORAGE_KEY, view)
  } catch {
    /* device just won't remember */
  }
}
