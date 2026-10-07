import { jobsLedgerStatusDotColor } from '../jobsLedgerStatusPipeline'

/**
 * The Pipeline's stage bar (v2.4512, pure): the jump strip that stays pinned while the board
 * scrolls. One segment per section with its count and dollars, the section being scrolled
 * through lit, and each section header a band in the same color as its map pin.
 */

export type StageBarKey = 'waiting' | 'working' | 'readyToBill' | 'billed' | 'collections'

export const STAGE_BAR_ORDER: readonly StageBarKey[] = ['waiting', 'working', 'readyToBill', 'billed', 'collections']

/** A section's color: the map pin's and the status dot's; Collections is the red its ring wears. */
export const STAGE_BAND_COLOR: Record<StageBarKey | 'paid', string> = {
  waiting: jobsLedgerStatusDotColor('waiting'),
  working: jobsLedgerStatusDotColor('working'),
  readyToBill: jobsLedgerStatusDotColor('ready_to_bill'),
  billed: jobsLedgerStatusDotColor('billed'),
  collections: '#dc2626',
  paid: jobsLedgerStatusDotColor('paid'),
}

/** The CSS variable a band or a segment reads its color from (spread into `style`). */
export function stageColorVar(key: StageBarKey | 'paid'): Record<string, string> {
  return { '--stage-color': STAGE_BAND_COLOR[key] }
}

const LABEL: Record<StageBarKey, string> = {
  waiting: 'Waiting',
  working: 'Working',
  readyToBill: 'Ready to Bill',
  billed: 'Billed Awaiting Payment',
  collections: 'Collections',
}

export type StageBarItem = {
  key: StageBarKey
  label: string
  /** What the count counts, for the aria-label: jobs in the job-only sections, rows in the mixed ones. */
  noun: 'jobs' | 'rows'
  count: string
  /** Abbreviated dollars without the "$" ("257.3k"), or "…" while the numbers load. */
  total: string
  /** Nothing in the section: the segment stays in place, greyed. */
  empty: boolean
}

/**
 * The bar's segments in board order. Collections only shows while it has rows (as the strip
 * always did); every other section keeps its place when empty so the bar never shifts.
 */
export function stageBarItems(counts: Record<StageBarKey, string>, totals: Record<StageBarKey, string>): StageBarItem[] {
  return STAGE_BAR_ORDER.filter((key) => !(key === 'collections' && counts[key] === '0')).map((key) => ({
    key,
    label: LABEL[key],
    noun: key === 'waiting' || key === 'working' ? 'jobs' : 'rows',
    count: counts[key],
    total: totals[key],
    empty: counts[key] === '0',
  }))
}

/**
 * The section being scrolled through: the last header, in board order, whose top edge has
 * reached the line under the pinned bar. None above the line (the top of the page) → null.
 * A header that is not drawn has `top: null`.
 */
export function stagesActiveSection<K extends string>(tops: ReadonlyArray<{ key: K; top: number | null }>, line: number): K | null {
  let active: K | null = null
  for (const t of tops) {
    if (t.top != null && t.top <= line) active = t.key
  }
  return active
}
