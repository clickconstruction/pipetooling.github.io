/**
 * The Bid Board's tools row on a phone.
 *
 * The row is the search input, the development filter (capped at 7.5rem on a phone) and a group
 * of presses: Marked bids, Archived, the ask to rate a GC when one is open, Pricing rules, Reply
 * book and Customer review. On a desk the group never shrinks: the search is the only part that
 * does, and it stops at its own 18 px of border and padding. v2.6109 wrapped
 * the row only under 366 px, so a 375 phone still drew the search 18 px wide: a box with no room
 * for one letter, which read as no search at all (the owner, 2026-10-30). On a phone (the board's
 * card width, under 661 px) the search now takes the first line whole, and the filter and the
 * press group share the next line, the group kept to the right where it sits on every other
 * width. A 320 screen's 288 px column cannot hold the filter and the group on one line, so the
 * group takes a third line there; nothing leaves the column. Over 660 px the row is what it was:
 * one line, the search shrinking.
 *
 * The group itself wraps on a phone (v2.7912). It grew from four presses to six, and with the ask
 * *Rate a GC after a job · 1* open it measured 462 px in a 343 px column at 375 px, so the whole
 * page scrolled sideways to 478. A group wider than its line now shrinks to the line and wraps its
 * presses, kept to the right. A group that fits is drawn as before.
 */
import type { CSSProperties } from 'react'

export type BidBoardToolsRowLayout = {
  /** The row's `flex-wrap`. */
  rowWrap: 'wrap' | 'nowrap'
  /** The search input's `flex`. */
  searchFlex: string
  /** The press group's `margin-left`: `auto` keeps it at the right edge of a line it has to itself. */
  groupMarginLeft: 'auto' | undefined
  /** The press group's `flex`: on a phone it may shrink to its line, which is what lets it wrap. */
  groupFlex: '0 1 auto' | '0 0 auto'
  /** The press group's own `flex-wrap`. */
  groupWrap: 'wrap' | 'nowrap'
  /** The press group's `justify-content`: a wrapped line keeps to the right, as the group does. */
  groupJustify: 'flex-end' | undefined
}

export function bidBoardToolsRowLayout(phone: boolean): BidBoardToolsRowLayout {
  return phone
    ? { rowWrap: 'wrap', searchFlex: '1 1 100%', groupMarginLeft: 'auto', groupFlex: '0 1 auto', groupWrap: 'wrap', groupJustify: 'flex-end' }
    : { rowWrap: 'nowrap', searchFlex: '1 1 auto', groupMarginLeft: undefined, groupFlex: '0 0 auto', groupWrap: 'nowrap', groupJustify: undefined }
}

/** The press group's whole style, so the board writes none of it by hand. */
export function bidBoardToolsGroupStyle(phone: boolean): CSSProperties {
  const row = bidBoardToolsRowLayout(phone)
  // `minWidth: 0` lets a group that may shrink go under the width of its widest line of presses.
  return { display: 'flex', flexWrap: row.groupWrap, justifyContent: row.groupJustify, gap: '0.5rem', flex: row.groupFlex, minWidth: 0, marginLeft: row.groupMarginLeft }
}

/** The search box's hint: the phone has the room for the whole line now, so both say what the box finds. */
export function bidBoardSearchPlaceholder(phone: boolean): string {
  return phone ? 'Search project, GC or bid number…' : 'Search (project name, GC/Builder, bid number or address)…'
}
