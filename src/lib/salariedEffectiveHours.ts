/** Salaried effective-hours kernel.
 *
 * Salaried people (people_pay_config.is_salary) are credited a flat day for
 * payroll/costing, regardless of clock sessions. The day is the person's own:
 * people_pay_config.salaried_week_hours (v2.7826) holds the paid hours of each
 * day of their week, seven numbers, Sunday first, 0 for a day off. A row that
 * carries no week reads as 8 hours on the five weekdays.
 * The record_hours_but_salary flag lets a salaried person still LOG hours that
 * display on the Hours surfaces — but costing stays on the flat salary hours.
 *
 * Two deliberate semantics, previously copy-pasted (with drift) across
 * People.tsx, Quickfill HoursSection and HoursUnassignedModal (and, until v2.2986, CrewJobsBlock):
 *  - cost:    salaried (either flavor) → the flat day; hourly → recorded hours.
 *  - display: record_hours_but_salary → recorded hours; plain salaried → the
 *             flat day; hourly → recorded hours.
 */

/** A salaried week: the paid hours of each day, Sunday first, 0 for a day off. */
export type SalariedWeek = readonly number[]

/** The salaried week when the pay row carries none: 8 hours on the five weekdays. */
export const SALARIED_DEFAULT_WEEK: SalariedWeek = Object.freeze([0, 8, 8, 8, 8, 8, 0])

/** The most a day holds, as the database check has it. */
export const SALARIED_DAY_MAX_HOURS = 16

export type SalariedPayConfigFlags = {
  is_salary?: boolean | null
  record_hours_but_salary?: boolean | null
  /** The paid hours of each day of this person's week, Sunday first; a missing or malformed week reads as the default. */
  salaried_week_hours?: readonly (number | string | null)[] | null
}

/**
 * A person's salaried week: the pay row's seven numbers, or the default when the row carries none.
 * A week that is not seven numbers from 0 to 16 reads as the default whole, never patched day by day:
 * half a week guessed is worse than the old rule.
 */
export function salariedWeekOf(cfg: { salaried_week_hours?: unknown } | null | undefined): SalariedWeek {
  const raw = cfg?.salaried_week_hours
  if (!Array.isArray(raw) || raw.length !== 7) return SALARIED_DEFAULT_WEEK
  const week: number[] = []
  for (const v of raw) {
    if (v == null || v === '') return SALARIED_DEFAULT_WEEK
    const h = Number(v)
    if (!Number.isFinite(h) || h < 0 || h > SALARIED_DAY_MAX_HOURS) return SALARIED_DEFAULT_WEEK
    week.push(h)
  }
  return week
}

/** The day of the week of a `YYYY-MM-DD` work date, 0 for Sunday.
 * Noon-anchored parse so the civil date's weekday is stable in every local timezone. */
export function salariedDow(workDateYmd: string): number {
  return new Date(workDateYmd + 'T12:00:00').getDay()
}

/** Flat salary-day credit for a `YYYY-MM-DD` work date: that weekday's hours in the person's week
 * (8 on Mon–Fri and 0 on Sat/Sun unless a week is given). */
export function salariedFlatDayHours(workDateYmd: string, week: SalariedWeek = SALARIED_DEFAULT_WEEK): number {
  return week[salariedDow(workDateYmd)] ?? 0
}

/** Payroll/costing hours: salaried people are always the flat day credit
 * (record_hours_but_salary logs are informational and do not change cost). */
export function effectiveHoursForCost(
  cfg: SalariedPayConfigFlags | undefined,
  workDateYmd: string,
  recordedHours: number,
): number {
  if (cfg?.is_salary) return salariedFlatDayHours(workDateYmd, salariedWeekOf(cfg))
  return recordedHours
}

/** Hours-surface display: salaried people show the flat day credit unless they
 * opted into record_hours_but_salary, in which case their logged hours show. */
export function effectiveHoursForDisplay(
  cfg: SalariedPayConfigFlags | undefined,
  workDateYmd: string,
  recordedHours: number,
): number {
  if (cfg?.is_salary && !(cfg?.record_hours_but_salary ?? false)) {
    return salariedFlatDayHours(workDateYmd, salariedWeekOf(cfg))
  }
  return recordedHours
}

/** Whether the Hours editors should allow manual entry for this person:
 * hourly people always; salaried only with record_hours_but_salary. */
export function canEditRecordedHours(cfg: SalariedPayConfigFlags | undefined): boolean {
  return !(cfg?.is_salary ?? false) || (cfg?.record_hours_but_salary ?? false)
}

/** Hours as words: 8, 6, 7.5, 6.25. */
export function formatDayHours(hours: number): string {
  return String(Number(hours.toFixed(2)))
}

/** What a salaried week comes to: its seven days added up. */
export function salariedWeekHours(week: SalariedWeek = SALARIED_DEFAULT_WEEK): number {
  return Math.round(week.reduce((t, h) => t + h, 0) * 100) / 100
}

/** A salaried week's pay at a wage: wage × the week's hours, to the cent. */
export function salariedWeeklyPay(hourlyWage: number, week: SalariedWeek = SALARIED_DEFAULT_WEEK): number {
  return Math.round(hourlyWage * salariedWeekHours(week) * 100) / 100
}

/** The wage that makes a weekly amount over a week, to the cent; null when the week has no hours or the amount is not above 0. */
export function wageForWeeklyPay(weeklyPay: number, week: SalariedWeek = SALARIED_DEFAULT_WEEK): number | null {
  const hours = salariedWeekHours(week)
  if (!(weeklyPay > 0) || !(hours > 0)) return null
  return Math.round((weeklyPay / hours) * 100) / 100
}

/** The one length every paid day shares, or null when the days differ or none is paid. */
export function salariedUniformDayHours(week: SalariedWeek = SALARIED_DEFAULT_WEEK): number | null {
  const paid = week.filter((h) => h > 0)
  if (paid.length === 0) return null
  return paid.every((h) => h === paid[0]) ? paid[0]! : null
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
/** Read a week Monday first, the way a work week is said, with Sunday last. */
const READ_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

/**
 * A week as words, days that share their hours said together:
 * *8 h Mon to Fri*, *8 h Mon to Thu, 4 h Fri*, *10 h Mon to Thu*, *8 h Tue to Sat*.
 * *no paid days* for a week of zeros.
 */
export function salariedWeekWords(week: SalariedWeek = SALARIED_DEFAULT_WEEK): string {
  const runs: Array<{ hours: number; from: number; to: number }> = []
  let prevPos = -2
  READ_ORDER.forEach((dow, pos) => {
    const hours = week[dow] ?? 0
    if (!(hours > 0)) return
    const last = runs[runs.length - 1]
    if (last && last.hours === hours && prevPos === pos - 1) last.to = dow
    else runs.push({ hours, from: dow, to: dow })
    prevPos = pos
  })
  if (runs.length === 0) return 'no paid days'
  return runs.map((r) => `${formatDayHours(r.hours)} h ${r.from === r.to ? DAY_SHORT[r.from] : `${DAY_SHORT[r.from]} to ${DAY_SHORT[r.to]}`}`).join(', ')
}
