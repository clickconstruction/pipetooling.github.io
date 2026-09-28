/** Draft Payroll's price for a person's day — the pure half of `usePayrollPreviewPricing`. */

import { EMPTY_SALARIED_PAYROLL_WINDOW, salariedHoursForDay, type SalariedPayrollWindow } from '../salariedPayrollDays'

/**
 * The hours payroll pays a person for on a day. Salaried: the flat 8 / 0, less unpaid time off
 * and the days outside their employment window (a person with no window loaded yet gets the
 * plain flat rule). Everyone else: the hours recorded.
 */
export function payrollEffectiveHours(input: {
  isSalary: boolean | null | undefined
  personName: string
  workDate: string
  salaryWindows: Readonly<Record<string, SalariedPayrollWindow>>
  recordedHours: () => number
}): number {
  if (input.isSalary) {
    return salariedHoursForDay(input.workDate, input.salaryWindows[input.personName.trim()] ?? EMPTY_SALARIED_PAYROLL_WINDOW)
  }
  return input.recordedHours()
}

/**
 * Pay name → login user id, for the names exactly one user carries (trimmed on both sides).
 * A name no user has, or two users share, is left out — its sessions cannot be told apart, so
 * the preview prices it at the flat wage, as the report's generator does.
 */
export function uniqueUserIdByPayName(names: readonly string[], users: ReadonlyArray<{ id: string; name: string | null }>): Map<string, string> {
  const uidByName = new Map<string, string>()
  for (const name of names) {
    const matches = users.filter((u) => (u.name ?? '').trim() === name.trim())
    if (matches.length === 1) uidByName.set(name, matches[0]!.id)
  }
  return uidByName
}
