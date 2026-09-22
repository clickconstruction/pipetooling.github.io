/**
 * Hours-grid roster (People → Hours, Draft Payroll, the Earlier-weeks scan, the cost matrix).
 *
 * The pay-config rows are the roster's source (every person with a pay-config row is on the
 * grid — the modal's own copy says so). Two exclusions, both applied:
 *
 *   1. the archived *account names* from `get_archived_user_names()` — the pre-v2.3698 rule, kept
 *      because it needs no view (the client can deploy before the migration is pushed) and costs
 *      nothing;
 *   2. the roster view's verdict (`rosterPeople.ts`, v2.3698): a sample account, a digital twin or
 *      a person whose roster row is archived is not on the grid either. Until v2.3698 rule 1 was
 *      the only one, and a Salary-ticked pay row on a test account put 40 h a week into every
 *      total (2026-09-21).
 *
 * J7-6 still holds: the list is the same whatever the viewer, given the same inputs — both the
 * RPC and the view run with owner rights, so every viewer who can open the grid gets the same
 * roster. A view that has not loaded (null) is no verdict, never a blank grid.
 */

import { isPayRosterRow, type PayRosterIndex, type PayRosterRowRef } from './rosterPeople'

const UNORDERED = 999999

export type HoursGridRosterInput = {
  /** Every pay-config row — `person_name` plus the `person_id` it carries (null for old rows). */
  payConfigRows: readonly PayRosterRowRef[]
  /** Trimmed names of archived accounts (`get_archived_user_names`). */
  archivedUserNames: ReadonlySet<string>
  /** The roster view's verdicts; null while loading (no verdict: rule 1 alone). */
  payRoster: PayRosterIndex | null
  /** `people_hours_display_order` — sequence per name; unordered names sort A→Z after the ordered. */
  displayOrder: Record<string, number>
}

export function buildHoursGridRoster({ payConfigRows, archivedUserNames, payRoster, displayOrder }: HoursGridRosterInput): string[] {
  return payConfigRows
    .filter((r) => !archivedUserNames.has(r.person_name.trim()))
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
