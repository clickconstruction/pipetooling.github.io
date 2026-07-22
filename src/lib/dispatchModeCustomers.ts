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

/** "today" / "1d ago" / "45d ago"; null when the customer has no worked job. */
export function customerLastInteractionLabel(
  lastWorkYmd: string | null,
  todayYmd: string,
): string | null {
  if (!lastWorkYmd) return null
  const days = daysSinceYmd(lastWorkYmd, todayYmd)
  return days === 0 ? 'today' : `${days}d ago`
}

/**
 * Sort rows: 'name' = alphabetical; 'interacted' = most recent last-work date
 * first, never-worked customers last, ties alphabetical.
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
    if (a.lastWorkYmd && b.lastWorkYmd && a.lastWorkYmd !== b.lastWorkYmd) {
      return b.lastWorkYmd.localeCompare(a.lastWorkYmd)
    }
    if (a.lastWorkYmd && !b.lastWorkYmd) return -1
    if (!a.lastWorkYmd && b.lastWorkYmd) return 1
    return a.name.localeCompare(b.name)
  })
  return out
}
