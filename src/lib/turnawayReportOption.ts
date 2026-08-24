/**
 * Turnaway from the generic report picker (v2.2210): Turnaway stays "filed
 * only through the one TurnawayModal" (it alerts Dispatch and records
 * location) — but when the job you picked in New Report is on YOUR schedule
 * today, the picker offers an amber door to that same modal. This kernel is
 * the visibility rule + the copy, so both are testable and live in one place.
 */

export type ReportPickerJobSource = 'job_ledger' | 'project' | 'bid'

/** Offer the amber Turnaway option: a real ledger job that is on the user's schedule today. */
export function shouldOfferTurnawayInReportPicker(
  source: ReportPickerJobSource | null | undefined,
  hasScheduleBlockToday: boolean,
): boolean {
  return source === 'job_ledger' && hasScheduleBlockToday
}

export const TURNAWAY_REPORT_OPTION_LABEL = 'Turnaway — not ready / not home'
export const TURNAWAY_REPORT_OPTION_SUB = 'on your schedule today · files the report and alerts Dispatch'
