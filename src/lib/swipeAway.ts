/**
 * The swipe that puts a row away (punch list #426): one gesture for the Dashboard's My Bids and
 * Recent Reports, drawn by `SwipeAwayRow`. Swipe a row to the left. A strip under it names the act.
 * Past the mark the strip turns blue, and letting go puts the row away. Short of the mark the row
 * springs back. The card says what happened with Undo, and keeps what was put away in a folded
 * group at its foot.
 *
 * Left puts a row away: People's phone rows already slide left to show their presses, so left keeps
 * one meaning. The phone's Back swipe starts at the left edge and moves right, so a left swipe never
 * starts it.
 *
 * Right brings a put-away row back (v2.8603): the rows of a card's folded group slide right over a
 * strip on their left that names the press they had, **Show again** or **Mark unread**. A right
 * swipe counts only when it starts clear of the screen's left edge (`swipeMayStart`). A swipe the
 * wrong way moves nothing away: the row answers by showing its strip on the side it goes
 * (`swipeWrongWay`, `swipeShowReach`).
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

/** The way a row travels: left to be put away, right to come back. */
export type SwipeAwaySide = 'left' | 'right'

/** True while the row is dragged past the mark: letting go now does the act. */
export function swipeAwayArmed(dragging: boolean, offset: number, side: SwipeAwaySide = 'left'): boolean {
  return dragging && (side === 'right' ? offset >= SWIPE_AWAY_SETTLE_AT : offset <= -SWIPE_AWAY_SETTLE_AT)
}

/**
 * How far from the screen's left edge a right swipe must start. Nearer than this is the phone's own
 * Back, which the page cannot stop, so the row stays still under it. A card's row begins about 24 px
 * in, so about 8 px of the row is left out.
 */
export const SWIPE_BACK_EDGE_GUARD = 32

/** Whether a touch that lands at `clientX` may start this row's swipe. A left swipe may start anywhere. */
export function swipeMayStart(side: SwipeAwaySide, clientX: number): boolean {
  return side === 'left' || clientX >= SWIPE_BACK_EDGE_GUARD
}

/** How far a touch must travel against the row's way before the row answers it. Well past a scroll's drift. */
export const SWIPE_WRONG_WAY_AT = 24

/**
 * True when a sideways touch has gone the wrong way far enough to be answered: right on a row that
 * goes left, left on one that goes right. A touch that began in the screen's left edge is the phone's
 * Back and is never answered.
 */
export function swipeWrongWay(side: SwipeAwaySide, dx: number, startX: number): boolean {
  if (startX < SWIPE_BACK_EDGE_GUARD) return false
  return side === 'right' ? dx <= -SWIPE_WRONG_WAY_AT : dx >= SWIPE_WRONG_WAY_AT
}

/**
 * How far a row slides by itself to show its strip: far enough to read the strip's word, 64 px for
 * **Hide** and 108 px for **Mark opened**, and always short of the mark. Only a finger passes the mark,
 * so a row that shows its strip can never do the act.
 */
export function swipeShowReach(label: string): number {
  return Math.min(SWIPE_AWAY_SETTLE_AT - 4, label.length * 8 + 32)
}

/** The row showing its strip by itself: the slide out, the hold with the word in view, the slide back. 1.4 seconds in all. */
export const SWIPE_SHOW_MS = { out: 280, hold: 900, back: 240 } as const

/** What a screen reader hears on the strip's press and on the word press: the act, then the row. */
export function swipeAwayPressName(label: string, name: string): string {
  return `${label}, ${name}`
}

/** The line at a card's foot that says the gesture, on a device held in the hand: *Swipe a bid left to hide it.* */
export function swipeAwayHint(noun: string, act: string): string {
  return `Swipe ${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun} left to ${act}.`
}

/** The way back, said under a put-away group's heading on a device held in the hand: *Swipe one right to show it again.* */
export function swipeBackHint(act: string): string {
  return `Swipe one right to ${act}.`
}
