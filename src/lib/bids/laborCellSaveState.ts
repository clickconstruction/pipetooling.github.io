/**
 * Per-cell save state for the Labor tab's autosaved inputs (J11-F8).
 *
 * The tab saves everything on one 1.5 s debounce and used to say so only in a
 * "Saving..." line at the very bottom — 25 numeric inputs autosaved silently
 * with no accessible name. Each input now reports its own key when edited;
 * the autosave effect moves every `pending` key to `saving` when it starts
 * and drops them when it finishes, so the cell itself can show the state.
 *
 * Pure map transitions — the component holds the map in state.
 */

export type LaborCellSaveStatus = 'pending' | 'saving'
export type LaborCellSaveMap = Readonly<Record<string, LaborCellSaveStatus>>

export const EMPTY_LABOR_CELL_SAVE_MAP: LaborCellSaveMap = Object.freeze({})

/** An edit landed in `key`: it is pending until the next autosave picks it up. */
export function markLaborCellPending(map: LaborCellSaveMap, key: string): LaborCellSaveMap {
  if (map[key] === 'pending') return map
  return { ...map, [key]: 'pending' }
}

/** The autosave started: everything pending is now in flight. */
export function beginLaborCellSaves(map: LaborCellSaveMap): LaborCellSaveMap {
  let changed = false
  const next: Record<string, LaborCellSaveStatus> = {}
  for (const [k, v] of Object.entries(map)) {
    if (v === 'pending') changed = true
    next[k] = 'saving'
  }
  return changed ? next : map
}

/**
 * The autosave finished: in-flight cells are saved and leave the map. Cells
 * edited again while the save ran stay `pending` for the next round.
 */
export function finishLaborCellSaves(map: LaborCellSaveMap): LaborCellSaveMap {
  let changed = false
  const next: Record<string, LaborCellSaveStatus> = {}
  for (const [k, v] of Object.entries(map)) {
    if (v === 'saving') changed = true
    else next[k] = v
  }
  return changed ? next : map
}

/** The stage columns every Labor section shares. */
export const LABOR_STAGE_LABELS = { rough_in: 'Rough In', top_out: 'Top Out', trim_set: 'Trim Set' } as const
export type LaborStageKey = keyof typeof LABOR_STAGE_LABELS

/**
 * Accessible name for one grid cell: `Rough In hours per unit — Water Closet`,
 * `Trim Set dollars — Excavator rental (Equipment & Tool Rental)`. An unnamed
 * row falls back to `untitled row` so the label still says which column it is.
 */
export function laborCellAriaLabel(
  column: string,
  rowName: string | null | undefined,
  section?: string,
): string {
  const row = (rowName ?? '').trim() || 'untitled row'
  return section ? `${column} — ${row} (${section})` : `${column} — ${row}`
}

/** Tooltip / status text for a cell in the given state. */
export function laborCellStatusTitle(status: LaborCellSaveStatus | undefined): string | undefined {
  if (status === 'pending') return 'Unsaved — saves a moment after you stop typing'
  if (status === 'saving') return 'Saving…'
  return undefined
}
