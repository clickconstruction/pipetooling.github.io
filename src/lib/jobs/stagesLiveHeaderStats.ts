import type { JobWithDetails } from '../../types/jobWithDetails'
import { buildJobsStagesBoardLists } from '../jobsStagesBoard'
import { billedRowsRemainingTotal, buildBilledAgingBuckets, countBilledRowsMissingDates, type BilledAgingBuckets } from './invoiceBilling'
import type { StagesHeaderStats, StagesSectionStat } from './stagesHeaderStats'

/**
 * The Billed / Collections figures the Pipeline's top cards show, read from
 * the rows on the board once the billed scope is loaded (v2.4056).
 *
 * The cached header stats are fetched once per board load and refresh on a
 * TTL; the rows refresh on every mutation and Realtime event. When the two
 * drift — a job moved to Collections from another screen — the cards said
 * "7 jobs · $24,338" while the section header under them said "(8) · $24.6k".
 * The section headers already read the live rows once their scope is merged
 * (`stagesSectionHeader`), and the aging chips do too (v2.1824); the cards
 * now follow the same rule, so the page never disagrees with itself.
 *
 * Same kernels as `computeStagesHeaderStats`, so on the same rows the two
 * are equal (pinned by the test).
 */
export type LiveBilledStats = {
  billed: StagesSectionStat
  collections: StagesSectionStat
  billedAging: BilledAgingBuckets
  billedNoDate: number
}

export function liveBilledStats(jobs: JobWithDetails[], now = new Date()): LiveBilledStats {
  const l = buildJobsStagesBoardLists(jobs, '')
  return {
    billed: { count: l.billedActiveRows.length, total: billedRowsRemainingTotal(l.billedActiveRows) },
    collections: { count: l.collectionsRows.length, total: billedRowsRemainingTotal(l.collectionsRows) },
    billedAging: buildBilledAgingBuckets(l.filtered, now),
    billedNoDate: countBilledRowsMissingDates(l.filtered),
  }
}

/** The cached stats with the live Billed / Collections figures laid over them; `null` live (scope not loaded) leaves the cache as it is. */
export function overlayLiveBilledStats(cached: StagesHeaderStats | null, live: LiveBilledStats | null): StagesHeaderStats | null {
  if (!cached || !live) return cached
  return { ...cached, ...live }
}
