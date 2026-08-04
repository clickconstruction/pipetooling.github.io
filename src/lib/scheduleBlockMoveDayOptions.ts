/**
 * Day options for the "Move day" row in the Edit schedule block modal.
 *
 * Back-dating is the awkward direction on a phone (Dispatch Mode has no
 * drag-and-drop, so the modal is the only way to move a block off its day).
 * The chips cover the block's own day plus the three before it; anything else
 * goes through the date input beside them.
 */

import {
  scheduleDateKeyAddDays,
  scheduleFormatWeekdayLong,
  scheduleParseDateKeyLocal,
} from './jobScheduleChicago'

/** How many days back the one-tap chips reach. */
export const SCHEDULE_MOVE_DAY_BACK_COUNT = 3

export type ScheduleMoveDayOption = {
  /** Target work_date, YYYY-MM-DD. */
  dateKey: string
  /** Offset from the block's current day; 0 is the block's own day. */
  deltaDays: number
  /** Short weekday, e.g. "Fri". */
  weekdayShort: string
  /** Short month + day, e.g. "Jul 31". */
  monthDayShort: string
  /** Full label for tooltips and screen readers, e.g. "Friday, July 31, 2026". */
  longLabel: string
  /** True when this is the block's current day (nothing moves). */
  isCurrent: boolean
}

function shortParts(dateKey: string): { weekdayShort: string; monthDayShort: string } | null {
  const d = scheduleParseDateKeyLocal(dateKey)
  if (!d) return null
  const weekdayShort = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
  }).format(d)
  const monthDayShort = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  }).format(d)
  return { weekdayShort, monthDayShort }
}

/**
 * Chips for `workDate`, oldest first, ending on the block's own day.
 * Returns `[]` for an unparseable key so the caller renders no date row at all.
 */
export function scheduleMoveDayOptions(
  workDate: string,
  backCount: number = SCHEDULE_MOVE_DAY_BACK_COUNT,
): ScheduleMoveDayOption[] {
  if (!scheduleParseDateKeyLocal(workDate)) return []
  const back = Number.isFinite(backCount) && backCount > 0 ? Math.floor(backCount) : 0
  const out: ScheduleMoveDayOption[] = []
  for (let delta = -back; delta <= 0; delta += 1) {
    const dateKey = delta === 0 ? workDate : scheduleDateKeyAddDays(workDate, delta)
    if (!dateKey) continue
    const parts = shortParts(dateKey)
    if (!parts) continue
    out.push({
      dateKey,
      deltaDays: delta,
      weekdayShort: parts.weekdayShort,
      monthDayShort: parts.monthDayShort,
      longLabel: scheduleFormatWeekdayLong(dateKey),
      isCurrent: delta === 0,
    })
  }
  return out
}

/**
 * Banner text once a different day is picked. `null` while the block is still
 * on its original day, so the caller can hide the row entirely.
 */
export function scheduleMoveDayHint(originalDate: string, selectedDate: string): string | null {
  const sel = selectedDate.trim()
  if (!sel || sel === originalDate.trim()) return null
  if (!scheduleParseDateKeyLocal(sel)) return null
  return `Moving to ${scheduleFormatWeekdayLong(sel)}`
}

/** Save-button label: the move is the consequential half, so it leads. */
export function scheduleMoveDaySaveLabel(originalDate: string, selectedDate: string): string {
  return scheduleMoveDayHint(originalDate, selectedDate) ? 'Move and save' : 'Save changes'
}
