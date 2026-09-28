/**
 * Salary prefetch rules of the My Time day editor: when an empty day asks the salary schedule,
 * what the answer means, and what the empty day then says. Pure — the reads and the sync RPC
 * live in `useMyTimeSalaryPrefetch`.
 */
import type { CalendarWorkdayResolution } from './resolveCalendarWorkday'

export type MyTimeEmptyDayHint = 'time_off' | 'no_work' | null

export type SalaryPrefetchGateInput = {
  /** The mount's `prefetchSalarySessionsWhenEmpty` prop. */
  enabled: boolean
  /** The parent owns the sessions (`sessions` prop non-empty). */
  sessionsControlledByParent: boolean
  sessionsLoading: boolean
  /** How many sessions the editor's own fetch returned; null before the first answer. */
  fetchedCount: number | null
  inSaveableRange: boolean
  hasSubjectUser: boolean
}

/** Only a self-fetched day that came back empty, inside the editable window, asks the schedule. */
export function shouldPrefetchSalaryDay(i: SalaryPrefetchGateInput): boolean {
  if (!i.enabled) return false
  if (i.sessionsControlledByParent) return false
  if (i.sessionsLoading) return false
  if (i.fetchedCount === null) return false
  if (i.fetchedCount > 0) return false
  if (!i.inSaveableRange || !i.hasSubjectUser) return false
  return true
}

/** One prefetch per person and day, however often the empty day re-renders. */
export function salaryPrefetchKey(userId: string, dateStr: string): string {
  return `${userId}|${dateStr}`
}

export type SalaryPrefetchOutcome =
  | { action: 'hint'; hint: 'time_off'; timeOffLabel: string }
  | { action: 'hint'; hint: 'no_work' }
  | { action: 'sync' }

/** Time off and a day with no shift explain the empty day; a scheduled day has its sessions made. */
export function salaryPrefetchOutcome(resolution: CalendarWorkdayResolution): SalaryPrefetchOutcome {
  if (resolution.kind === 'time_off') {
    return { action: 'hint', hint: 'time_off', timeOffLabel: resolution.kindLabel }
  }
  if (resolution.kind === 'none') return { action: 'hint', hint: 'no_work' }
  return { action: 'sync' }
}

/** The line an empty day shows. */
export function emptyDayLine(hint: MyTimeEmptyDayHint, timeOffLabel: string): string {
  return hint === 'time_off'
    ? `No sessions this day — ${timeOffLabel}.`
    : hint === 'no_work'
      ? 'No scheduled work this day (e.g. weekend or no shift blocks).'
      : 'No sessions this day.'
}
