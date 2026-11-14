/**
 * The Lien desk's title bar on a computer (v2.7213, the owner's screenshot of Deadlines in a 1,846 px window): the
 * title line used 759 px and left 999 empty, and the tools sat alone on a second line that left 1,318 empty. In a
 * window wide enough for both, the tools — the owner-records door, § Rules, ☎, ? and Share — end the title line.
 * Since v2.7277 (the owner's screenshot at about 1,290 px: the title line ended with 500 px empty while the second
 * held the door and the four presses) the line that has room for the four presses but not the door too takes the
 * presses, and the door slides under them at the right end of the second line. A narrower line keeps the two lines
 * of v2.6569, by this rule and not by wrapping, so a line never falls by itself. A phone's one row and its More are
 * `lienDeskPhoneMore.ts`.
 *
 * Until v2.7277 the width was a viewport rule (1,540 px, the longest line the desk can draw) so the tools never moved
 * between views. The bar now measures the line it drew — `readLienDeskTitleLine` — because the longest line is 210 px
 * longer than today's (the run's *12 sealed · 8 ready · 4 wait on Grace* against *7 sealed*), and a rule sized for it
 * left the owner's own window as it was. The parts are the same on every view, so the tools still never change lines
 * between To do, By date, By paper and By job; they move only when the run's words or the window do.
 */

/**
 * What the title line holds at its widest, in px, measured on the live desk on 2026-11-13: the way back as
 * *← Pipeline*, the title, the four views with a three-figure To do count (290 px since By job, v2.7219, measured 2026-11-14; 259 with three), the run as *Send the run · 24* with
 * *12 sealed · 8 ready · 4 wait on* and a long first name (today's *Record the mailing · 7 sealed* is 270), and the
 * five tools: the door (199, measured 2026-11-14) and the four presses (231) with the tools span's 0.6rem gap between.
 * `gap` is `.lienDeskTitleBar`'s column gap; `chrome` is the page's 24 px margins and the bar's 20 px padding.
 */
export const LIEN_DESK_TITLE_LINE_PARTS = { back: 90, title: 100, views: 290, run: 463, door: 199, presses: 231, toolsGap: 9.6, tools: 440, gap: 14.4, chrome: 88 } as const

/** The window width the title line needs to hold these parts on one line. */
export function lienDeskTitleLineNeeds(parts: { back: number; title: number; views: number; run: number; tools: number; gap: number; chrome: number }): number {
  const pieces = [parts.back, parts.title, parts.views, parts.run, parts.tools].filter((w) => w > 0)
  return pieces.reduce((sum, w) => sum + w, 0) + parts.gap * Math.max(0, pieces.length - 1) + parts.chrome
}

/** The parts of one title line as drawn, in px: a part that is not there is 0 (the leader has no door; Affidavits has no run). */
export type LienDeskTitleLineParts = { back: number; title: number; views: number; run: number; door: number; presses: number; toolsGap: number; gap: number; chrome: number }

/** Which tools the title line holds at its end: all five; the four presses, with the door under them; or none, the tools on the second line. */
export type LienDeskTitleLineFit = 'all' | 'presses' | 'none'

/**
 * Which tools fit at the end of a title line `width` px wide (v2.7277). `all` when the door and the presses fit after the
 * run; `presses` when only the four do, and there is a door to slide under them; `none` otherwise. A line with no door
 * is `all` or `none`: there is nothing to slide.
 */
export function lienDeskTitleLineFit(width: number, p: LienDeskTitleLineParts): LienDeskTitleLineFit {
  const needs = (tools: number) => lienDeskTitleLineNeeds({ back: p.back, title: p.title, views: p.views, run: p.run, tools, gap: p.gap, chrome: p.chrome })
  const tools = p.door > 0 ? p.door + p.toolsGap + p.presses : p.presses
  if (needs(tools) <= width) return 'all'
  if (p.door > 0 && needs(p.presses) <= width) return 'presses'
  return 'none'
}

/**
 * The title line as the bar drew it: its content width and its parts, read off the DOM (v2.7277). Null while the bar
 * has no width (not laid out yet, or jsdom), so the caller keeps the two steady lines. The parts are read wherever they
 * sit — the door and the presses move between the title line and the second — since their widths are the same in both.
 */
export function readLienDeskTitleLine(bar: HTMLElement): { width: number; parts: LienDeskTitleLineParts } | null {
  const rect = (el: Element | null | undefined) => (el ? el.getBoundingClientRect().width : 0)
  const whole = rect(bar)
  if (!(whole > 0)) return null
  const cs = getComputedStyle(bar)
  const px = (v: string, fallback: number) => (v.endsWith('px') ? parseFloat(v) : fallback)
  const title = bar.querySelector(':scope > h2')
  const first = bar.firstElementChild
  return {
    width: whole - px(cs.paddingLeft, 20) - px(cs.paddingRight, 20),
    parts: {
      back: first && first !== title ? rect(first) : 0,
      title: rect(title),
      views: rect(bar.querySelector('[data-lien-desk-kinds]')),
      run: rect(bar.querySelector('[data-lien-desk-run]')),
      door: rect(bar.querySelector('[data-testid="lien-owner-records-door"]')),
      presses: rect(bar.querySelector('[data-lien-desk-presses]')),
      toolsGap: LIEN_DESK_TITLE_LINE_PARTS.toolsGap,
      gap: px(cs.columnGap, LIEN_DESK_TITLE_LINE_PARTS.gap),
      chrome: 0,
    },
  }
}

export type LienDeskTitleBarLayout = {
  /** Where the four presses are drawn: under More on a phone, at the right end of the title line, or at the right end of the second line. */
  tools: 'more' | 'title_line' | 'second_line'
  /** Where the owner-records door is drawn: just before the presses, or alone at the right end of the second line, under them (v2.7277). */
  door: 'with_tools' | 'second_line'
  /** Whether the bar breaks after the title line. */
  breakLine: boolean
  /** Whether the second line's right span is drawn. Empty, it would still take a column gap and push the tools off the edge. */
  rightSpan: boolean
}

/**
 * The title bar's shape. `fit` is what the title line holds at its end (`lienDeskTitleLineFit`); `recordsDoor` whether
 * the desk has the owner-records door (the office, given one); `paperShown` is By paper, whose three kinds of paper
 * lead the second line; `gcNotice` is *Put a GC on notice…*, the second line's own door.
 */
export function lienDeskTitleBarLayout(o: { isMobile: boolean; fit: LienDeskTitleLineFit; recordsDoor: boolean; paperShown: boolean; gcNotice: boolean }): LienDeskTitleBarLayout {
  // A phone (punch list #352, PR 1): the tools are rows of More, the break comes only with the paper tabs, and the span holds the GC picker's sheet.
  if (o.isMobile) return { tools: 'more', door: 'with_tools', breakLine: o.paperShown, rightSpan: true }
  // The two steady lines of v2.6569: the break is always there and the tools end the second line.
  if (o.fit === 'none') return { tools: 'second_line', door: 'with_tools', breakLine: true, rightSpan: true }
  // The presses up and the door under them (v2.7277): the second line is always there, for the door.
  if (o.fit === 'presses' && o.recordsDoor) return { tools: 'title_line', door: 'second_line', breakLine: true, rightSpan: true }
  // One line: a second comes only with By paper, for the paper tabs, the piles and the GC door.
  return { tools: 'title_line', door: 'with_tools', breakLine: o.paperShown, rightSpan: o.paperShown && o.gcNotice }
}
