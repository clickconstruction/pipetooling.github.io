/**
 * The swipe that puts a row away (punch list #426): one gesture for the Dashboard's My Bids and
 * Recent Reports, drawn by `SwipeAwayRow`. Swipe a row to the left. A strip under it names the act.
 * Past the mark the strip turns blue, and letting go puts the row away. Short of the mark the row
 * springs back. The card says what happened with Undo, and keeps what was put away in a folded
 * group at its foot.
 *
 * Left only: People's phone rows already slide left to show their presses and the Pipeline's rows
 * slide right to move a job forward, so left keeps one meaning. The phone's Back swipe starts at the
 * left edge and moves right, so a left swipe never starts it.
 */
import { MORE_SWIPE_GREY } from './people/usersTabPhone'

/** The strip under the row: wide enough for *Mark opened* to read before the mark. */
export const SWIPE_AWAY_STRIP_WIDTH = 160

/** How far the row travels before letting go puts it away. A third of a phone's width, so a scroll that drifts does not. */
export const SWIPE_AWAY_SETTLE_AT = 112

/** The strip at rest: the grey of the People rows' More, 4.83 to 1 under white words in both themes. */
export const SWIPE_AWAY_REST = MORE_SWIPE_GREY

/** The strip past the mark: the app's blue press under white words. */
export const SWIPE_AWAY_ARMED = '#2563eb'

/** True while the row is dragged past the mark: letting go now puts it away. */
export function swipeAwayArmed(dragging: boolean, offset: number): boolean {
  return dragging && offset <= -SWIPE_AWAY_SETTLE_AT
}

/** What a screen reader hears on the strip's press and on the word press: the act, then the row. */
export function swipeAwayPressName(label: string, name: string): string {
  return `${label}, ${name}`
}

/** The line at a card's foot that says the gesture, on a device held in the hand: *Swipe a bid left to hide it.* */
export function swipeAwayHint(noun: string, act: string): string {
  return `Swipe ${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun} left to ${act}.`
}
