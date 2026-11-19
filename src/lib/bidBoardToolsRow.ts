/**
 * The Bid Board's tools row.
 *
 * The row is the search input, the development filter, the ask to rate a GC when one is open, and
 * a group of five presses: Marked bids, Archived, Pricing rules, Reply book and Customer review.
 * Four rules hold it at every width (v2.7927):
 *
 * 1. One height. Every control is 36 px, the search's height (the owner's call, v2.1709). The ask
 *    was set in 16 px type beside 14 px presses, which drew its line 42 px tall over a 34 px line
 *    of icons on a phone, and 42 px beside a 36 px search on a desk.
 * 2. The ask leads the presses, as its own part of the row. On a phone it shares the filter's
 *    line, so the five presses stay together on the next: three lines where there were four.
 * 3. Words fold before the search is squeezed. Pricing rules, Reply book and Customer review keep
 *    their words while the row leaves the search about 320 px. Under that they are their icons,
 *    the ones a phone already drew. Six worded presses never shrank, so at 1280 px with an ask
 *    open the search was 139 px wide.
 * 4. The row wraps, it never spills. When even the icons would leave the search under 200 px the
 *    presses take the next line, kept to the right. At 1024 px with an ask open, and at 768 px for
 *    everyone, the search was 18 px wide and the page scrolled sideways.
 *
 * On a phone (the board's card width, under 661 px) the search takes the first line whole, as it
 * has since v2.6165: shrunk beside the presses it drew 18 px wide, a box with no room for one
 * letter (the owner, 2026-10-30). The filter is capped at 7.5rem there and Marked is its circle.
 * The press group may still shrink to its line and wrap (v2.7912), for a screen narrower than
 * its presses.
 */
import type { CSSProperties } from 'react'

/** Every control on the row is this tall. */
export const BID_BOARD_TOOLS_HEIGHT = 36
/** The search's floor on a line it shares, in px. Under it the presses take the next line. */
export const BID_BOARD_SEARCH_FLOOR = 200
/**
 * The row width from which the three book presses keep their words. Measured 2026-11-19: the
 * filter is 178 px, the five worded presses 603 px, two gaps 16 px, and the search keeps 320 px.
 */
export const BID_BOARD_WORDS_ROW = 1117
/** The same with the ask open, which is 183 px of press and one more gap. */
export const BID_BOARD_WORDS_ROW_WITH_ASK = 1308

export type BidBoardToolsRowLayout = {
  /** Pricing rules, Reply book and Customer review carry their words; otherwise they are their icons. */
  words: boolean
  /** Marked is its circle and count alone. */
  markedCompact: boolean
}

/**
 * What the row draws. `rowWidth` is the row's measured width, null before the first measure (and
 * under a test, which lays nothing out): a desk then draws its words, as it always has.
 */
export function bidBoardToolsRowLayout({ phone, rowWidth, askOpen }: { phone: boolean; rowWidth: number | null; askOpen: boolean }): BidBoardToolsRowLayout {
  if (phone) return { words: false, markedCompact: true }
  const need = askOpen ? BID_BOARD_WORDS_ROW_WITH_ASK : BID_BOARD_WORDS_ROW
  return { words: rowWidth == null || rowWidth >= need, markedCompact: false }
}

/** The row: it wraps, and a line the search is not on keeps its presses to the right. */
export function bidBoardToolsRowStyle(): CSSProperties {
  return { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }
}

/** The search: a phone's first line whole; on a desk whatever the line has left, never under its floor. */
export function bidBoardToolsSearchStyle(phone: boolean): CSSProperties {
  return {
    flex: phone ? '1 1 100%' : `1 1 ${BID_BOARD_SEARCH_FLOOR}px`,
    minWidth: 0,
    height: BID_BOARD_TOOLS_HEIGHT,
    padding: '0 0.5rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    boxSizing: 'border-box',
  }
}

/** The development filter's label. Its right margin takes a wrapped line's spare room, so it keeps the left. */
export function bidBoardToolsFilterStyle(phone: boolean): CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0, minWidth: 0, maxWidth: phone ? '7.5rem' : '13rem', marginRight: 'auto' }
}

/** The five presses. A group wider than its line shrinks to the line and wraps, kept to the right. */
export function bidBoardToolsGroupStyle(): CSSProperties {
  // `minWidth: 0` lets a group that may shrink go under the width of its widest line of presses.
  return { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '0.5rem', flex: '0 1 auto', minWidth: 0 }
}

/** One grey press of the group: its words beside its icon, or the icon alone in a square. */
export function bidBoardToolsPressStyle(iconOnly: boolean): CSSProperties {
  return {
    height: BID_BOARD_TOOLS_HEIGHT,
    width: iconOnly ? BID_BOARD_TOOLS_HEIGHT : undefined,
    padding: iconOnly ? 0 : '0 0.75rem',
    boxSizing: 'border-box',
    background: 'var(--bg-muted)',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
  }
}

/** The ask to rate a GC: amber, in the row's own 14 px type, never wrapped inside itself. */
export function bidBoardToolsAskStyle(phone: boolean): CSSProperties {
  return {
    height: BID_BOARD_TOOLS_HEIGHT,
    padding: phone ? '0 0.6rem' : '0 0.75rem',
    boxSizing: 'border-box',
    background: 'var(--bg-amber-tint)',
    color: 'var(--text-amber-800)',
    border: '1px solid var(--border-amber)',
    borderRadius: 4,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    fontWeight: 600,
  }
}

/** What the Marked press takes on this row: the row's height, and a square when it is its circle alone. */
export function bidBoardToolsMarkedStyle(compact: boolean): CSSProperties {
  return { height: BID_BOARD_TOOLS_HEIGHT, minWidth: compact ? BID_BOARD_TOOLS_HEIGHT : undefined, padding: compact ? '0 0.6rem' : '0 0.75rem', justifyContent: 'center' }
}

/** The search box's hint: the phone has the room for the whole line now, so both say what the box finds. */
export function bidBoardSearchPlaceholder(phone: boolean): string {
  return phone ? 'Search project, GC or bid number…' : 'Search (project name, GC/Builder, bid number or address)…'
}
