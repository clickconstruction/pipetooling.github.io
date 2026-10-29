/**
 * The Job Mode press bar (punch list #189, PR 2, v2.5905).
 *
 * On a phone the day's press leaves the scrolling card for a bar pinned above the tab bar: a row
 * of three 44 px buttons (Turnaway, % done, Clock out) over Leave report and the day's press at
 * 56 px. This kernel is the one place the bar's rows are decided — which buttons show, their
 * words, which are disabled — from the card's state, the role, the open session, hourly or
 * salaried, and whether there is a current job. `JobModePressBar` only draws what it returns, and
 * `DashboardJobModeCard` reads the day's press from `pickJobModeDayPress` for the desktop grid
 * and the bar alike, so the two cannot drift.
 *
 * The words are imported, never retyped: the On my way / I'm here labels are `ON_MY_WAY_WORDS`',
 * the rest of the card's labels live in `JOB_MODE_PRESS_WORDS` below and the card reads them
 * from here.
 */
import type { UserRole } from '../../hooks/useAuth'
import { CLOCK_IN_ACCENT_ORANGE, CLOCK_IN_ACCENT_TEXT } from '../clock/clockColors'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../deadPress'
import type { JobModeState } from '../jobModePickCurrentNext'
import { isSubcontractorLikeRole } from '../subcontractorLikeRole'
import { ON_MY_WAY_WORDS, type Leg } from './onMyWay'

/** The card's big-button words (two lines where the desktop grid draws them so). One source. */
export const JOB_MODE_PRESS_WORDS = {
  clockIn: 'Clock In',
  onMyWay: ON_MY_WAY_WORDS.button,
  imHere: ON_MY_WAY_WORDS.hereButton,
  wrapUp: 'Wrap Up\nDay',
  lastJob: 'Last job\nof the day',
  chooseNext: 'Choose Next\nJob',
  leaveReport: 'Leave\nReport',
  turnaway: 'Turnaway — not ready / not home',
  clockOut: 'Clock out',
} as const

/** The bar's own short words, the mock-up's (to-dos/phone-first, approved 2026-10-26). */
export const PRESS_BAR_WORDS = {
  turnaway: 'Turnaway',
  pctDone: '% done',
  clockOut: JOB_MODE_PRESS_WORDS.clockOut,
  leaveReport: 'Leave report',
} as const

/** The CSS variable the bar sets while mounted; Layout adds it to the page's bottom padding. */
export const JOB_MODE_PRESS_BAR_VAR = '--job-mode-press-bar'

export type DayPressKind = 'manual-clock-in' | 'next' | 'im-here' | 'wrap-up' | 'last-job' | 'open-update-focus'
export type DayPressTone = 'orange' | 'green' | 'blue' | 'red' | 'grey'

/**
 * The day's press colours by tone, the card's own: Clock In in the clock-in orange (v2.3193), On my
 * way green, I'm here blue (v2.5573), Wrap Up Day red, a dead press the theme's grey (`DEAD_PRESS_FILL`, v2.6062). Action colours stay literal
 * (CLAUDE.md → Theme tokens); the desktop grid and the press bar both read them here.
 */
export const DAY_PRESS_COLORS: Record<DayPressTone, string> = {
  orange: CLOCK_IN_ACCENT_ORANGE,
  green: '#16a34a',
  blue: '#1d4ed8',
  red: '#dc2626',
  grey: DEAD_PRESS_FILL,
}

/** The words on each press colour: white, but dark on the clock-in orange, where white read 2.94:1 (v2.5981), and the theme's dark grey on a dead press, where white read 2.54:1 (v2.6062). */
export const DAY_PRESS_TEXT: Record<DayPressTone, string> = {
  orange: CLOCK_IN_ACCENT_TEXT,
  green: 'white',
  blue: 'white',
  red: 'white',
  grey: DEAD_PRESS_TEXT,
}

/** Leave report's blue, the card's. */
export const LEAVE_REPORT_BLUE = '#2563eb'

/** The day's press: the card's six states, one button. */
export type JobModeDayPress = {
  kind: DayPressKind
  /** Which advance a `next` press means — the first job of the day, or the next one. Null otherwise. */
  intent: 'start-first' | 'next-job' | null
  label: string
  tone: DayPressTone
  disabled: boolean
}

/**
 * The day's press from the card's state (`pickCurrentAndNextScheduleBlock`), the open session's leg
 * (`legOf`), whether a next block exists and whether the person clocks out by hand. The six states:
 * Clock In (no clock, no schedule, orange), On my way (green), I'm here (on the way, blue),
 * Wrap Up Day (last job, hourly, red), Last job of the day (last job, salaried, grey and dead),
 * Choose Next Job (nothing next, green).
 */
export function pickJobModeDayPress(input: {
  leg: Leg
  state: JobModeState
  hasNextBlock: boolean
  canClockOut: boolean
}): JobModeDayPress {
  const { leg, state, hasNextBlock, canClockOut } = input
  // On the way (v2.5573): the one press is the arrival.
  if (leg === 'on-the-way') {
    return { kind: 'im-here', intent: null, label: JOB_MODE_PRESS_WORDS.imHere, tone: 'blue', disabled: false }
  }
  if (state === 'no-clock-no-schedule') {
    return { kind: 'manual-clock-in', intent: null, label: JOB_MODE_PRESS_WORDS.clockIn, tone: 'orange', disabled: false }
  }
  if (state === 'not-clocked-in-with-schedule' && hasNextBlock) {
    return { kind: 'next', intent: 'start-first', label: JOB_MODE_PRESS_WORDS.onMyWay, tone: 'green', disabled: false }
  }
  if (state === 'on-scheduled-job-not-last' && hasNextBlock) {
    return { kind: 'next', intent: 'next-job', label: JOB_MODE_PRESS_WORDS.onMyWay, tone: 'green', disabled: false }
  }
  if (state === 'on-scheduled-job-last') {
    // Every other job today is visited — offer the day's ending instead of a dead button
    // (v2.2558). Salaried users keep the informational label.
    if (canClockOut) return { kind: 'wrap-up', intent: null, label: JOB_MODE_PRESS_WORDS.wrapUp, tone: 'red', disabled: false }
    return { kind: 'last-job', intent: null, label: JOB_MODE_PRESS_WORDS.lastJob, tone: 'grey', disabled: true }
  }
  if ((state === 'on-off-schedule-job' || state === 'on-bid') && hasNextBlock) {
    return { kind: 'next', intent: 'next-job', label: JOB_MODE_PRESS_WORDS.onMyWay, tone: 'green', disabled: false }
  }
  // No next block — the regular Update Focus modal, where a job can be searched for.
  return { kind: 'open-update-focus', intent: null, label: JOB_MODE_PRESS_WORDS.chooseNext, tone: 'green', disabled: false }
}

/** My Schedule's Update % done gate (v2.1806, superintendents since v2.2635): subs, helpers, superintendents. */
export function pctDoneOffered(role: UserRole | null | undefined): boolean {
  return isSubcontractorLikeRole(role) || role === 'superintendent'
}

/** The quiet Clock out's rule: an open session, clocked out by hand, and Wrap Up Day not already the day's press. */
export function clockOutOffered(input: { sessionOpen: boolean; canClockOut: boolean; dayPressKind: DayPressKind }): boolean {
  return input.sessionOpen && input.canClockOut && input.dayPressKind !== 'wrap-up'
}

export type PressBarButtonId = 'turnaway' | 'pct-done' | 'clock-out' | 'leave-report' | 'day-press'

export type PressBarButton = {
  id: PressBarButtonId
  label: string
  disabled: boolean
}

/** The bar's two rows: the small row over the big one. A hidden slot leaves the row to the rest. */
export type PressBarRows = {
  top: PressBarButton[]
  bottom: PressBarButton[]
}

/** A two-line card label on one line in the bar ("On my\nway" → "On my way"). */
export function oneLine(label: string): string {
  return label.replace(/\n/g, ' ')
}

/**
 * The bar's rows. Turnaway and Leave report always show and are dead without a current job (the
 * card's `leaveReportTarget`); % done shows only for the roles that move a job's percent and only
 * with a job clocked in; Clock out shows under the quiet link's rule; the day's press is always
 * the last button, one line.
 */
export function buildJobModePressBar(input: {
  dayPress: JobModeDayPress
  role: UserRole | null | undefined
  sessionOpen: boolean
  canClockOut: boolean
  hasCurrentJob: boolean
}): PressBarRows {
  const { dayPress, role, sessionOpen, canClockOut, hasCurrentJob } = input
  const top: PressBarButton[] = [{ id: 'turnaway', label: PRESS_BAR_WORDS.turnaway, disabled: !hasCurrentJob }]
  if (pctDoneOffered(role) && hasCurrentJob) top.push({ id: 'pct-done', label: PRESS_BAR_WORDS.pctDone, disabled: false })
  if (clockOutOffered({ sessionOpen, canClockOut, dayPressKind: dayPress.kind })) {
    top.push({ id: 'clock-out', label: PRESS_BAR_WORDS.clockOut, disabled: false })
  }
  const bottom: PressBarButton[] = [
    { id: 'leave-report', label: PRESS_BAR_WORDS.leaveReport, disabled: !hasCurrentJob },
    { id: 'day-press', label: oneLine(dayPress.label), disabled: dayPress.disabled },
  ]
  return { top, bottom }
}
