/**
 * The Bid window's presses on a phone (punch list #426, the live walk of 2026-11-24, and the live look after it).
 *
 * - **The top:** **Copy for text** and **Edit bid** stood 33 px tall and the ✕ 30 by 33. Since one press on a My Bids
 *   row opens this window, its ✕ is the way back on every bid.
 * - **The chips:** the *Open in Bids* tabs stood 26.5 px tall, and the *Files & links* chips are the same kind.
 * - **The presses in a line of words:** **Map** stood 16 px tall, **Show all fields** 18.7 and the GC's name 22.8.
 *   The development's door is drawn the same way.
 *
 * At a phone's width (640 px and under) each stands a fingertip tall. A chip grows and its row with it. A press in a
 * line of words takes padding, and a margin gives the same back, so the line stays where it was drawn and a name that
 * wraps to two lines still fits. At a desk every function here adds nothing. The height is `phonePress.ts`'s, the one
 * source for it. Pure.
 */
import type { CSSProperties } from 'react'
import { PHONE_PRESS_MIN_HEIGHT, thumbInLine } from '../phonePress'

/** A desk takes nothing: one frozen object, so the window's spread is a no-op there. */
const DESK: CSSProperties = Object.freeze({})

/** **Copy for text** and **Edit bid**: a fingertip tall on a phone, their words centred as a button centres them. */
export function bidWindowHeadPress(narrow: boolean): CSSProperties {
  return narrow ? { minHeight: PHONE_PRESS_MIN_HEIGHT, boxSizing: 'border-box' } : DESK
}

/**
 * Whether the window's head stacks (punch list #426, finding 262). At a desk the bid's name sits beside **Copy for
 * text**, **Edit bid** and the ✕. On a phone the three kept their width and the name got about a quarter of the head:
 * a three-word name wrapped to four lines and broke inside a word. So on a phone the name takes the first line with the
 * ✕ at its right, and the two presses sit on the line under it.
 */
export function bidWindowHeadStacks(narrow: boolean): boolean {
  return narrow
}

/** The window's ✕: a fingertip's square on a phone. */
export function bidWindowClosePress(narrow: boolean): CSSProperties {
  return narrow ? { minHeight: PHONE_PRESS_MIN_HEIGHT, minWidth: PHONE_PRESS_MIN_HEIGHT, boxSizing: 'border-box' } : DESK
}

/** An *Open in Bids* tab and a *Files & links* chip: a fingertip tall on a phone. The row grows with them. */
export function bidWindowChipPress(narrow: boolean): CSSProperties {
  return narrow ? { minHeight: PHONE_PRESS_MIN_HEIGHT, boxSizing: 'border-box' } : DESK
}

/**
 * What each press in a line of words measured on the live site at 430 px, rounded down so the press never comes out
 * under a fingertip. `width` is there only for a press narrower than a fingertip. `marginTop` is the gap the press is
 * drawn with above it, which the phone's margin keeps.
 */
export const BID_WINDOW_LINE_DRAWN = {
  map: { height: 16, width: 27 },
  showAllFields: { height: 18 },
  gcName: { height: 22 },
  development: { height: 15, marginTop: 4 },
} as const

type DrawnLinePress = { height: number; width?: number; marginTop?: number }

/**
 * A press in a line of words: padding makes it a fingertip tall (and wide, when `width` is given), and the margin
 * gives the same back, so nothing around it moves. Padding, not a minimum height, so a name on two lines keeps its
 * second line clear of what is under it. The caller's own `padding` and `margin` must be the shorthands, which these
 * replace whole.
 */
export function bidWindowLinePress(narrow: boolean, drawn: DrawnLinePress): CSSProperties {
  if (!narrow) return DESK
  const up = -thumbInLine(drawn.height).marginTop
  const side = drawn.width == null ? 0 : Math.max(0, PHONE_PRESS_MIN_HEIGHT - drawn.width) / 2
  const px = (n: number) => (n === 0 ? '0' : `${n}px`)
  return {
    padding: `${px(up)} ${px(side)}`,
    margin: `${px((drawn.marginTop ?? 0) - up)} ${px(-side)} ${px(-up)}`,
  }
}
