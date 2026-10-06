/**
 * Hours-grid roster (People → Hours, Draft Payroll, the Earlier-weeks scan, the cost matrix).
 *
 * The pay-config rows are the roster's source (every person with a pay-config row is on the
 * grid — the modal's own copy says so). Two exclusions, both applied:
 *
 *   1. the archived names (`archivedRosterNames`, v2.4671, #29): every name an archived roster row
 *      answers to, except a living namesake's. They come from the same `roster_people` read as rule
 *      2. Until v2.4671 they came from `get_archived_user_names()` (archived accounts only, no
 *      namesake guard);
 *   2. the roster view's verdict (`rosterPeople.ts`, v2.3698): a sample account, a digital twin or
 *      a person whose roster row is archived is not on the grid either. Until v2.3698 rule 1 was
 *      the only one, and a Salary-ticked pay row on a test account put 40 h a week into every
 *      total (2026-09-21).
 *
 * J7-6 still holds: the list is the same whatever the viewer, given the same inputs. The view
 * runs with owner rights, so every viewer who can open the grid gets the same roster. A read
 * that has not landed is no verdict, never a blank grid: rule 1 is empty and rule 2 null, so every
 * pay row stays for that load.
 */

import { isPayRosterRow, type PayRosterIndex, type PayRosterRowRef } from './rosterPeople'

const UNORDERED = 999999

export type HoursGridRosterInput = {
  /** Every pay-config row — `person_name` plus the `person_id` it carries (null for old rows). */
  payConfigRows: readonly PayRosterRowRef[]
  /** The names archived roster rows answer to (`archivedRosterNames`); empty until the roster read lands. */
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

/**
 * What the Hours grid, Draft Payroll and Quickfill say when the roster is empty. A person is on
 * it once they have a pay row, and that is set on the Users tab's Pay lens (v2.3702) — the
 * "Show in Hours" tick and the pay-config window the old sentence named are both gone.
 */
export const EMPTY_HOURS_ROSTER_MESSAGE = 'No one has pay set up yet. Give a person a wage on People → Users → Pay and they appear here.'
