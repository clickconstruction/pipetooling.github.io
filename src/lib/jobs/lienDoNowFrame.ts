/**
 * How the Lien desk's To do view holds its three parts: the lien month, the find box and the list of rows
 * (punch list #352, PR 0).
 *
 * On a computer the month and the find box stay put and the list scrolls under them (`pinned`). On a phone the
 * month's five cards stand one over the other and are taller than the screen, so a list that took "what is left"
 * got nothing: measured on 2026-11-13, its window was 26 px tall and below the bottom of the panel, and no row
 * could be reached. There the three scroll as one page (`one-page`) and the list does not scroll by itself.
 *
 * Exactly one thing scrolls in either mode. Two scrollers, one inside the other, is the trap a thumb falls in.
 *
 * Since v2.7367 (punch list #362, step 1) a computer is one page too wherever the Board leaves the list too little
 * room. The Board took the top of To do in v2.7332 and stands about 600 px tall; measured on 2026-11-15, the list
 * under it had 91 px at 1440 x 900 and started below the bottom of the screen at 1024 x 768. `lienDoNowListRoom`
 * is what is left for the list, from the frame's, the Board's and the find box's measured heights; under
 * `LIEN_DO_NOW_MIN_LIST_PX` the three scroll as one page and the find box pins to the top (`LienDoNowBar`). On a
 * screen tall enough to show the picture and a working list together, the Board stays put as before.
 */
import type { CSSProperties } from 'react'

export type LienDoNowFrame = {
  mode: 'pinned' | 'one-page'
  /** The style of the box that holds the month, the find box and the list. */
  frame: CSSProperties
  /** Whether the list of rows is its own scroller. */
  listScrolls: boolean
}

const PINNED: LienDoNowFrame = {
  mode: 'pinned',
  frame: { display: 'grid', gridTemplateRows: 'auto auto minmax(0, 1fr)', minHeight: 0, overflow: 'hidden' },
  listScrolls: true,
}

const ONE_PAGE: LienDoNowFrame = {
  mode: 'one-page',
  frame: { minHeight: 0, overflowX: 'hidden', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' },
  listScrolls: false,
}

/** The list stays its own scroller only while it has this much of the screen: about five rows. */
export const LIEN_DO_NOW_MIN_LIST_PX = 320

/** The measured heights of the To do view's parts, in px; null (or 0) while a part is not yet measured. */
export type LienDoNowRoom = { frame: number | null; board: number | null; bar: number | null }

/** What the Board and the find box leave for the list; null while the frame or the Board is not measured. */
export function lienDoNowListRoom(room: LienDoNowRoom): number | null {
  if (!room.frame || !room.board || room.frame <= 0 || room.board <= 0) return null
  return Math.max(0, room.frame - room.board - Math.max(0, room.bar ?? 0))
}

/**
 * `oneColumn` is the desk drawn in one column: a phone, the stacked layout, or (v2.7332) the Board's columns stacked
 * under 760 px, where the Board is taller than the screen. On a computer `room` decides (v2.7367): one page when the
 * list would have less than `LIEN_DO_NOW_MIN_LIST_PX`, pinned when it has more or nothing is measured yet.
 */
export function lienDoNowFrame(oneColumn: boolean, room?: LienDoNowRoom | null): LienDoNowFrame {
  if (oneColumn) return ONE_PAGE
  const left = room ? lienDoNowListRoom(room) : null
  return left != null && left < LIEN_DO_NOW_MIN_LIST_PX ? ONE_PAGE : PINNED
}

/**
 * Whether the find box has reached the top of the scroller and stands pinned there: the page has moved, and the
 * bar's top is at the scroller's. Until then it sits under the Board and shows the find alone.
 */
export function lienDoNowBarStuck(at: { barTop: number; scrollerTop: number; scrollTop: number }): boolean {
  return at.scrollTop > 0 && at.barTop <= at.scrollerTop + 1
}

/**
 * Where the page stands with the Board just out of view and the find box at the top (v2.7367): the scroller's
 * own offset of the Board's bottom edge. A pressed bin brings the page there, so the narrowed list starts
 * right under the pinned find box wherever the reader was.
 */
export function lienDoNowListTop(at: { boardBottom: number; scrollerTop: number; scrollTop: number }): number {
  return Math.max(0, Math.round(at.boardBottom - at.scrollerTop + at.scrollTop))
}

/**
 * Where a pressed month zone brings the reader on a phone: the first group of rows, or the empty line when the zone
 * holds none. On a phone the zones' cards fill the screen, so a press that only narrowed the list changed nothing a
 * person could see.
 */
export const LIEN_DO_NOW_ROWS_SELECTOR = '[data-lien-next-up-group], [data-lien-next-up="empty"]'
