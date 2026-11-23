/**
 * The mode row (punch list #425): **Task Mode · Dashboard · Job Mode**, one line above the header.
 *
 * It took the place of the Dashboard's Job Mode offer card, whose small grey text nobody read and was
 * the only place that said how to get back. The row is the way in and the way back in one spot: three
 * thirds, the one drawn filled, and a press on another switches to it.
 *
 * On a phone the row is **tucked**. It shows on a person's first visits, after every switch and while
 * a guard below holds it open. After that the page opens with the row out of sight, and a pull down at
 * the top of the page, or a tap on the small handle there, brings it down. The app switches off the
 * rubber band at the top of every page (`overscroll-behavior-y: none` in `index.css`), so nothing else
 * answers that pull.
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
 * This file is the rule and every word on the row. The rule is pure. The phone's memory of the row
 * (was a third ever pressed, how many times the page opened) is read and written at the foot.
 */

import type { UserRole } from '../hooks/useAuth'
import { canLeaveJobFieldReport } from './canLeaveJobFieldReport'
import type { PageMode, PageModeWrite } from './pageMode'
import { roleHomePath } from './roleGate'
import { isSubcontractorLikeRole } from './subcontractorLikeRole'

type Role = UserRole | string | null | undefined

/** A third of the row. `full` is the Dashboard with no mode on top. */
export type ModeRowThird = 'task' | 'full' | 'job'

/** Left to right. Task Mode is pressed least, so it is furthest from a right thumb. */
export const MODE_ROW_THIRDS: readonly ModeRowThird[] = ['task', 'full', 'job']

export const MODE_ROW_WORDS = {
  /** The row's name for a screen reader. */
  group: 'Mode',
  thirds: { task: 'Task Mode', full: 'Dashboard', job: 'Job Mode' } satisfies Record<ModeRowThird, string>,
  /** The mark on Job Mode until the person has pressed a third. */
  newMark: 'New',
  /** The handle's name and its tip. */
  handle: 'Show the mode switcher',
  handleTip: 'Pull down or tap here to switch between Task Mode, the Dashboard and Job Mode',
} as const

/** Whether the small handle is drawn on the page's top while the row is tucked. One line to change. */
export const MODE_ROW_HANDLE = true

/** The row shows on this many opens of the page before it starts to tuck, unless a third is pressed first. */
export const MODE_ROW_FIRST_VISITS = 5

/**
 * How long the row stays on the page before the open is counted. The office's phone opens on the
 * Dashboard and is sent on to the schedule within a moment (`assistantDispatchLanding`), and that is
 * not a look at the row: counted, five such landings would tuck a row nobody had seen.
 */
export const MODE_ROW_OPEN_DWELL_MS = 1500

/** How far a finger travels down, at the top of the page, before the row comes down. */
export const MODE_ROW_PULL_PX = 36

/** The usage controls (`ui_nav_clicks`): a third pressed, and the tucked row brought down. */
export const MODE_ROW_PRESS_CONTROL = 'mode_row'
export const MODE_ROW_SHOWN_CONTROL = 'mode_row_shown'

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

/** What this phone remembers of the row for this person. */
export interface ModeRowMemory {
  /** A third was pressed here, ever. */
  pressed: boolean
  /** How many times the page opened with the row on it, this open counted. */
  opens: number
}

export const MODE_ROW_NO_MEMORY: ModeRowMemory = { pressed: false, opens: 0 }

/** The first visits: the row has to be seen before it earns its tuck. */
export function modeRowFirstVisits(memory: ModeRowMemory): boolean {
  return !memory.pressed && memory.opens <= MODE_ROW_FIRST_VISITS
}

/**
 * The guards that hold the row open on a phone whatever the memory says.
 *
 * - **Task Mode.** The app is one page with a gear, and the green *Task Mode · Exit* strip this row
 *   replaced was always on screen so a borrowed tablet never looked broken. The row keeps that promise.
 * - **A sub or a helper off Job Mode.** Job Mode is their first screen. One of them who pressed
 *   Dashboard keeps the way back in sight until they take it.
 */
export function modeRowHeldOpen(role: Role, mode: PageMode): boolean {
  if (mode === 'task') return true
  return isSubcontractorLikeRole(role as UserRole | null | undefined) && mode !== 'job'
}

/**
 * Whether the row is this person's door to the modes at this width. It is a phone's: a desk or a tablet
 * has the gear menu's list in its place (`gearModesRows`), the green *Task Mode · Exit* strip while Task
 * Mode is on and **Show full dashboard** at the foot of the Job Mode page.
 */
export function modeRowDrawnHere(role: Role, phone: boolean): boolean {
  return phone && modeRowOfferedToRole(role)
}

/** `none`: not this role, this width or this page. `row`: the three thirds. `tucked`: out of sight, a pull away. */
export type ModeRowDraw = 'none' | 'row' | 'tucked'

export function modeRowDraw(input: {
  role: Role
  pathname: string
  mode: PageMode
  /** A phone's width. Past it the row is not drawn. */
  phone: boolean
  memory: ModeRowMemory
  /** Brought down this visit: by a pull, the handle or a switch. */
  shownNow: boolean
}): ModeRowDraw {
  if (!modeRowDrawnHere(input.role, input.phone) || !modeRowOnPage(input.pathname, input.mode)) return 'none'
  if (input.shownNow) return 'row'
  if (modeRowFirstVisits(input.memory) || modeRowHeldOpen(input.role, input.mode)) return 'row'
  return 'tucked'
}

/** Job Mode wears the mark until a third is pressed, and only while it is the one not yet tried. */
export function modeRowNewMark(third: ModeRowThird, mode: PageMode, memory: ModeRowMemory): boolean {
  return third === 'job' && mode !== 'job' && !memory.pressed
}

/**
 * One reading of a finger on the page while the row is tucked. `pull` brings the row down. `cancel`
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

/** The open this page load makes of the stored count. It stops one past the first visits, so it never grows. */
export function modeRowCountOpen(memory: ModeRowMemory): ModeRowMemory {
  return { ...memory, opens: Math.min(memory.opens + 1, MODE_ROW_FIRST_VISITS + 1) }
}

/* ------------------------------------------------------------------ the phone's memory */

const PRESSED_PREFIX = 'mode_row_pressed'
const OPENS_PREFIX = 'mode_row_opens'

export function modeRowPressedKey(userId: string): string {
  return `${PRESSED_PREFIX}_${userId}`
}

export function modeRowOpensKey(userId: string): string {
  return `${OPENS_PREFIX}_${userId}`
}

/** Pure: whatever is in storage, as a memory. Anything unreadable is no memory. */
export function parseModeRowMemory(pressed: string | null | undefined, opens: string | null | undefined): ModeRowMemory {
  const n = Number.parseInt(opens ?? '', 10)
  return { pressed: pressed === '1', opens: Number.isFinite(n) && n > 0 ? n : 0 }
}

export function readModeRowMemory(userId: string | null | undefined): ModeRowMemory {
  if (!userId) return MODE_ROW_NO_MEMORY
  try {
    if (typeof localStorage === 'undefined') return MODE_ROW_NO_MEMORY
    return parseModeRowMemory(localStorage.getItem(modeRowPressedKey(userId)), localStorage.getItem(modeRowOpensKey(userId)))
  } catch {
    return MODE_ROW_NO_MEMORY
  }
}

export function writeModeRowMemory(userId: string | null | undefined, memory: ModeRowMemory): void {
  if (!userId) return
  try {
    if (typeof localStorage === 'undefined') return
    if (memory.pressed) localStorage.setItem(modeRowPressedKey(userId), '1')
    else localStorage.removeItem(modeRowPressedKey(userId))
    localStorage.setItem(modeRowOpensKey(userId), String(memory.opens))
  } catch {
    // ignore
  }
}
