/**
 * "Upcoming payroll" summary for the Payroll ledger header: person-weeks with clocked time
 * (approved + pending approval; rejected/revoked excluded at fetch) but no pay report covering
 * the week, from each person's last stub period end forward (stub-less people capped at
 * DEFAULT_UPCOMING_CAP_WEEKS back). Pure — the component fetches sessions and passes them in.
 */

import { ymdAddDays } from '../utils/dateUtils'

export type UpcomingClockSessionRow = {
  user_id: string
  work_date: string // YYYY-MM-DD
  clocked_in_at: string
  clocked_out_at: string | null
}

export type UpcomingPayrollSummary = { personWeekCount: number; estimatedGrossDollars: number }

export const DEFAULT_UPCOMING_CAP_WEEKS = 8

/** Hard stop on weeks scanned per person, so an ancient last stub can't produce a pathological loop. */
const MAX_WEEKS_PER_PERSON = 104

/** Local Sunday of the week containing ymd — same convention as the Payroll tab's period init. */
export function payWeekStartYmd(ymd: string): string {
  const day = new Date(ymd + 'T12:00:00').getDay()
  return Number.isNaN(day) ? ymd : ymdAddDays(ymd, -day)
}

/**
 * Earliest work_date the upcoming computation needs — min over people of the week after their
 * last stub end (stub-less people: capWeeks back from the current week). Bounds the sessions fetch.
 */
export function upcomingPayrollFetchStartYmd(args: {
  personNames: string[]
  lastStubEndByPerson: Record<string, string>
  todayYmd: string
  capWeeksForStubless?: number
}): string {
  const cap = args.capWeeksForStubless ?? DEFAULT_UPCOMING_CAP_WEEKS
  const todayWeek = payWeekStartYmd(args.todayYmd)
  const capStart = ymdAddDays(todayWeek, -7 * cap)
  let min = todayWeek
  for (const name of args.personNames) {
    const lastEnd = args.lastStubEndByPerson[name]
    const start = lastEnd ? payWeekStartYmd(ymdAddDays(lastEnd, 1)) : capStart
    if (start < min) min = start
  }
  return min
}

/**
 * A person-week counts when it has > 0.01 summed clock hours (open sessions clip at nowMs) and no
 * existing stub overlaps the week (overlap test — odd-length stubs still suppress). Contribution
 * is weekHours × hourlyWage; salaried people flow through their materialized schedule sessions.
 */
export function buildUpcomingPayrollSummary(args: {
  personNames: string[]
  userIdByPersonName: Record<string, string>
  hourlyWageByPersonName: Record<string, number>
  stubsByPerson: Record<string, Array<{ period_start: string; period_end: string }>>
  sessions: UpcomingClockSessionRow[]
  todayYmd: string
  nowMs: number
  capWeeksForStubless?: number
}): UpcomingPayrollSummary {
  const cap = args.capWeeksForStubless ?? DEFAULT_UPCOMING_CAP_WEEKS
  const currentWeek = payWeekStartYmd(args.todayYmd)
  const capStart = ymdAddDays(currentWeek, -7 * cap)

  // One pass over sessions: hours per (user, weekStart).
  const hoursByUserWeek = new Map<string, number>()
  for (const s of args.sessions) {
    const inMs = new Date(s.clocked_in_at).getTime()
    const outMs = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : args.nowMs
    if (!Number.isFinite(inMs) || !Number.isFinite(outMs) || outMs <= inMs) continue
    const key = `${s.user_id}:${payWeekStartYmd(s.work_date)}`
    hoursByUserWeek.set(key, (hoursByUserWeek.get(key) ?? 0) + (outMs - inMs) / 3_600_000)
  }

  let personWeekCount = 0
  let estimatedGrossDollars = 0
  for (const name of args.personNames) {
    const uid = args.userIdByPersonName[name]
    if (!uid) continue
    const stubs = args.stubsByPerson[name] ?? []
    let lastEnd: string | null = null
    for (const s of stubs) {
      if (lastEnd === null || s.period_end > lastEnd) lastEnd = s.period_end
    }
    let week = lastEnd ? payWeekStartYmd(ymdAddDays(lastEnd, 1)) : capStart
    const wage = Number(args.hourlyWageByPersonName[name] ?? 0)
    let scanned = 0
    while (week <= currentWeek && scanned < MAX_WEEKS_PER_PERSON) {
      scanned++
      const weekEnd = ymdAddDays(week, 6)
      const covered = stubs.some((s) => s.period_start <= weekEnd && s.period_end >= week)
      if (!covered) {
        const hours = hoursByUserWeek.get(`${uid}:${week}`) ?? 0
        if (hours > 0.01) {
          personWeekCount++
          estimatedGrossDollars += hours * (Number.isFinite(wage) ? wage : 0)
        }
      }
      week = ymdAddDays(week, 7)
    }
  }
  return { personWeekCount, estimatedGrossDollars }
}
