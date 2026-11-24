/**
 * The gear menu's sections (v2.8059, the owner's pick of 2026-11-20).
 *
 * The menu was one long list with a single band in it. It now reads in groups, each under a small label, and
 * no row left its group's place:
 *
 *   the wrench's press     only where the header had no room for it, first and unlabelled
 *   Modes                  the list of Dashboard, Job Mode and Task Mode with one dot, then Dispatch Mode with its
 *                          PO tab: each changes the page (`gearModesRows`)
 *   Show                   Pin bar, Tell the dev, Modes at open, Dark Mode: each shows or hides one thing
 *   Pages                  the pages this menu is the door to, in `GEAR_PAGE_ORDER`
 *   Help and settings      My logbook, Help, Settings
 *   a band, no label       Sign out and the reloads
 *
 * The phone dock's More sheet uses the same four labels. Pure, so the order is tested without a screen.
 */

import { MODE_ROW_WORDS, type ModeRowThird } from './modeRow'
import { taskModeToggleTip } from './taskModeToggle'

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
 * The mode list's order (punch list #425, the owner's pick of 2026-11-23): the page with no mode on top
 * first, then the two modes, Task Mode last since it is pressed least.
 */
export const GEAR_MODE_LIST_ORDER: readonly ModeRowThird[] = ['full', 'job', 'task']

/** The usage control (`ui_nav_clicks`): a row of the mode list pressed, with target `#full`, `#job` or `#task`. */
export const GEAR_MODE_PRESS_CONTROL = 'gear_mode'

/** A row's tip: what a press does, or that the mode is the one on. */
export function gearModeRowTip(third: ModeRowThird, on: boolean): string {
  const word = third === 'full' ? 'the Dashboard' : MODE_ROW_WORDS.thirds[third]
  if (on) return third === 'full' ? 'You are on the Dashboard, with no mode on top' : `${word} is on`
  return third === 'task' ? taskModeToggleTip(false) : `Switch to ${word}`
}

/**
 * The Modes group's rows for this person (v2.8332, punch list #425; at every width since #433).
 *
 * The menu holds the three as a list with one dot, `list`: **Dashboard**, **Job Mode** for whoever can
 * hold it, **Task Mode**. A press goes through the mode row's own rule (`modeRowPressWrites`). Until
 * #433 a phone that had the mode row above the header listed neither mode here. The row now shows only
 * when the app opens and shrinks into this menu's gear, so the list is the door at every width.
 *
 * Dispatch Mode is on neither the row nor the list, so its tick row stays for whoever can hold it.
 * `job` and `task` say whether the list holds that row: the phone dock's More sheet draws its own two
 * switches by them. `label` is always drawn, since the list is never empty.
 */
export function gearModesRows(input: { jobEligible: boolean; dispatchEligible: boolean }): {
  list: ModeRowThird[]
  job: boolean
  dispatch: boolean
  task: boolean
  label: boolean
} {
  const list = GEAR_MODE_LIST_ORDER.filter((third) => third !== 'job' || input.jobEligible)
  return { list, job: list.includes('job'), dispatch: input.dispatchEligible, task: true, label: true }
}
