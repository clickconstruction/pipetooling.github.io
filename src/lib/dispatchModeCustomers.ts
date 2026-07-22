/**
 * Dispatch Mode → Customers tab: pure helpers for the last-interaction label
 * and the Name / Interacted sort. "Interacted" = most recent
 * `jobs_ledger.last_work_date` (last approved clock session) across the
 * customer's jobs.
 */

export type DispatchModeCustomerListRow = {
  id: string
  name: string
  address: string | null
  jobCount: number
  /** Max jobs_ledger.last_work_date (YYYY-MM-DD) across the customer's jobs; null = never worked. */
  lastWorkYmd: string | null
  /** Nearest upcoming job_schedule_blocks.work_date (>= today) across the customer's jobs; null = nothing scheduled. */
  nextScheduledYmd: string | null
}

export type DispatchModeCustomerSort = 'name' | 'interacted'

function ymdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/** Whole calendar days between a YMD and today's YMD (0 = today; negative-clamped to 0). */
export function daysSinceYmd(ymd: string, todayYmd: string): number {
  const diff = Math.round((ymdToUtcMs(todayYmd) - ymdToUtcMs(ymd)) / 86_400_000)
  return Math.max(0, diff)
}

/**
 * Interaction label. A SCHEDULED upcoming job supersedes past work:
 * "in 3d" / "today" (scheduled) beats "3d ago" (last clock session); null when
 * the customer has neither.
 */
export function customerLastInteractionLabel(
  lastWorkYmd: string | null,
  todayYmd: string,
  nextScheduledYmd: string | null = null,
): string | null {
  if (nextScheduledYmd) {
    const days = daysSinceYmd(todayYmd, nextScheduledYmd)
    return days === 0 ? 'today' : `in ${days}d`
  }
  if (!lastWorkYmd) return null
  const days = daysSinceYmd(lastWorkYmd, todayYmd)
  return days === 0 ? 'today' : `${days}d ago`
}

/**
 * Sort rows: 'name' = alphabetical. 'interacted' = scheduled customers first —
 * the FARTHER in the future the next job, the higher it ranks — then past-work
 * customers by recency, then never-worked; ties alphabetical.
 */
export function sortDispatchModeCustomers(
  rows: DispatchModeCustomerListRow[],
  sort: DispatchModeCustomerSort,
): DispatchModeCustomerListRow[] {
  const out = [...rows]
  if (sort === 'name') {
    out.sort((a, b) => a.name.localeCompare(b.name))
    return out
  }
  out.sort((a, b) => {
    if (a.nextScheduledYmd || b.nextScheduledYmd) {
      if (a.nextScheduledYmd && !b.nextScheduledYmd) return -1
      if (!a.nextScheduledYmd && b.nextScheduledYmd) return 1
      if (a.nextScheduledYmd !== b.nextScheduledYmd) {
        return b.nextScheduledYmd!.localeCompare(a.nextScheduledYmd!)
      }
      return a.name.localeCompare(b.name)
    }
    if (a.lastWorkYmd && b.lastWorkYmd && a.lastWorkYmd !== b.lastWorkYmd) {
      return b.lastWorkYmd.localeCompare(a.lastWorkYmd)
    }
    if (a.lastWorkYmd && !b.lastWorkYmd) return -1
    if (!a.lastWorkYmd && b.lastWorkYmd) return 1
    return a.name.localeCompare(b.name)
  })
  return out
}
