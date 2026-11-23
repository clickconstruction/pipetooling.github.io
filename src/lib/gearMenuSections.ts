/**
 * The gear menu's sections (v2.8059, the owner's pick of 2026-11-20).
 *
 * The menu was one long list with a single band in it. It now reads in groups, each under a small label, and
 * no row left its group's place:
 *
 *   the wrench's press     only where the header had no room for it, first and unlabelled
 *   Modes                  Job Mode, Dispatch Mode with its PO tab, Task Mode: each changes the page
 *                          (every role but the estimator has the mode row above the header and keeps Dispatch Mode alone, `gearModesRows`)
 *   Show                   Pin bar, Tell the dev, Dark Mode: each shows or hides one thing
 *   Pages                  the pages this menu is the door to, in `GEAR_PAGE_ORDER`
 *   Help and settings      My logbook, Help, Settings
 *   a band, no label       Sign out and the reloads
 *
 * The phone dock's More sheet uses the same four labels. Pure, so the order is tested without a screen.
 */

export const GEAR_SECTION_LABELS = {
  modes: 'Modes',
  show: 'Show',
  pages: 'Pages',
  help: 'Help and settings',
} as const

export type GearSection = keyof typeof GEAR_SECTION_LABELS

/**
 * The Pages group, in the order the menu draws it: the pages a crew opens first, then the two the header
 * hands over on a narrow phone, then the office's pages. One list, so a new page has one place to go.
 * Until v2.8059 the rows sat in the order they were added.
 */
export const GEAR_PAGE_ORDER = [
  'checklist',
  'calendar',
  'materials',
  'map',
  'customers',
  'people',
  'documents',
  'banking',
  'roadmap',
  'partnerships',
] as const

export type GearPageKey = (typeof GEAR_PAGE_ORDER)[number]

/** The pages this person's menu holds, in the menu's order. Empty means the Pages label is not drawn. */
export function gearPagesInOrder(shown: Readonly<Record<GearPageKey, boolean>>): GearPageKey[] {
  return GEAR_PAGE_ORDER.filter((page) => shown[page])
}

/**
 * The Modes group's rows for this person (v2.8332, punch list #425).
 *
 * The mode row above the header (`modeRow.ts`) is the door to Job Mode and Task Mode for the roles it is
 * drawn for, so their menu lists neither: one door, and the tick can never disagree with the row.
 * Dispatch Mode is not on the row, so its menu row stays for whoever can hold it. The row is drawn for
 * every role whose first page is the Dashboard, so the estimator alone keeps the rows it had. The label
 * is drawn only when a row stands under it.
 */
export function gearModesRows(input: { modeRow: boolean; jobEligible: boolean; dispatchEligible: boolean }): {
  job: boolean
  dispatch: boolean
  task: boolean
  label: boolean
} {
  const job = input.jobEligible && !input.modeRow
  const task = !input.modeRow
  const dispatch = input.dispatchEligible
  return { job, dispatch, task, label: job || dispatch || task }
}
