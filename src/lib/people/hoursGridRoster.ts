/**
 * Hours-grid roster (People → Hours, Draft Payroll, the Earlier-weeks scan, the cost matrix).
 *
 * The pay-config rows are the roster's source (every person with a pay-config row is on the
 * grid — the modal's own copy says so). Which of those rows are *people* is the roster view's
 * verdict (`rosterPeople.ts`, v2.3698): a sample account, a digital twin or an archived person
 * with a pay-config row is not on the grid. Until v2.3698 the only exclusion was the archived
 * *account names* from `get_archived_user_names()`, and a Salary-ticked pay row on a test
 * account put 40 h a week into every total (2026-09-21).
 *
 * J7-6 still holds: the list is the same whatever the viewer, given the same inputs — the view
 * runs with owner rights, so every viewer who can open the grid gets the same roster.
 */

import { isPayRosterRow, type PayRosterIndex, type PayRosterRowRef } from './rosterPeople'

const UNORDERED = 999999

export type HoursGridRosterInput = {
  /** Every pay-config row — `person_name` plus the `person_id` it carries (null for old rows). */
  payConfigRows: readonly PayRosterRowRef[]
  /** The roster view's verdicts; null while loading (no verdict: every row stays). */
  payRoster: PayRosterIndex | null
  /** `people_hours_display_order` — sequence per name; unordered names sort A→Z after the ordered. */
  displayOrder: Record<string, number>
}

export function buildHoursGridRoster({ payConfigRows, payRoster, displayOrder }: HoursGridRosterInput): string[] {
  return payConfigRows
    .filter((r) => isPayRosterRow(payRoster, r))
    .map((r) => r.person_name)
    .sort((a, b) => {
      const orderA = displayOrder[a] ?? UNORDERED
      const orderB = displayOrder[b] ?? UNORDERED
      return orderA !== orderB ? orderA - orderB : a.localeCompare(b)
    })
}

/** The pay-config map (name → row) as the roster kernel's row list. */
export function payConfigRowsForRoster(
  payConfig: Record<string, { person_name?: string; person_id?: string | null } | undefined>,
): PayRosterRowRef[] {
  return Object.keys(payConfig).map((name) => ({ person_name: name, person_id: payConfig[name]?.person_id ?? null }))
}
