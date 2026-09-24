/**
 * The assistant's Hiring tab, PR 6 (to-dos/helper-tryout-loop): what a column-share holder is
 * shown. The database already refuses everything outside the share (`20260924040000`); this only
 * keeps the board from offering what would be refused, and words the trimmed board.
 *
 * Pure: no React, no supabase.
 */
export type HiringStage = 'screen' | 'interview' | 'tryout' | 'hire' | 'review'

const ALL_STAGES: readonly HiringStage[] = ['screen', 'interview', 'tryout', 'hire', 'review']
/** A share sees the three stages its cards can be on. Hire and Review are the office's. */
export const SHARED_STAGES: readonly HiringStage[] = ['screen', 'interview', 'tryout']

export function stageAllowed(stage: HiringStage, shared: boolean): boolean {
  return shared ? SHARED_STAGES.includes(stage) : true
}

/** The `?stage=` deep link: a known stage the viewer may open, else null (stay where you are). */
export function coerceStage(wanted: string | null, shared: boolean): HiringStage | null {
  if (!wanted || !(ALL_STAGES as readonly string[]).includes(wanted)) return null
  const stage = wanted as HiringStage
  return stageAllowed(stage, shared) ? stage : null
}

export type HiringTabPowers = {
  /** Passed on a Screen / Interview card. */
  canPass: boolean
  /** Advance to Hire, and Hire / Pass / Keep trying on a Try-out card. */
  canHire: boolean
  /** Delete a candidate; merge a duplicate (which deletes one). */
  canDelete: boolean
  /** + Add role. */
  canAddRole: boolean
  /** The column header's ⋯ (Share with…, Delete column). */
  canManageColumn: boolean
  /** The virtual Unsorted column, and Unsorted in the Role picker. */
  showUnsorted: boolean
  /** The Passed bucket under the board. */
  showPassed: boolean
  /** The Source success table. */
  showSources: boolean
  /** Talked today on a Try-out card — a trial row is the office's. */
  canEditTrialCard: boolean
}

const FULL: HiringTabPowers = {
  canPass: true, canHire: true, canDelete: true, canAddRole: true, canManageColumn: true,
  showUnsorted: true, showPassed: true, showSources: true, canEditTrialCard: true,
}
const SHARED: HiringTabPowers = {
  canPass: false, canHire: false, canDelete: false, canAddRole: false, canManageColumn: false,
  showUnsorted: false, showPassed: false, showSources: false, canEditTrialCard: false,
}

export function hiringTabPowers(shared: boolean): HiringTabPowers {
  return shared ? SHARED : FULL
}

/** The line above the Screen board. */
export function boardIntro(shared: boolean, columnCount: number): string {
  if (!shared) return 'One column per role you’re hiring for — drag cards to re-rank (#1 is the top candidate), then Advance the ones worth interviewing.'
  const columns = columnCount === 1 ? 'One column was' : `${columnCount === 2 ? 'Two' : columnCount === 3 ? 'Three' : String(columnCount)} columns were`
  return `${columns} shared with you — drag cards to re-rank (#1 is the top candidate), press Talked today after a call, then Advance the ones worth interviewing.`
}
