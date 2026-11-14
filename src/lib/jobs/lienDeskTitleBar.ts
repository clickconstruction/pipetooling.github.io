/**
 * The Lien desk's title bar on a computer (v2.7213, the owner's screenshot of Deadlines in a 1,846 px window): the
 * title line used 759 px and left 999 empty, and the tools sat alone on a second line that left 1,318 empty. In a
 * window wide enough for both, the tools — the owner-records door, § Rules, ☎, ? and Share — end the title line.
 * In a narrower one the bar keeps the two lines of v2.6569, by this rule and not by wrapping, so a line never falls
 * by itself. A phone's one row and its More are `lienDeskPhoneMore.ts`.
 *
 * The width is a viewport rule on purpose, as `.lienDeskTitleBar`'s own is: every view and every kind of paper
 * answers it the same way, so the tools never change lines between To do, By date, By paper and By job.
 */

/**
 * What the title line holds at its widest, in px, measured on the live desk on 2026-11-13: the way back as
 * *← Pipeline*, the title, the four views with a three-figure To do count (290 px since By job, v2.7219, measured 2026-11-14; 259 with three), the run as *Send the run · 24* with
 * *12 sealed · 8 ready · 4 wait on* and a long first name (today's *Record the mailing · 7 sealed* is 270), and the
 * five tools. `gap` is `.lienDeskTitleBar`'s column gap; `chrome` is the page's 24 px margins and the bar's 20 px padding.
 */
export const LIEN_DESK_TITLE_LINE_PARTS = { back: 90, title: 100, views: 290, run: 463, tools: 440, gap: 14.4, chrome: 88 } as const

/** The window width the title line needs to hold these parts on one line. */
export function lienDeskTitleLineNeeds(parts: { back: number; title: number; views: number; run: number; tools: number; gap: number; chrome: number }): number {
  const pieces = [parts.back, parts.title, parts.views, parts.run, parts.tools].filter((w) => w > 0)
  return pieces.reduce((sum, w) => sum + w, 0) + parts.gap * Math.max(0, pieces.length - 1) + parts.chrome
}

/** The narrowest window whose title line holds the tools too: the longest line above, rounded up to a round number. */
export const LIEN_DESK_ONE_LINE_MIN_WIDTH = 1540
export const LIEN_DESK_ONE_LINE_QUERY = `(min-width: ${LIEN_DESK_ONE_LINE_MIN_WIDTH}px)`

export type LienDeskTitleBarLayout = {
  /** Where the tools are drawn: under More on a phone, at the right end of the title line, or at the right end of the second line. */
  tools: 'more' | 'title_line' | 'second_line'
  /** Whether the bar breaks after the title line. */
  breakLine: boolean
  /** Whether the second line's right span is drawn. Empty, it would still take a column gap and push the tools off the edge. */
  rightSpan: boolean
}

/**
 * The title bar's shape. `wide` is the window answering `LIEN_DESK_ONE_LINE_QUERY`; `paperShown` is By paper,
 * whose three kinds of paper lead the second line; `gcNotice` is *Put a GC on notice…*, the second line's own door.
 */
export function lienDeskTitleBarLayout(o: { isMobile: boolean; wide: boolean; paperShown: boolean; gcNotice: boolean }): LienDeskTitleBarLayout {
  // A phone (punch list #352, PR 1): the tools are rows of More, the break comes only with the paper tabs, and the span holds the GC picker's sheet.
  if (o.isMobile) return { tools: 'more', breakLine: o.paperShown, rightSpan: true }
  // The two steady lines of v2.6569: the break is always there and the tools end the second line.
  if (!o.wide) return { tools: 'second_line', breakLine: true, rightSpan: true }
  // One line: a second comes only with By paper, for the paper tabs, the piles and the GC door.
  return { tools: 'title_line', breakLine: o.paperShown, rightSpan: o.paperShown && o.gcNotice }
}
