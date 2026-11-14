import type { WhenBarChoice } from './newTaskWindow'

/**
 * Two rows of the task windows that ran past one phone screen (punch list #348, rows 9 and 10).
 */

/**
 * The line under the Done when… box, one for each window.
 *
 * It was up to four sentences, five lines on a phone, and with the box open it pushed the window past one screen.
 * Each window keeps the one thing its giver cannot see from the box itself. The rest is in the guide *give someone
 * a task*: an empty box leaves the percent to the person, every card offers a photo at each new percent, and Photo
 * at the finish holds the finish until a photo is in or a reason is typed.
 */
export const DONE_WHEN_HINT = {
  add: 'The card reads its percent from the ticks.',
  edit: 'A line taken off keeps the ticks already on it.',
  roadmap: 'The task reads its percent from the ticks.',
} as const

/** The longest a Done when… hint may be and still fit one line on a phone: about 50 characters at 13 px in 336 px. */
export const DONE_WHEN_HINT_MAX = 50

/**
 * Whether the When row draws its four weeks (punch list #217) under the bar.
 *
 * A task that repeats always draws them: which days it lands on is what the picture is for. A one-time task draws
 * them at a desk, for a picked day or a due day, as it has since #217. On a phone it does not: the four weeks
 * pushed Where and Add below the screen, the bar already names the day, and the phone's own calendar opens from
 * the date box.
 */
export function showsFourWeeks(a: { phone: boolean; repeats: boolean; hasDue: boolean; choice: WhenBarChoice; startInPast: boolean }): boolean {
  if (a.repeats) return true
  if (a.phone) return false
  if (a.hasDue) return true
  // Tomorrow needs no picture, the sentence says it, and a day that has passed is not on these weeks at all.
  return !(a.choice === 'tomorrow' || a.startInPast)
}
