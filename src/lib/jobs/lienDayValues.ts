/**
 * The Lien desk's days as values in place (punch list #399, the first screen: the last day of work and the days
 * that follow from it). The rule is `src/lib/valuesInPlace.ts`: a date or a count is drawn apart from the words
 * around it, and a kernel marks it with `val` so the screen can draw it with `ValueSentence`.
 *
 * The lien kernels write whole sentences, and those sentences have other readers that want plain words: a
 * tooltip, a folded summary, the Dashboard's line, an email. So nothing here rewrites a sentence or works out a
 * day. Each function takes the sentence its kernel already wrote and hands back the same words with the days
 * marked. `plainSentence` of the answer is the sentence that went in, and the tests hold that for every one.
 *
 * Every value marked here is one the app works out, so the screens draw them bold with no press. The last day of
 * work can be set by hand, and it moves every lien deadline. Its change stays behind the line's own *Change ›* and
 * the window that shows what moves, until the owner says a press on the value may open it.
 *
 * This file is not mirrored into the edge functions. `lienLastWorkDay.ts` is, and screen words have no reader
 * there, which is why the marked forms of its two sentences live here beside `lienLastWorkDoor.ts`.
 */
import { val } from '../valuesInPlace'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatYmdMonthDay } from './billedExpectedPay'
import { lienHoursAfterHandDayWords, type LienLastWorkDay } from './lienLastWorkDay'

/** What a marked value on the Lien desk is: a calendar day, a work month, or a count of days. */
export type LienDayValueKind = 'day' | 'month' | 'days'

const MON = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)'
/** A plain space, or the no-break space `keepDatesWhole` puts inside a date. */
const SP = '[ \\u00a0]'
/**
 * The three shapes the lien kernels write a day in, tried in this order at each place:
 *   1. a day as `lienDateWords` and `formatYmdMonthDay` write it: `Oct 15`, `Dec 15, 2027`
 *   2. a work month with its year, as the LAST WORK stop prints it: `Aug 2026`
 *   3. a count of days as `daysWords` and the window captions write it: `22 days`, `1 day`, `+5 days`, `21 of 75 days`
 * A month name alone (`the Jul notice`) and a count of something else (`4 windows closed`) are not days and stay words.
 */
const DAYS = new RegExp(`\\b(${MON}${SP}\\d{1,2}\\b(?:,${SP}\\d{4}\\b)?)|\\b(${MON}${SP}\\d{4})\\b|((?:\\b\\d+${SP}of${SP})?(?:\\+|\\b)\\d+${SP}days?)\\b`, 'g')

/**
 * A sentence a lien kernel wrote, with every day in it marked: `22 days · re-asks Oct 3` becomes
 * `⟪days|22 days⟫ · re-asks ⟪day|Oct 3⟫`. The words, their order and their spaces are untouched. A sentence
 * with no day in it comes back as it went in.
 */
export function lienDayValues(sentence: string | null | undefined): string {
  const text = sentence ?? ''
  if (!text) return ''
  return text.replace(DAYS, (whole: string, day?: string, month?: string) => val(day ? 'day' : month ? 'month' : 'days', whole))
}

/** Whether a kernel's sentence holds a day at all: the strip draws a value's look only where there is a value. */
export function lienHasDayValue(sentence: string | null | undefined): boolean {
  return lienDayValues(sentence) !== (sentence ?? '')
}

/**
 * The last-day line's source words with who set the day and when marked: `set by hand · ⟪who|Robert⟫ · ⟪when|Oct 6⟫`.
 * The plain words are `lienLastWorkSourceLine`'s, piece for piece. A day that came from clock hours, a bill or the
 * job's creation has no one and no day to name, and reads as its source alone.
 */
export function lienLastWorkSourceValues(d: Pick<LienLastWorkDay, 'source' | 'sourceWords' | 'setAt'>, setByName?: string | null): string {
  if (d.source !== 'hand') return d.sourceWords
  const who = (setByName ?? '').trim()
  const when = d.setAt ? formatYmdMonthDay(calendarYmdInAppTzFromIso(d.setAt)) : ''
  return [d.sourceWords, who ? val('who', who) : '', when ? val('when', when) : ''].filter(Boolean).join(' · ')
}

/**
 * The line beside a hand day that later hours follow, with the hours' last day marked: `Hours were approved after
 * it, through ⟪hours|Oct 20⟫. They do not move it.` The sentence is `lienHoursAfterHandDayWords`'s own, so the two
 * cannot part. '' when there are no later hours.
 */
export function lienHoursAfterHandDayValues(laterHoursDay: string): string {
  const words = lienHoursAfterHandDayWords(laterHoursDay)
  if (!words) return ''
  const day = formatYmdMonthDay(laterHoursDay)
  const at = words.indexOf(day)
  return at < 0 ? words : `${words.slice(0, at)}${val('hours', day)}${words.slice(at + day.length)}`
}
