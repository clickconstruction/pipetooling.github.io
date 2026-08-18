/**
 * Draft Payroll "Cash Due" pricing (v2.1794).
 *
 * Two layers keep the modal honest against the generated pay report PDF:
 *
 * 1. `draftPayrollRowCashDue` — once a report exists, its stored gross is
 *    authoritative (it's what the PDF says); the live estimate only fills in
 *    before generation.
 * 2. `draftPayrollPreviewDayCost` — the pre-report estimate prices dual-rate
 *    people (office vs. field hourly wage) with the same `splitDayHoursByRate`
 *    math `generatePayStub` uses, instead of flat `hourly_wage × hours`.
 *
 * Pure module — no React, no Supabase.
 */

import {
  type DayBucketHours,
  type DualRateConfigLike,
  shouldUseDualRate,
  splitDayHoursByRate,
} from './officeJobRateSplit'

export type DraftPayrollPreviewConfigLike = DualRateConfigLike & {
  hourly_wage?: number | null
}

/**
 * Estimated cost for one person-day in the Draft Payroll preview.
 *
 * Dual-rate people (hourly + office rate set) with loaded session buckets get
 * the office/field split — a day with no attributable sessions prices all-office,
 * matching the generator's "unassigned => office" rule. `bucketsByDate` is
 * undefined when the person has no unique login user (or buckets haven't
 * loaded), which falls back to the flat field wage — the same fallback
 * `generatePayStub` applies in that case.
 */
export function draftPayrollPreviewDayCost(args: {
  cfg: DraftPayrollPreviewConfigLike | undefined | null
  hours: number
  workDate: string
  bucketsByDate: ReadonlyMap<string, DayBucketHours> | undefined
}): number {
  const { cfg, hours, workDate, bucketsByDate } = args
  const wage = cfg?.hourly_wage ?? 0
  if (bucketsByDate && shouldUseDualRate(cfg) && cfg?.office_hourly_wage != null) {
    return splitDayHoursByRate({
      workDate,
      totalHours: hours,
      bucketHours: bucketsByDate.get(workDate),
      officeWage: cfg.office_hourly_wage,
      jobWage: wage,
    }).paidAmount
  }
  return wage * hours
}

/**
 * The Cash Due a Draft Payroll row (and the Print summary) shows for a person:
 * the generated report's stored gross when one exists, else the live estimate.
 */
export function draftPayrollRowCashDue(
  stubGross: number | null | undefined,
  estGross: number,
): number {
  return stubGross ?? estGross
}
