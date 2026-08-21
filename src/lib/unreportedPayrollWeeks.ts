/**
 * Payroll catch-up scan (v2.2034): earlier Sun–Sat weeks where someone has
 * effective hours but no pay report overlaps — the person-weeks that are
 * invisible today (the Ledger lists only stubs that exist; Draft Payroll
 * shows one week).
 *
 * Estimates use current pay config × effective hours — the same math as the
 * Draft Payroll Cash Due preview's fallback. Dual-rate office/field pricing
 * is deliberately skipped here (that parity work needs per-period clock
 * sessions); the generated report stays authoritative, exactly as it is for
 * the current-week preview.
 */

import { ymdAddDays } from '../utils/dateUtils'
import {
  EMPTY_SALARIED_PAYROLL_WINDOW,
  salariedHoursForDay,
  type SalariedPayrollWindow,
} from './salariedPayrollDays'

export type UnreportedScanWeek = { weekStart: string; weekEnd: string }

export type UnreportedWeekRow = {
  personName: string
  weekStart: string
  weekEnd: string
  hours: number
  estGross: number
}

/**
 * The `weeksBack` Sun–Sat weeks ending strictly before the week containing
 * `periodStart`, newest first — the scan window for the catch-up modal.
 */
export function scanWeeksBefore(periodStart: string, weeksBack: number): UnreportedScanWeek[] {
  const d = new Date(periodStart + 'T12:00:00')
  if (isNaN(d.getTime()) || weeksBack <= 0) return []
  const sundayOfPeriod = ymdAddDays(periodStart, -d.getDay())
  const weeks: UnreportedScanWeek[] = []
  for (let i = 1; i <= weeksBack; i++) {
    const weekStart = ymdAddDays(sundayOfPeriod, -7 * i)
    weeks.push({ weekStart, weekEnd: ymdAddDays(weekStart, 6) })
  }
  return weeks
}

export type UnreportedPayConfigLite = {
  hourly_wage?: number | null
  is_salary?: boolean | null
}

/**
 * One row per person-week with hours > 0 and no overlapping pay stub, in
 * `weeks` order (newest first) then person A→Z. The stub-overlap predicate
 * matches Draft Payroll's: `period_start <= weekEnd && period_end >= weekStart`.
 */
export function unreportedPayrollWeeks(args: {
  weeks: UnreportedScanWeek[]
  peopleNames: string[]
  hoursRows: Array<{ person_name: string; work_date: string; hours: number }>
  payConfig: Record<string, UnreportedPayConfigLite | undefined>
  salaryWindows: Record<string, SalariedPayrollWindow>
  stubs: Array<{ person_name: string; period_start: string; period_end: string }>
}): UnreportedWeekRow[] {
  const { weeks, peopleNames, hoursRows, payConfig, salaryWindows, stubs } = args
  const hoursByPersonDate = new Map<string, number>()
  for (const r of hoursRows) {
    const key = `${r.person_name.trim()}:${r.work_date}`
    hoursByPersonDate.set(key, (hoursByPersonDate.get(key) ?? 0) + r.hours)
  }
  const sortedPeople = [...peopleNames].sort((a, b) => a.localeCompare(b))
  const rows: UnreportedWeekRow[] = []
  for (const week of weeks) {
    for (const person of sortedPeople) {
      const covered = stubs.some(
        (s) =>
          s.person_name === person &&
          s.period_start <= week.weekEnd &&
          s.period_end >= week.weekStart,
      )
      if (covered) continue
      const cfg = payConfig[person]
      const isSalary = cfg?.is_salary ?? false
      const window = salaryWindows[person.trim()] ?? EMPTY_SALARIED_PAYROLL_WINDOW
      let hours = 0
      for (let d = week.weekStart; d <= week.weekEnd; d = ymdAddDays(d, 1)) {
        hours += isSalary
          ? salariedHoursForDay(d, window)
          : (hoursByPersonDate.get(`${person.trim()}:${d}`) ?? 0)
      }
      // Sub-half-minute slivers display as "0.00 h" and derail the list with
      // pennies — treat them as no hours (found live: a 0.049 h week → $0.05).
      if (hours < 0.005) continue
      rows.push({
        personName: person,
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        hours,
        estGross: (cfg?.hourly_wage ?? 0) * hours,
      })
    }
  }
  return rows
}
