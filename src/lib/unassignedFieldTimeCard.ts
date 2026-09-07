/**
 * Quickfill → Unassigned field time as a count card (v2.3051).
 *
 * The station used to list every person-day and open the day audit per row.
 * The Team board (Jobs → Team) now shows the same person-days as its
 * "No job on the session" row with the fix on each chip, so the station
 * reports the count per company week and hands off to the board.
 */
import { companyWeekStartSundayContaining, ymdAddDays } from '../utils/dateUtils'
import type { PeopleHoursUnallocatedRow } from './peopleHoursUnallocatedRows'

export type UnassignedWeekCard = {
  /** Company week start (Sunday), YYYY-MM-DD. */
  weekStart: string
  /** Saturday of the same week. */
  weekEnd: string
  /** Person-days over the threshold in this week. */
  rowCount: number
  peopleCount: number
  totalUnallocatedHrs: number
  /** Newest work date in the week with a row — the day the board should land near. */
  latestWorkDate: string
}

/** Groups unassigned person-days by company week, newest week first. */
export function unassignedWeekCards(rows: readonly PeopleHoursUnallocatedRow[]): UnassignedWeekCard[] {
  const byWeek = new Map<string, { people: Set<string>; hrs: number; rows: number; latest: string }>()
  for (const r of rows) {
    const wk = companyWeekStartSundayContaining(r.workDate)
    if (!wk) continue
    const g = byWeek.get(wk) ?? { people: new Set<string>(), hrs: 0, rows: 0, latest: r.workDate }
    g.people.add(r.personName)
    g.hrs += r.unallocatedHrs
    g.rows += 1
    if (r.workDate > g.latest) g.latest = r.workDate
    byWeek.set(wk, g)
  }
  return [...byWeek.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([weekStart, g]) => ({
      weekStart,
      weekEnd: ymdAddDays(weekStart, 6),
      rowCount: g.rows,
      peopleCount: g.people.size,
      totalUnallocatedHrs: g.hrs,
      latestWorkDate: g.latest,
    }))
}

/**
 * Deep link into Jobs → Team. `week` is any date inside the week to show;
 * `onlyExceptions` ticks the board's filter on arrival. Jobs.tsx consumes the
 * params once the tab has applied them.
 */
export function teamBoardHref(opts: { week?: string | null; onlyExceptions?: boolean; jobId?: string | null } = {}): string {
  const p = new URLSearchParams({ tab: 'combined-labor' })
  if (opts.week) p.set('teamWeek', opts.week)
  if (opts.onlyExceptions) p.set('teamExceptions', '1')
  if (opts.jobId) p.set('teamLaborJob', opts.jobId)
  return `/jobs?${p.toString()}`
}
