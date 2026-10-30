/**
 * The Bid Board's tools row on a phone.
 *
 * The row is the search input, the development filter (capped at 7.5rem on a phone) and a
 * no-shrink group of four presses: Marked bids, Archived, Reply book, Customer review. The search is
 * the only part that shrinks, and it stops at its own 18 px of border and padding. v2.6109 wrapped
 * the row only under 366 px, so a 375 phone still drew the search 18 px wide: a box with no room
 * for one letter, which read as no search at all (the owner, 2026-10-30). On a phone (the board's
 * card width, under 661 px) the search now takes the first line whole, and the filter and the
 * press group share the next line, the group kept to the right where it sits on every other
 * width. A 320 screen's 288 px column cannot hold the filter and the group on one line, so the
 * group takes a third line there; nothing leaves the column. Over 660 px the row is what it was:
 * one line, the search shrinking.
 */
export type BidBoardToolsRowLayout = {
  /** The row's `flex-wrap`. */
  rowWrap: 'wrap' | 'nowrap'
  /** The search input's `flex`. */
  searchFlex: string
  /** The press group's `margin-left`: `auto` keeps it at the right edge of a line it has to itself. */
  groupMarginLeft: 'auto' | undefined
}

export function bidBoardToolsRowLayout(phone: boolean): BidBoardToolsRowLayout {
  return phone
    ? { rowWrap: 'wrap', searchFlex: '1 1 100%', groupMarginLeft: 'auto' }
    : { rowWrap: 'nowrap', searchFlex: '1 1 auto', groupMarginLeft: undefined }
}

/** The search box's hint: the phone has the room for the whole line now, so both say what the box finds. */
export function bidBoardSearchPlaceholder(phone: boolean): string {
  return phone ? 'Search project, GC or bid number…' : 'Search (project name, GC/Builder, bid number or address)…'
}
