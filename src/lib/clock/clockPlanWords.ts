/**
 * The clock's two note boxes and the presses under them (punch list #446, v2.8624). The clock-in sheet asks what
 * you plan to get done and the clock-out review what you worked on; neither press may act with its box empty. Until
 * this file Complete Clock In stood live and refused by a toast, which to a person looked like a dead press that was
 * pressed, and the clock-out review's press was dead with no word of why. The house rule: a press that cannot act is
 * dead, drawn with the dead press's pair, and the screen says what brings it alive. Pure.
 */

import { hereNote, travelNote } from '../jobMode/onMyWay'

/**
 * Over the clock-in sheet's job and bid search: which job or bid the day's time goes to. It read *change* from the
 * day the sheet was written, and a walk of 2026-11-27 asked whether *charge* was meant (finding 296).
 */
export const CLOCK_IN_JOB_OR_BID_QUESTION = 'What job or bid should we charge for your time?'

/** Under the clock-in sheet's box while it is empty. */
export const CLOCK_IN_PLAN_EMPTY_LINE = 'Say what you mean to get done today, then Complete Clock In.'

/** Under the clock-out review's box while it is empty. */
export const CLOCK_OUT_NOTE_EMPTY_LINE = 'Say what you worked on today, then Complete clock out.'

/** Whether a note box holds nothing but spaces, so its press is dead. */
export function clockNoteEmpty(text: string): boolean {
  return text.trim() === ''
}

/**
 * Under the clock-out review's box while it still holds the plan typed at clock in (punch list #445). The review has
 * opened on the session's own note since 2026-04 so that clock out is one press (punch list #189), and nothing said
 * where the words came from: a box that looked typed, under *You can leave this empty.*
 */
export const CLOCK_OUT_NOTE_FROM_PLAN_LINE = 'From your plan at clock in. Change it or leave it.'

/** How the two notes Job Mode writes at a start open: *On my way to …* and *On site at …*. */
const JOB_MODE_NOTE_STARTS = [travelNote('', null), hereNote('')]

/**
 * Whether a session's note is words a person typed as their plan. A start from Job Mode writes the note itself, so
 * that one is no plan and the line that names the plan would be untrue over it.
 */
export function clockNoteIsPlan(note: string): boolean {
  const words = note.trim()
  return words !== '' && !JOB_MODE_NOTE_STARTS.some((start) => words.startsWith(start))
}

/**
 * Whether the plan's line draws under the clock-out box: the box opened on a plan, the day's reports did not fill it
 * (their own line says so and wins), and the person has not changed a letter of it.
 */
export function clockOutPlanLineShows(box: { seed: string; text: string; filledFromReports: boolean }): boolean {
  return !box.filledFromReports && clockNoteIsPlan(box.seed) && box.text === box.seed
}
