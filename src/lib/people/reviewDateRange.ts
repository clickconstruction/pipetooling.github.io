// The Review tab's period → [start, end] rule, as a pure kernel anchored on
// an injected "today" (the COMPANY calendar day — `denverCalendarDayKey`),
// not the viewer's browser clock. Extracted from `getReviewDateRange` in
// `PeopleReviewTab.tsx` (audit finding 17, v2.2688): a viewer outside
// Central time near midnight used to get a period one day off from the
// 90-day overhead window it is combined with.

import { ymdAddDays } from '../../utils/dateUtils'

export type ReviewPeriod =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'last_two_weeks'
  | 'last_30_days'
  | 'last_90_days'
  | 'this_year'
  | 'custom'

/** 0 = Sunday … 6 = Saturday, for a YYYY-MM-DD string (calendar-only, no timezone). */
export function ymdDayOfWeek(ymd: string): number {
  const y = Number(ymd.slice(0, 4))
  const m = Number(ymd.slice(5, 7))
  const d = Number(ymd.slice(8, 10))
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Same month/day, `years` later (Feb 29 → Feb 28 when the target year is not leap). */
export function ymdAddYears(ymd: string, years: number): string {
  const y = Number(ymd.slice(0, 4)) + years
  const m = Number(ymd.slice(5, 7))
  const d = Number(ymd.slice(8, 10))
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const dd = Math.min(d, lastDay)
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

/**
 * Inclusive [start, end] for a period. Custom ranges swap when entered
 * backwards and collapse to one day when only one side is filled; both
 * empty falls back to today so the table still renders.
 */
export function computeReviewDateRange(
  period: ReviewPeriod,
  custom: { start: string; end: string },
  todayYmd: string,
): [string, string] {
  if (period === 'today') return [todayYmd, todayYmd]
  if (period === 'yesterday') {
    const y = ymdAddDays(todayYmd, -1)
    return [y, y]
  }
  if (period === 'custom') {
    const cs = custom.start.trim()
    const ce = custom.end.trim()
    if (cs && ce) return cs <= ce ? [cs, ce] : [ce, cs]
    if (cs && !ce) return [cs, cs]
    if (!cs && ce) return [ce, ce]
    return [todayYmd, todayYmd]
  }
  const thisWeekSunday = ymdAddDays(todayYmd, -ymdDayOfWeek(todayYmd))
  if (period === 'this_week') return [thisWeekSunday, todayYmd]
  if (period === 'last_week') {
    const lastWeekSunday = ymdAddDays(thisWeekSunday, -7)
    return [lastWeekSunday, ymdAddDays(lastWeekSunday, 6)]
  }
  // −29 / −89: the range is inclusive of today, so [today−29, today] = 30 days.
  if (period === 'last_30_days') return [ymdAddDays(todayYmd, -29), todayYmd]
  if (period === 'last_90_days') return [ymdAddDays(todayYmd, -89), todayYmd]
  if (period === 'this_year') return [`${todayYmd.slice(0, 4)}-01-01`, todayYmd]
  // last_two_weeks: the two full weeks before this one (Sunday → Saturday).
  return [ymdAddDays(thisWeekSunday, -14), ymdAddDays(thisWeekSunday, -1)]
}
