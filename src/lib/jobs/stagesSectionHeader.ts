import type { StageRow } from '../jobsStagesBoard'
import { billedStageRowAgingBucket, billedStageRowHasNoBillLine, stageRowBilledRemainingAmount } from './invoiceBilling'
import { formatCurrencyAbbrevTruncated } from './jobFormatting'
import type { StagesSectionStat } from './stagesHeaderStats'

/**
 * The Pipeline's section headers (pure). Since v2.1824 a section whose scope has not been
 * fetched prints the cache's header stats instead of live rows it does not have, and '…'
 * before the cache has them; once the scope is merged — or a search is on, which reads
 * every scope — the live rows win. Lifted out of `JobsStagesTab` (Stage-A sweep II,
 * v2.3863) with the Billed list's aging filter, which the same header block owned.
 */

export type StagesSectionKey = 'waiting' | 'working' | 'readyToBill' | 'billed' | 'collections'

export type StagesSectionHeader = { count: string; total: string }

export type StagesSectionHeaderInput = {
  /** True when the section's rows are on the board: its scope is merged, or a search is on. */
  useLive: boolean
  live: { count: number; total: number }
  /** The cache's stat for the section, when the cache has loaded. */
  cached: StagesSectionStat | null | undefined
}

/** The header's count and abbreviated total, live or cached or '…'. The caller prefixes the "$". */
export function stagesSectionHeader({ useLive, live, cached }: StagesSectionHeaderInput): StagesSectionHeader {
  if (useLive) return { count: String(live.count), total: formatCurrencyAbbrevTruncated(live.total) }
  return cached ? { count: String(cached.count), total: formatCurrencyAbbrevTruncated(cached.total) } : { count: '…', total: '…' }
}

/** " — loading" on an open section whose scope is still on its way; '' otherwise. */
export function stagesSectionLoadingSuffix({ open, merged, busy }: { open: boolean; merged: boolean; busy: boolean }): string {
  return open && !merged && busy ? ' — loading' : ''
}

export type BilledListFilter = '30_90' | '90' | 'no_line' | null

/**
 * The Billed list under its aging chip: the 30–90 or 90+ bucket, the rows with money owed
 * and no bill line, or every row when no chip is down. The chips themselves always describe
 * the whole section; only the list narrows.
 */
export function billedListRows(rows: readonly StageRow[], filter: BilledListFilter, now = new Date()): StageRow[] {
  if (!filter) return [...rows]
  if (filter === 'no_line') return rows.filter((r) => stageRowBilledRemainingAmount(r) > 0 && billedStageRowHasNoBillLine(r))
  return rows.filter((r) => billedStageRowAgingBucket(r, now) === filter)
}
