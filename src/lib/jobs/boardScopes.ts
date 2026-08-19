/**
 * Jobs-board scope bookkeeping (v2.1823, scoped-load plan PR 2): which
 * sections' rows are in the cache, and how a per-scope fetch merges into the
 * shared `jobs` array without disturbing rows other scopes own.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'

export type JobsBoardScope = 'waiting' | 'working' | 'ready_to_bill' | 'billed_all' | 'paid'

/** What a full `non_paid` board load covers. */
export const NON_PAID_SCOPES: readonly JobsBoardScope[] = ['waiting', 'working', 'ready_to_bill', 'billed_all']

/**
 * The one scope whose fetch is authoritative for a row, by status. A working
 * job with an RTB invoice ALSO comes back from the `ready_to_bill` scope
 * fetch, but it *belongs* to `working` — the merge below leans on this so an
 * RTB refresh never purges working rows it didn't return.
 */
export function primaryScopeForStatus(status: string | null | undefined): JobsBoardScope {
  switch (status ?? 'working') {
    case 'waiting':
      return 'waiting'
    case 'ready_to_bill':
      return 'ready_to_bill'
    case 'billed':
      return 'billed_all'
    case 'paid':
      return 'paid'
    default:
      // 'working', null, and any unknown status render as Working on the board.
      return 'working'
  }
}

/**
 * Replace the cache's view of one scope with a fresh fetch: drop rows the
 * scope is authoritative for (they'd be stale if absent from the result),
 * drop anything the fetch re-returned under a different status (moved jobs),
 * keep everything else, append the fresh rows.
 */
export function mergeScopedRows(
  prev: JobWithDetails[],
  fetched: JobWithDetails[],
  scope: JobsBoardScope,
): JobWithDetails[] {
  const fetchedIds = new Set(fetched.map((j) => j.id))
  const kept = prev.filter((j) => primaryScopeForStatus(j.status) !== scope && !fetchedIds.has(j.id))
  return [...kept, ...fetched]
}
