/**
 * Pipeline board row sort mode (v2.1807): 'number' is the classic newest-
 * job-number-first order; 'added' orders rows inside every section by when
 * the job was added to the app (jobs_ledger.created_at, newest first);
 * 'progress' (v2.3408) orders them by % complete, 0 → 100, and is reached by
 * clicking the "Progress & payment" column header (or the ⋯ menu's Sort group).
 * 'next' (v2.3788) puts the next booked visit first — today's, then later
 * this week, then the unbooked rows oldest-last-worked first, finished rows
 * last — and is reached from the Working header's ⇅ Next first button or the
 * ⋯ menu. Sections themselves never reorder — only the rows within them.
 * 'added' and 'next' persist per device; 'progress' is a look, not a
 * setting — it is never written to storage, so leaving the board and coming
 * back drops it.
 */

export const STAGES_SORT_MODES = ['number', 'added', 'next', 'progress'] as const

export type StagesBoardSortMode = (typeof STAGES_SORT_MODES)[number]

export const STAGES_SORT_MODE_LABELS: Record<StagesBoardSortMode, string> = {
  number: 'Newest job number',
  added: 'Most recently added',
  next: 'Next scheduled first',
  progress: 'Percent complete (0 → 100)',
}

/** The "Sorted: … ×" chip beside the ⋯ button while a non-default order is on. */
export const STAGES_SORT_MODE_ACTIVE_CHIP_LABELS: Record<Exclude<StagesBoardSortMode, 'number'>, string> = {
  added: 'time added',
  next: 'next first',
  progress: '% complete',
}

/** Modes the device remembers. 'progress' is deliberately absent — see the header comment. */
const PERSISTED_SORT_MODES: ReadonlySet<StagesBoardSortMode> = new Set(['number', 'added', 'next'])

/** The header click: 'progress' toggles back to the classic order, anything else turns it on. */
export function toggleStagesProgressSort(current: StagesBoardSortMode): StagesBoardSortMode {
  return current === 'progress' ? 'number' : 'progress'
}

/** The Working header's ⇅ button: 'next' toggles back to the classic order, anything else turns it on. */
export function toggleStagesNextFirstSort(current: StagesBoardSortMode): StagesBoardSortMode {
  return current === 'next' ? 'number' : 'next'
}

import { formatDenverCalendarDayShort } from '../utils/dateUtils'

const STORAGE_KEY = 'pipetooling_pipeline_sort_v1'

/** Per-device persistence. Anything malformed degrades to the classic order — never break the board. */
export function loadStagesSortMode(): StagesBoardSortMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'added' || raw === 'next' ? raw : 'number'
  } catch {
    return 'number'
  }
}

export function saveStagesSortMode(mode: StagesBoardSortMode): void {
  // A session-only mode leaves the remembered pick alone: the board comes back
  // the way the device had it (classic, or time added) after the look ends.
  if (!PERSISTED_SORT_MODES.has(mode)) return
  try {
    if (mode === 'number') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    /* quota/private mode: the pick becomes session-only — never break the board */
  }
}

/** Short "added Aug 18" stamp (company calendar TZ) for board rows while sorting by time added. */
export function stagesAddedStampLabel(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null
  const ms = Date.parse(createdAt)
  if (!Number.isFinite(ms)) return null
  return `added ${formatDenverCalendarDayShort(ms)}`
}
