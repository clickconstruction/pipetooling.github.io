/**
 * Per-device Stages section-open persistence (v2.1824, scoped-load plan PR 3).
 * Whatever sections you leave open are what the board fetches next visit;
 * fresh devices open Ready to Bill only (owner-picked default). Shared between
 * the board (reads/writes on toggle) and Jobs.tsx (reads before the first
 * fetch to decide which scopes the initial load needs).
 */
import type { JobsBoardScope } from './boardScopes'

export type StagesSectionOpenState = {
  waiting: boolean
  working: boolean
  readyToBill: boolean
  billed: boolean
  collections: boolean
  paid: boolean
}

export const STAGES_SECTION_PREFS_KEY = 'pipetooling_stages_sections_v2'

export const STAGES_SECTION_DEFAULT_OPEN: StagesSectionOpenState = {
  waiting: false,
  working: false,
  readyToBill: true,
  billed: false,
  collections: false,
  paid: false,
}

export function readStagesSectionOpenPrefs(
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
): StagesSectionOpenState {
  try {
    const raw = storage?.getItem(STAGES_SECTION_PREFS_KEY)
    if (!raw) return { ...STAGES_SECTION_DEFAULT_OPEN }
    const parsed = JSON.parse(raw) as Partial<Record<keyof StagesSectionOpenState, unknown>>
    const bool = (k: keyof StagesSectionOpenState) =>
      typeof parsed[k] === 'boolean' ? (parsed[k] as boolean) : STAGES_SECTION_DEFAULT_OPEN[k]
    return {
      waiting: bool('waiting'),
      working: bool('working'),
      readyToBill: bool('readyToBill'),
      billed: bool('billed'),
      collections: bool('collections'),
      paid: bool('paid'),
    }
  } catch {
    return { ...STAGES_SECTION_DEFAULT_OPEN }
  }
}

export function writeStagesSectionOpenPrefs(
  open: StagesSectionOpenState,
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
): void {
  try {
    storage?.setItem(STAGES_SECTION_PREFS_KEY, JSON.stringify(open))
  } catch {
    /* per-device nicety only */
  }
}

/** The board section each cache scope feeds (billed + collections share one fetch). */
export function scopeForStagesSection(section: keyof StagesSectionOpenState): JobsBoardScope {
  switch (section) {
    case 'waiting':
      return 'waiting'
    case 'working':
      return 'working'
    case 'readyToBill':
      return 'ready_to_bill'
    case 'billed':
    case 'collections':
      return 'billed_all'
    case 'paid':
      return 'paid'
  }
}

/** Distinct scopes the given open-set needs fetched (deduped; stable order). */
export function scopesForOpenStagesSections(open: StagesSectionOpenState): JobsBoardScope[] {
  const out: JobsBoardScope[] = []
  for (const section of Object.keys(open) as Array<keyof StagesSectionOpenState>) {
    if (!open[section]) continue
    const scope = scopeForStagesSection(section)
    if (!out.includes(scope)) out.push(scope)
  }
  return out
}
