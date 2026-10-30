/**
 * The Bid Board's tools row on the narrowest phones (v2.6109).
 *
 * The row is the search input, the development filter (capped at 7.5rem on a phone) and a
 * no-shrink group of four presses: Marked bids, Archived, Reply book, Customer review. The search is
 * the only part that shrinks, and it stops at its own 18 px of border and padding. From there the
 * fixed parts come to 334 px with their gaps, so the row fits on one line only in a column 334 px
 * wide or wider, a screen 366 px or wider. At 375 the row keeps the one-line draw v2.5977 measured
 * (the search at 27 px). Under that the row wraps: the search takes a 9rem basis so it shares the
 * first line with the filter (144 + 8 + 120 = 272 px in a 320 screen's 288 px column) and the group
 * drops to its own line, kept to the right where it sits on every other width.
 */
export const BID_BOARD_TOOLS_WRAP_MQ = '(max-width: 365px)'

export type BidBoardToolsRowLayout = {
  /** The row's `flex-wrap`. */
  rowWrap: 'wrap' | 'nowrap'
  /** The search input's `flex`. */
  searchFlex: string
  /** The press group's `margin-left`: `auto` keeps it at the right edge of a line it has to itself. */
  groupMarginLeft: 'auto' | undefined
}

export function bidBoardToolsRowLayout(wrap: boolean): BidBoardToolsRowLayout {
  return wrap
    ? { rowWrap: 'wrap', searchFlex: '1 1 9rem', groupMarginLeft: 'auto' }
    : { rowWrap: 'nowrap', searchFlex: '1 1 auto', groupMarginLeft: undefined }
}
