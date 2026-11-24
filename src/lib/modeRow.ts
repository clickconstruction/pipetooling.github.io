/**
 * The mode row (punch list #425): **Task Mode · Dashboard · Job Mode**, one line above the header.
 *
 * It took the place of the Dashboard's Job Mode offer card, whose small grey text nobody read and was
 * the only place that said how to get back. The row is the way in and the way back in one spot: three
 * thirds, the one drawn filled, and a press on another switches to it.
 *
 * On the Dashboard the row is **counted** (punch list #433, the owner's third look, 2026-11-24). It
 * shows on each visit for five seconds, with a bar on its lower edge that runs out, then slides up
 * and away. `modeRowCount.ts` is that count. The row lies over the top of the page and never pushes
 * it, so nothing under a thumb moves when the row comes or goes. A small handle keeps the row's
 * place. A tap on it, or a pull down at the top of the page, brings the row back. The app switches
 * off the rubber band at the top of every page (`overscroll-behavior-y: none` in `index.css`), so
 * nothing else answers that pull.
 *
 * In Task Mode the row is **held**: a line of the page, always in sight, with no count. Task Mode is
 * one page and a gear, and the row is its way out.
 *
 * The row is a phone's. Past a phone's width it is not drawn, and the gear menu lists the same three
 * as a list with one dot (`gearModesRows`, the owner's second look, 2026-11-23). A press there goes
 * through this file's own rule, so the row and the list can never disagree.
 *
 * The middle third is no mode on top: it switches Task Mode and Job Mode off and leaves Dispatch Mode
 * alone, so a leader or the office keeps the Dispatch Mode bar (`pageMode.ts`). Dispatch Mode stays a
 * row of the gear menu. The estimator, the one role this row is not drawn for, has the gear menu's list
 * at every width.
 *
 * This file is the rule and every word on the row. The rule is pure, and nothing is kept on the
 * phone: until #433 it remembered a press and a count of opens, to decide when the row began to tuck.
 */

import type { UserRole } from '../hooks/useAuth'
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
  /** The handle's name and its tip. */
  handle: 'Show the mode switcher',
  handleTip: 'Pull down or tap here to switch between Task Mode, the Dashboard and Job Mode',
} as const

/** Whether the small handle is drawn in the row's place on the Dashboard. One line to change. */
export const MODE_ROW_HANDLE = true

/** How far a finger travels down, at the top of the page, before the row comes down. */
export const MODE_ROW_PULL_PX = 36

/** The usage controls (`ui_nav_clicks`): a third pressed, the row brought down by hand, and the row sent away by a swipe. */
export const MODE_ROW_PRESS_CONTROL = 'mode_row'
export const MODE_ROW_SHOWN_CONTROL = 'mode_row_shown'
export const MODE_ROW_SENT_CONTROL = 'mode_row_sent'

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
 * everyone, with the handle and the next visit as their ways back.
 */
export function modeRowHeldOpen(mode: PageMode): boolean {
  return mode === 'task'
}

/**
 * Whether the row is this person's door to the modes at this width. It is a phone's: a desk or a tablet
 * has the gear menu's list in its place (`gearModesRows`), the green *Task Mode · Exit* strip while Task
 * Mode is on and **Show full dashboard** at the foot of the Job Mode page.
 */
export function modeRowDrawnHere(role: Role, phone: boolean): boolean {
  return phone && modeRowOfferedToRole(role)
}

/**
 * `none`: not this role, this width or this page. `held`: the three thirds as a line of the page, for
 * good. `counted`: the handle as the page's first line, and the row over it for five seconds a visit.
 */
export type ModeRowDraw = 'none' | 'held' | 'counted'

export function modeRowDraw(input: {
  role: Role
  pathname: string
  mode: PageMode
  /** A phone's width. Past it the row is not drawn. */
  phone: boolean
}): ModeRowDraw {
  if (!modeRowDrawnHere(input.role, input.phone) || !modeRowOnPage(input.pathname, input.mode)) return 'none'
  return modeRowHeldOpen(input.mode) ? 'held' : 'counted'
}

/**
 * One reading of a finger on the page while the row is out of sight. `pull` brings the row down. `cancel`
 * stops watching this touch: the page is not at its top, or the finger went up or sideways.
 */
export function modeRowPull(input: { startX: number; startY: number; x: number; y: number; scrollTop: number }): 'pull' | 'cancel' | 'wait' {
  if (input.scrollTop > 0) return 'cancel'
  const dx = Math.abs(input.x - input.startX)
  const dy = input.y - input.startY
  if (dy < -8) return 'cancel'
  if (dx > 12 && dx > dy) return 'cancel'
  return dy >= MODE_ROW_PULL_PX ? 'pull' : 'wait'
}
