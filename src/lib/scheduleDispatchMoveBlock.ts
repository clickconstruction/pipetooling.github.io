/**
 * Phone-friendly block moves on the Schedule Dispatch board.
 *
 * Drag was the only way to move a block to another day or person, and drag
 * needs a 22px grip and a drop target under the finger — on a phone the
 * next day is off-screen and the grip is a sliver. Two tap paths now share
 * the drop's move kernel (`moveScheduleDispatchBlockTo`): a tap on the grip
 * arms Move placement (tap a day chip or any cell), and a press-and-hold on
 * the card opens the Move sheet (day + person + Save). These helpers build
 * the chips and the Save label so both surfaces say the same thing.
 */

import { scheduleParseDateKeyLocal, JOB_SCHEDULE_TIMEZONE } from './jobScheduleChicago'

export type MoveDayChip = {
  ymd: string
  /** "Thu" */
  weekday: string
  /** "9/3" */
  date: string
  /** The block's current day — shown, but not a target. */
  isSource: boolean
}

function weekdayShort(ymd: string): string {
  const d = scheduleParseDateKeyLocal(ymd)
  if (!d) return ymd
  return new Intl.DateTimeFormat('en-US', { timeZone: JOB_SCHEDULE_TIMEZONE, weekday: 'short' }).format(d)
}

function monthDay(ymd: string): string {
  const d = scheduleParseDateKeyLocal(ymd)
  if (!d) return ''
  return new Intl.DateTimeFormat('en-US', { timeZone: JOB_SCHEDULE_TIMEZONE, month: 'numeric', day: 'numeric' }).format(d)
}

/** One chip per visible day of the week, in grid order. */
export function buildMoveDayChips(visibleDayKeys: readonly string[], sourceYmd: string): MoveDayChip[] {
  return visibleDayKeys.map((ymd) => ({
    ymd,
    weekday: weekdayShort(ymd),
    date: monthDay(ymd),
    isSource: ymd === sourceYmd,
  }))
}

/** "Thu 9/3" — the same label the chips and toasts use. */
export function moveDayLabel(ymd: string): string {
  const md = monthDay(ymd)
  return md ? `${weekdayShort(ymd)} ${md}` : weekdayShort(ymd)
}

export type MoveBlockSelection = {
  sourceYmd: string
  sourceUserId: string
  targetYmd: string
  targetUserId: string
}

export function moveBlockChanged(s: MoveBlockSelection): boolean {
  return s.targetYmd !== s.sourceYmd || s.targetUserId !== s.sourceUserId
}

/**
 * Save-button copy: names only what changes. "Move to Fri 9/4",
 * "Move to Paige", "Move to Fri 9/4 · Paige", or "Nothing to move".
 */
export function moveBlockSaveLabel(s: MoveBlockSelection, targetName: string): string {
  const dayChanged = s.targetYmd !== s.sourceYmd
  const personChanged = s.targetUserId !== s.sourceUserId
  if (!dayChanged && !personChanged) return 'Nothing to move'
  const parts: string[] = []
  if (dayChanged) parts.push(moveDayLabel(s.targetYmd))
  if (personChanged) parts.push(targetName)
  return `Move to ${parts.join(' · ')}`
}
