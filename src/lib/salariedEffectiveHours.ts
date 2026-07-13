/** Salaried effective-hours kernel.
 *
 * Salaried people (people_pay_config.is_salary) are credited a flat 8 hours on
 * weekdays and 0 on weekends for payroll/costing, regardless of clock sessions.
 * The record_hours_but_salary flag lets a salaried person still LOG hours that
 * display on the Hours surfaces — but costing stays on the flat salary hours.
 *
 * Two deliberate semantics, previously copy-pasted (with drift) across
 * People.tsx, Quickfill HoursSection, HoursUnassignedModal and CrewJobsBlock:
 *  - cost:    salaried (either flavor) → flat 8/0; hourly → recorded hours.
 *  - display: record_hours_but_salary → recorded hours; plain salaried → flat
 *             8/0; hourly → recorded hours.
 */

export type SalariedPayConfigFlags = {
  is_salary?: boolean | null
  record_hours_but_salary?: boolean | null
}

/** Flat salary-day credit for a `YYYY-MM-DD` work date: 8 on Mon–Fri, 0 on Sat/Sun.
 * Noon-anchored parse so the civil date's weekday is stable in every local timezone. */
export function salariedFlatDayHours(workDateYmd: string): number {
  const day = new Date(workDateYmd + 'T12:00:00').getDay()
  if (day === 0 || day === 6) return 0
  return 8
}

/** Payroll/costing hours: salaried people are always the flat 8/0 credit
 * (record_hours_but_salary logs are informational and do not change cost). */
export function effectiveHoursForCost(
  cfg: SalariedPayConfigFlags | undefined,
  workDateYmd: string,
  recordedHours: number,
): number {
  if (cfg?.is_salary) return salariedFlatDayHours(workDateYmd)
  return recordedHours
}

/** Hours-surface display: salaried people show the flat 8/0 credit unless they
 * opted into record_hours_but_salary, in which case their logged hours show. */
export function effectiveHoursForDisplay(
  cfg: SalariedPayConfigFlags | undefined,
  workDateYmd: string,
  recordedHours: number,
): number {
  if (cfg?.is_salary && !(cfg?.record_hours_but_salary ?? false)) {
    return salariedFlatDayHours(workDateYmd)
  }
  return recordedHours
}

/** Whether the Hours editors should allow manual entry for this person:
 * hourly people always; salaried only with record_hours_but_salary. */
export function canEditRecordedHours(cfg: SalariedPayConfigFlags | undefined): boolean {
  return !(cfg?.is_salary ?? false) || (cfg?.record_hours_but_salary ?? false)
}
