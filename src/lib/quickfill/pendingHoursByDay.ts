/**
 * Quickfill → People hours new: the pending sessions by work day (punch list
 * #184 sweep B). The breakdown used to be built inside the section, newest
 * work date first, so the day that has waited a week sat under yesterday's.
 * Pure: oldest work date first, each day with its age on the
 * `HOURS_APPROVAL_AGE` scale (the `HOURS_APPROVALS_MIN_AGE_DAYS = 3` precedent).
 */
import { ageStateForDays, HOURS_APPROVAL_AGE, ymdAgeDays, type AgeState } from '../ageState'

export type PendingHoursSessionInput = {
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
}

export type PendingHoursDayRow = {
  workDate: string
  count: number
  hours: number
  /** Whole days from the work date to today (0 = today); null when a date is unreadable. */
  ageDays: number | null
  state: AgeState
}

/** Hours between two stamps, never negative. */
export function closedSessionDurationHours(clockedIn: string, clockedOut: string): number {
  const inMs = new Date(clockedIn).getTime()
  const outMs = new Date(clockedOut).getTime()
  return Math.max(0, (outMs - inMs) / 3600000)
}

/** One row per work date, OLDEST first, counting every session and the hours of the closed ones. */
export function buildPendingHoursByDay(sessions: ReadonlyArray<PendingHoursSessionInput>, todayYmd: string): PendingHoursDayRow[] {
  const byDay = new Map<string, { count: number; hours: number }>()
  for (const s of sessions) {
    const wd = s.work_date
    const cur = byDay.get(wd) ?? { count: 0, hours: 0 }
    cur.count += 1
    if (s.clocked_out_at) cur.hours += closedSessionDurationHours(s.clocked_in_at, s.clocked_out_at)
    byDay.set(wd, cur)
  }
  const rows: PendingHoursDayRow[] = [...byDay.entries()].map(([workDate, v]) => {
    const ageDays = ymdAgeDays(workDate, todayYmd)
    return { workDate, count: v.count, hours: v.hours, ageDays, state: ageStateForDays(ageDays, HOURS_APPROVAL_AGE) }
  })
  rows.sort((a, b) => a.workDate.localeCompare(b.workDate))
  return rows
}
