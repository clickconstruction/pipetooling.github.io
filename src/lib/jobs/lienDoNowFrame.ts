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

/** `oneColumn` is the desk drawn in one column: a phone, or the stacked layout. */
export function lienDoNowFrame(oneColumn: boolean): LienDoNowFrame {
  return oneColumn ? ONE_PAGE : PINNED
}

/**
 * Where a pressed month zone brings the reader on a phone: the first group of rows, or the empty line when the zone
 * holds none. On a phone the zones' cards fill the screen, so a press that only narrowed the list changed nothing a
 * person could see.
 */
export const LIEN_DO_NOW_ROWS_SELECTOR = '[data-lien-next-up-group], [data-lien-next-up="empty"]'
