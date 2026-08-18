/**
 * Pipeline board row sort mode (v2.1807): 'number' is the classic newest-
 * job-number-first order; 'added' orders rows inside every section by when
 * the job was added to the app (jobs_ledger.created_at, newest first).
 * Sections themselves never reorder — only the rows within them. The pick
 * lives in the ⋯ Pipeline tools menu and persists per device.
 */

export const STAGES_SORT_MODES = ['number', 'added'] as const

export type StagesBoardSortMode = (typeof STAGES_SORT_MODES)[number]

export const STAGES_SORT_MODE_LABELS: Record<StagesBoardSortMode, string> = {
  number: 'Newest job number',
  added: 'Most recently added',
}

import { formatDenverCalendarDayShort } from '../utils/dateUtils'

const STORAGE_KEY = 'pipetooling_pipeline_sort_v1'

/** Per-device persistence. Anything malformed degrades to the classic order — never break the board. */
export function loadStagesSortMode(): StagesBoardSortMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'added' ? 'added' : 'number'
  } catch {
    return 'number'
  }
}

export function saveStagesSortMode(mode: StagesBoardSortMode): void {
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
