/**
 * The mode row (punch list #425): **Task Mode · Dashboard · Job Mode**, one line above the header.
 *
 * It took the place of the Dashboard's Job Mode offer card, whose small grey text nobody read and was
 * the only place that said how to get back. The row is the way in and the way back in one spot: three
 * thirds, the one drawn filled, and a press on another switches to it.
 *
 * On the Dashboard the row is **counted** (punch list #433, the owner's look on a real phone,
 * 2026-11-24). It is the first thing a person sees when the app opens: it shows for five seconds,
 * with a bar on its lower edge that runs out, then shrinks into the gear. A press on a third closes
 * it the same way, at once. `modeRowCount.ts` is that count. The row lies over the top of the page
 * and never pushes it, and it leaves nothing in its place: no handle and no pull. From then on the
 * modes are changed in the gear menu, which the row's way out points at.
 *
 * In Task Mode the row is **held**: a line of the page, always in sight, with no count. Task Mode is
 * one page and a gear, and the row is its way out.
 *
 * The row is a phone's. Past a phone's width it is not drawn. The gear menu lists the same three as
 * a list with one dot at every width (`gearModesRows`). A press there goes through this file's own
 * rule, so the row and the list can never disagree. The menu's Show group holds the row's switch,
 * **Modes at open**: unticked, this phone opens with no row.
 *
 * The middle third is no mode on top: it switches Task Mode and Job Mode off and leaves Dispatch Mode
 * alone, so a leader or the office keeps the Dispatch Mode bar (`pageMode.ts`). Dispatch Mode stays a
 * row of the gear menu. The estimator, the one role this row is not drawn for, has the gear menu's list
 * at every width.
 *
 * This file is the rule and every word on the row. The rule is pure. The one thing kept on the phone
 * is the switch above, and only once someone unticks it.
 */

import type { UserRole } from '../types/userRole'
import { canLeaveJobFieldReport } from './canLeaveJobFieldReport'
import type { PageMode, PageModeWrite } from './pageMode'
import { roleHomePath } from './roleGate'

type Role = UserRole | string | null | undefined

/** A third of the row. `full` is the Dashboard with no mode on top. */
export type ModeRowThird = 'task' | 'full' | 'job'

/** Left to right. Task Mode is pressed least, so it is furthest from a right thumb. */
export const MODE_ROW_THIRDS: readonly ModeRowThird[] = ['task', 'full', 'job']

export const MODE_ROW_WORDS = {
  /** The row's name for a screen reader. */
  group: 'Mode',
  thirds: { task: 'Task Mode', full: 'Dashboard', job: 'Job Mode' } satisfies Record<ModeRowThird, string>,
} as const

/** The usage controls (`ui_nav_clicks`): a third pressed, and the row sent away by a swipe. */
export const MODE_ROW_PRESS_CONTROL = 'mode_row'
export const MODE_ROW_SENT_CONTROL = 'mode_row_sent'

/**
 * The mark on the press the row shrinks into: the header's gear. `ModeRow` finds it by this name when
 * the row leaves. Where no gear is on the screen (the role dock's row has none) the row slides up.
 */
export const MODE_ROW_HOME_ATTR = 'data-mode-row-home'

/* ------------------------------------------------------------------ the switch: Modes at open */

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The stored key. No user id in it: the switch is the phone's. Present only while the row is switched off. */
export const MODE_ROW_AT_OPEN_OFF_STORAGE_KEY = 'pt_mode_row_at_open_off'

/** Same-tab change signal: a `storage` event only fires in other tabs. */
export const MODE_ROW_AT_OPEN_CHANGED_EVENT = 'pipetooling:mode-row-at-open-changed'

/** Whether this phone shows the row when the app opens. On when nothing is stored, or storage cannot be read. */
export function readModeRowAtOpen(storage: StorageLike | null | undefined): boolean {
  try {
    return storage?.getItem(MODE_ROW_AT_OPEN_OFF_STORAGE_KEY) !== '1'
  } catch {
    return true
  }
}

/** Tick or untick the switch on this phone. Ticked stores nothing, so a phone is as it was before the switch. */
export function writeModeRowAtOpen(storage: StorageLike | null | undefined, on: boolean): void {
  try {
    if (on) storage?.removeItem(MODE_ROW_AT_OPEN_OFF_STORAGE_KEY)
    else storage?.setItem(MODE_ROW_AT_OPEN_OFF_STORAGE_KEY, '1')
  } catch {
    // A phone with storage switched off keeps the row at open.
  }
}

/**
 * Every role whose first page is the Dashboard, the page the row sits on (the owner, 2026-11-23: *give
 * it to everyone*). That is eight of the nine. An estimator who opens the app lands on Bids: `/` is not
 * on the estimator's list, so `Layout`'s route guard sends it to `roleHomePath`, and only a fresh sign-in
 * lands on the Dashboard. The owner saw the row drawn on top of Bids the same day and left the estimator
 * out, so the estimator keeps the gear menu's Modes rows. A role nobody knows gets nothing.
 */
export function modeRowOfferedToRole(role: Role): boolean {
  return canLeaveJobFieldReport(role) && roleHomePath(role) === '/dashboard'
}

/**
 * The pages the row is drawn on: the Dashboard in any mode, and the checklist while Task Mode is on,
 * which is the one page Task Mode leaves.
 */
export function modeRowOnPage(pathname: string, mode: PageMode): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/dashboard') return true
  return mode === 'task' && path === '/checklist'
}

/** The third drawn filled. Dispatch Mode is a bar, not a place, so it reads as the Dashboard. */
export function modeRowThirdOn(mode: PageMode): ModeRowThird {
  if (mode === 'task') return 'task'
  if (mode === 'job') return 'job'
  return 'full'
}

/**
 * What a press asks of the page mode's one door, in order. Task Mode and Job Mode each switch on,
 * and the door switches off what would be drawn over them. The Dashboard switches both off and
 * leaves Dispatch Mode as it was. A write that would change nothing is dropped by the door.
 */
export function modeRowPressWrites(third: ModeRowThird): PageModeWrite[] {
  if (third === 'task') return [{ key: 'task', on: true }]
  if (third === 'job') return [{ key: 'job', on: true }]
  return [
    { key: 'task', on: false },
    { key: 'job', on: false },
  ]
}

/** Where a press lands when the page it was pressed on is not the new mode's. Task Mode's own bounce sends it to the checklist. */
export function modeRowLandingPath(third: ModeRowThird, pathname: string): string | null {
  if (third === 'task') return null
  const path = pathname.replace(/\/+$/, '') || '/'
  return path === '/dashboard' ? null : '/dashboard'
}

/**
 * Whether the row is held: a line of the page, always in sight, never counted. That is Task Mode, where
 * the app is one page with a gear and the row is the way out, as the green *Task Mode · Exit* strip
 * was. Until #433 a sub or a helper off Job Mode held it too. Now they get the same five seconds as
 * everyone when the app opens, and the gear menu's list after that.
 */
export function modeRowHeldOpen(mode: PageMode): boolean {
  return mode === 'task'
}

/**
 * Whether the row is drawn for this person at this width. It is a phone's: a desk or a tablet has the
 * gear menu's list alone (`gearModesRows`), the green *Task Mode · Exit* strip while Task Mode is on and
 * **Show full dashboard** at the foot of the Job Mode page.
 */
export function modeRowDrawnHere(role: Role, phone: boolean): boolean {
  return phone && modeRowOfferedToRole(role)
}

/**
 * `none`: not this role, this width or this page, or a Dashboard on a phone whose switch is unticked.
 * `held`: the three thirds as a line of the page, for good. `counted`: the row over the top of the
 * page for five seconds when the app opens, and nothing in its place after.
 */
export type ModeRowDraw = 'none' | 'held' | 'counted'

export function modeRowDraw(input: {
  role: Role
  pathname: string
  mode: PageMode
  /** A phone's width. Past it the row is not drawn. */
  phone: boolean
  /** The phone's switch, **Modes at open** (`readModeRowAtOpen`). Task Mode's row does not read it: it is the way out. */
  atOpen: boolean
}): ModeRowDraw {
  if (!modeRowDrawnHere(input.role, input.phone) || !modeRowOnPage(input.pathname, input.mode)) return 'none'
  if (modeRowHeldOpen(input.mode)) return 'held'
  return input.atOpen ? 'counted' : 'none'
}
