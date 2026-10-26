/**
 * Job statuses whose rows any header formula reads. `paid` is deliberately
 * absent (count-only, via head request); NULL status rides along because the
 * kernel coalesces it to 'working'. "Collections" is not a status — it's
 * `billed` + `collections_at`, so billed covers it.
 *
 * In its own file (v2.5880) so a read with no client of its own, the Dashboard's financials on the edge, can take
 * it without `fetchStagesHeaderStats.ts`'s client; that file re-exports it.
 */
export const LEAN_STATS_ACTIVE_JOB_STATUSES = ['waiting', 'working', 'ready_to_bill', 'billed'] as const
