/**
 * The press under the timeline's LAST WORK stop (v2.7684, the owner's ask of 2026-11-17 on the Lien desk's notice
 * pane): its words, who is offered it, and the words after the day is saved or cleared. The press opens the window
 * that sets the last day of work by hand (`LienLastWorkDayWindow`), the same one the months' *Change ›* line saves
 * through. Pure.
 *
 * These live beside `lienLastWorkDay.ts` and not in it, because that file is mirrored into the edge functions
 * (`supabase/functions/_shared/gcKernels`), and screen words have no reader there.
 */
import { formatYmdMonthDay } from './billedExpectedPay'

/** Over a day that came from clock hours or from a person. */
export const LIEN_LAST_WORK_DOOR_CHANGE_WORDS = 'change ›'
/** Over a stand-in (a bill, or the job's creation), where no one has said a day yet. */
export const LIEN_LAST_WORK_DOOR_SET_WORDS = 'set the day ›'

/** One wording on every strip that draws the press; `lienLastWorkStepIsStandIn` says which a stop is. */
export function lienLastWorkDoorWords(standIn: boolean): string {
  return standIn ? LIEN_LAST_WORK_DOOR_SET_WORDS : LIEN_LAST_WORK_DOOR_CHANGE_WORDS
}

/**
 * Who is offered the press: the lien office (`isLienOffice`), on a job the screen holds. A role that cannot change
 * the day, and a strip with no job behind it, get the stop's words and no press.
 */
export function lienLastWorkDoorOffered(who: { office: boolean; hasJob: boolean }): boolean {
  return who.office && who.hasJob
}

/**
 * The day the window opens on when the press under the stop opens it: the day the job reads, when it came from clock
 * hours or from a person; empty over a stand-in (a bill, or the job's creation), which is no day anyone said, so the
 * window asks for one where it would have read *nothing changes*.
 */
export function lienLastWorkOpeningDay(d: { day: string | null; source: 'hand' | 'hours' | 'bill' | 'created' }): string {
  return d.source === 'hand' || d.source === 'hours' ? (d.day ?? '') : ''
}

/**
 * The last day of work as a value in place (punch list #399, the owner's yes of 2026-11-21). A day from clock hours,
 * a bill or the job's creation is a default: bold, its source word after it, and this press beside it. A day set by
 * hand is underlined, and a press on it opens its field.
 */
export const LIEN_LAST_WORK_SET_BY_HAND_WORDS = 'Set by hand'

/** What the value is, for the press's name and the field's. Lower case, so a test can tell it from the window's own field. */
export const LIEN_LAST_WORK_VALUE_LABEL = 'last day of work'

/**
 * The words under the open field. **Keep** writes nothing: it opens the window that shows what moves and asks why,
 * and that window's *Set the day* is the write. The day moves every lien deadline, so it is never saved at once.
 */
export const LIEN_LAST_WORK_KEEP_HINT = 'Keep shows what moves with the day and asks why before anything is saved. Clock hours and pay are not changed.'

/** The press in the open field of a day set by hand: what the day goes back to. */
export function lienLastWorkBackWords(hasClockHours: boolean): string {
  return hasClockHours ? 'Back to clock hours' : "Back to the job's creation day"
}

/** The words after a save: one wording for the line's value and the strip's press. */
export function lienLastWorkSavedWords(day: string): string {
  return `Last day of work set to ${formatYmdMonthDay(day)}. The lien months follow it; clock hours are untouched.`
}

/** The words after *Back to clock hours*, or back to the creation day on a job with no hours. */
export function lienLastWorkClearedWords(hasClockHours: boolean): string {
  return hasClockHours ? 'Back to the clock hours.' : "Back to the job's creation day."
}
