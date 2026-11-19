/**
 * The Lien desk's title bar on a computer (v2.7213, the owner's screenshot of Deadlines in a 1,846 px window): the
 * title line used 759 px and left 999 empty, and the tools sat alone on a second line that left 1,318 empty. In a
 * window wide enough for both, the tools — then the owner-records door, § Rules, ☎, ? and Share — end the title line.
 * Since v2.7277 (the owner's screenshot at about 1,290 px: the title line ended with 500 px empty while the second
 * held the door and the four presses) the line that has room for the four presses but not the door too takes the
 * presses, and the door slides under them at the right end of the second line. A narrower line keeps the two lines
 * of v2.6569, by this rule and not by wrapping, so a line never falls by itself. A phone's one row and its More are
 * `lienDeskPhoneMore.ts`.
 *
 * Since v2.7311 (the owner's ask of 2026-11-15, his screenshot of By paper: the door crowded the title line's right
 * end while the pile line ended with nothing) the door ends the second line on every view, whatever the title line
 * had room for: on By paper the three kinds of paper and the piles at the left, *Put a GC on notice…* and the door at
 * the right; off By paper the door alone at the right, under Share. The bar measures the pile line too —
 * `readLienDeskPileLine`, `lienDeskPileLineFit` — and when it cannot hold the piles and the right span together, the
 * span falls under the piles as one piece, right-aligned, never a press at a time.
 *
 * Until v2.7277 the width was a viewport rule (1,540 px, the longest line the desk can draw) so the tools never moved
 * between views. The bar now measures the line it drew — `readLienDeskTitleLine` — because a rule sized for the longest
 * line left the owner's own window as it was. The parts are the same on every view, so the tools still never change
 * lines between To do, By date, By paper and By job; they move only when the window does. Until v2.7490 the run's door
 * was a part of this line, its widest at up to 463 px; it left the title bar on the owner's call of 2026-11-16, and
 * the line is that much shorter on every view.
 *
 * Since v2.7465 (the owner's pick of 2026-11-16: "A, title is the tab") the line has no title of its own on a computer:
 * the first tab carries the page's name and the count (`lienDeskFirstTab`), so the line is the way back, the views and
 * the tools. It lost the title's 100 px and one 14.4 px gap and the first tab grew by 93, 21 px shorter in all.
 *
 * Since v2.7780 (the owner's ask of 2026-11-18: *"an owner asked for his records is so infrequent that we can combine
 * these two buttons"*, and his pick, *"Build A"*) the owner-records door is no part of the bar on a computer. It is a
 * row of the window ☎ opens (`LienCallScriptModal`), so the tools are the four presses alone: the title line holds
 * them or the second line does, and off By paper a bar that holds them is one line. A phone keeps the door as a row of
 * More.
 *
 * Since v2.7784 (the owner's ask of 2026-11-18: *"shorten this header line a lot by removing the repeating By's and
 * tightening up the buttons"*, and his pick of three drawn, *"Build A"*) the three views after the title read *Date*,
 * *Paper* and *Job* on a computer (`lienDeskViewTab`) and a tab's side padding is 8 px where it was 10
 * (`.lienDeskKindTab`, By paper's three tabs with it), so the views are 68 px shorter and the paper tabs 12.
 *
 * Since v2.7789 (the owner's ask of 2026-11-18, his screenshot of By paper with a box around the paper tabs and one
 * around the empty stretch of the title line: *"when it can fit, I would like to move this section up into this space,
 * but when it cant fit it should wrap like it has been"*) the three paper tabs sit on the title line, between the views
 * and the tools, when the measured line holds the way back, the views, the papers and the presses
 * (`lienDeskPapersFit`). The piles and *Put a GC on notice…* stay on the line under, and a bar with neither is one
 * line. A line too narrow keeps the papers leading the second line, by this rule and not by wrapping.
 *
 * Since v2.7806 (the owner's words of 2026-11-18, *"I don't think I wanna see it in the header"*, and his pick of three
 * places drawn, *"Build 2"*) *Put a GC on notice…* is no part of the bar on a computer: a job with a GC draws the press
 * beside the GC's name on its own notice (`lienGcNoticePress` in `lienDeskGcPicker.ts`). The second line's right span
 * is the tool row alone, drawn only where the title line has no room for it, and Monthly notices with the papers up is
 * one line. A phone keeps the picker as a row of More.
 *
 * Since v2.7874 (the owner's *"please take care of"* of 2026-11-18, on the band this file's v2.7789 left as measured)
 * the tighter bar of `index.css` runs to 1,279 px of window where it ran to 1,131 (`LIEN_DESK_TIGHT_BAR_MAX_PX`). From
 * 1,132 to 1,175 px the roomier bar had no room for the paper tabs on the title line while the tighter one just under
 * it did, so a window that widened put the papers back on the second line. The tighter bar now holds them from about
 * 1,100 px to 1,279, and the roomier one from 1,280 up, with three-figure counts on every tab too.
 */

/**
 * What the title line holds at its widest, in px, measured on the live desk on 2026-11-13: the way back as
 * *← Pipeline* (98 with its own 8 px margin toward the views, counted since v2.7465; 90 without), the four views, and the
 * tools, the four presses (231). Until v2.7780 the owner-records door (199, measured 2026-11-14) was a tool too, with
 * the tools span's 0.6rem gap between them, 440 in all. `gap` is `.lienDeskTitleBar`'s column gap; `chrome` is the page's 24 px margins and the bar's 20 px padding.
 *
 * The views were measured again on 2026-11-16 (v2.7465), on the dev server over the live desk at 1,440 px, by writing
 * each count into the first tab and reading the tab row: 383 px as *⏱ Lien desk · 888 to do* (383.3; the tab itself
 * 182.8), 372.4 with that day's *32 to do* and 302.6 with the name alone. Until then the line held the title (100) and
 * the views with *To do · 888* (290, 289.6 measured the same way that day): 404 px with the gap between them, so the
 * line is 21 px shorter.
 *
 * And again on 2026-11-18 (v2.7784), the same way, as *Date*, *Paper* and *Job* with 8 px of side padding: 316 px as
 * *⏱ Lien desk · 888 to do* (315.5; the tab itself 178.8), 304.9 with that day's *35 to do* and 234.8 with the name
 * alone. Until then the three read *By date*, *By paper* and *By job* at 10 px, 383 px with the three-figure count, so
 * the line is 67 px shorter. A window from 641 to 1,279 px (1,131 until v2.7874) draws the tabs at 7 px (`index.css`), 296.9 with *35 to do*.
 */
export const LIEN_DESK_TITLE_LINE_PARTS = { back: 98, views: 316, presses: 231, tools: 231, gap: 14.4, chrome: 88 } as const

/**
 * The room between the bar's lines on a computer, in px (v2.7322, the owner's three boxes of 2026-11-15: the band under
 * the app's nav, the band between the title line and the pile line and the band over the columns all took too much).
 * The bar's own row gap is 0 and each of its items carries half of this as a block margin (`.lienDeskTitleBar > *` in
 * `index.css`); the break spans — `data-lien-desk-header-break`, `data-lien-desk-pile-break` — carry none, so a break
 * costs the same 6 px as a line that wraps by itself: a 0-height break on a line of its own under the old 7.2 px row
 * gap took the gap twice (20.6 px from the views to the papers; 12.2 since). The pile span's own wrapped rows keep the
 * same 6. The bar's padding is 1 px over and 3 under, so the way back sits 4 px under the page's own 8 and the pile
 * line 6 px over the border; `chrome` is unchanged, since the side padding is still 20 px.
 */
export const LIEN_DESK_TITLE_BAR_ROW_GAP_PX = 6

/**
 * The widest window that draws the tighter bar, in px (v2.7874). From 641 px to this, `index.css` closes the bar's
 * column gap to 8 px, draws a tab's side padding at 7 and shows Share as its icon; a wider window draws the roomier
 * bar. It was 1,131 until v2.7874. `lienDeskTitleBar.test.ts` holds `index.css` to this number and proves that both
 * bars hold the paper tabs on the title line at the edge between them, so no window puts them back under as it widens.
 */
export const LIEN_DESK_TIGHT_BAR_MAX_PX = 1279

/**
 * The title line at its longest in each bar, in px, measured on the live desk on 2026-11-18 at 1,279 and 1,280 px of
 * window with three-figure counts written into the first tab and all three paper tabs: the way back, the views, the
 * paper tabs, the four presses and the bar's column gap. The tighter bar's Share is its icon, 43 px narrower. With
 * that day's two-figure counts the tighter bar's views were 297.3 and its paper tabs 403.2.
 */
export const LIEN_DESK_TITLE_LINE_WIDEST = {
  tight: { back: 98, views: 308, papers: 445, presses: 189, gap: 8 },
  roomy: { back: 98, views: 316, papers: 451, presses: 231, gap: 14.4 },
} as const

/** The window width the title line needs to hold these parts on one line. */
export function lienDeskTitleLineNeeds(parts: { back: number; views: number; tools: number; gap: number; chrome: number }): number {
  const pieces = [parts.back, parts.views, parts.tools].filter((w) => w > 0)
  return pieces.reduce((sum, w) => sum + w, 0) + parts.gap * Math.max(0, pieces.length - 1) + parts.chrome
}

/** The page's name: the heading's words, and on a computer the first tab's too (v2.7465). */
export const LIEN_DESK_NAME = 'Lien desk'
/** What the desk is for, as a hover hint: on the title on a phone, and on the first tab on a computer, where the tab is the title (v2.7465). */
export const LIEN_DESK_HINT = 'Every unpaid work month on a job with a GC needs its own § 53.056 notice — the office readies and drafts, the leader approves once per GC or per notice, the run goes out and is recorded. The help guide “send lien notices from the Lien desk” has the whole flow.'

/** The first tab as drawn: its words, and whether it carries the page's name. */
export type LienDeskFirstTab = {
  /** The tab's whole words, which are its accessible name. The clock mark is drawn beside them and is no part of the name. */
  words: string
  /** Whether the tab is the page's title: drawn with the clock mark, larger and heavier than the other tabs, and its press brings the Board into view. */
  titled: boolean
}

/**
 * The first tab's words (v2.7465, the owner's pick of 2026-11-16: "A, title is the tab"). The title and To do opened the
 * same page, so on a computer the separate title goes and the first tab carries the page's name, the count and the way
 * home: *Lien desk · 32 to do*, and the name alone while the count is not in yet. Nothing waiting reads *0 to do*: the
 * figure keeps its place and the phone's tab says the same number. A phone keeps its title on a row of its own, since
 * four tabs across 375 px cannot hold the long segment, and its first tab reads *To do · 32* as before. `count` is null
 * until the desk's book is in.
 */
export function lienDeskFirstTab(o: { isMobile: boolean; count: number | null }): LienDeskFirstTab {
  const n = o.count != null && Number.isFinite(o.count) ? Math.max(0, Math.floor(o.count)) : null
  if (o.isMobile) return { words: n == null ? 'To do' : `To do · ${n}`, titled: false }
  return { words: n == null ? LIEN_DESK_NAME : `${LIEN_DESK_NAME} · ${n} to do`, titled: true }
}

/** The three views after the first tab, by the key the tab row draws them under. */
export type LienDeskLaterView = 'calendar' | 'paper' | 'timeline'

/** The views' names: what the guides, the ? card and a screen reader call them, and what a phone's tab reads. */
export const LIEN_DESK_VIEW_NAMES: Record<LienDeskLaterView, string> = { calendar: 'By date', paper: 'By paper', timeline: 'By job' }

/** A view's tab as drawn: the words on it, and its accessible name. */
export type LienDeskViewTab = {
  /** The words on the tab. */
  words: string
  /** The tab's accessible name, the view's own name. Where it differs from `words` the tab carries it as its `aria-label`, and it holds the words, so a spoken *Paper* still finds the tab. */
  name: string
  /** The hover hint: the view's name and what it holds. */
  hint: string
}

const LIEN_DESK_VIEW_SHORT: Record<LienDeskLaterView, string> = { calendar: 'Date', paper: 'Paper', timeline: 'Job' }
const LIEN_DESK_VIEW_HOLDS: Record<LienDeskLaterView, string> = {
  calendar: 'when each deadline falls, on one calendar',
  paper: 'every monthly notice, lien affidavit and retainage notice by its state',
  timeline: 'every billed job with money open and a lien month — the whole path, sorted by the next date; Print the grid for counsel',
}

/**
 * A view tab's words (v2.7784, the owner's ask of 2026-11-18: *"shorten this header line a lot by removing the
 * repeating By's and tightening up the buttons"*, and his pick, *"Build A"*). On a computer the three tabs after the
 * title read *Date*, *Paper* and *Job*: the By said three times took 57 px of the title line. The views keep their
 * names, *By date*, *By paper* and *By job*, as each tab's accessible name and the first words of its hover hint, so the
 * guides, the ? card and a screen reader still say one name. A phone's tabs read the names whole: its four tabs fill
 * the row either way, and it has no hover to say the name.
 */
export function lienDeskViewTab(view: LienDeskLaterView, o: { isMobile: boolean }): LienDeskViewTab {
  const name = LIEN_DESK_VIEW_NAMES[view]
  return { words: o.isMobile ? name : LIEN_DESK_VIEW_SHORT[view], name, hint: `${name}: ${LIEN_DESK_VIEW_HOLDS[view]}` }
}

/** The parts of one title line as drawn, in px: a part that is not there is 0 (a bar with no way back). The line has no title part since v2.7465: the first of the views carries the page's name. The run's door was a part until v2.7490 and the owner-records door until v2.7780, when each left the title bar. */
export type LienDeskTitleLineParts = { back: number; views: number; presses: number; gap: number; chrome: number }

/** Whether the title line holds the tools at its end: all four presses, or none, the tools on the second line. Until v2.7780 a third answer, `presses`, put the four up and the owner-records door under them. */
export type LienDeskTitleLineFit = 'all' | 'none'

/** Whether the four presses fit at the end of a title line `width` px wide (v2.7277): `all` when they fit after the views, `none` otherwise. */
export function lienDeskTitleLineFit(width: number, p: LienDeskTitleLineParts): LienDeskTitleLineFit {
  return lienDeskTitleLineNeeds({ back: p.back, views: p.views, tools: p.presses, gap: p.gap, chrome: p.chrome }) <= width ? 'all' : 'none'
}

/** Where By paper's three paper tabs sit on a computer (v2.7789): on the title line, between the views and the tools, or leading the second line, as since v2.3817. */
export type LienDeskPapersFit = 'title_line' | 'second_line'

/** The width the title line needs to hold the paper tabs too: the way back, the views, the papers and the presses, a gap between each pair, and the chrome. */
export function lienDeskTitleLineWithPapersNeeds(p: LienDeskTitleLineParts, papers: number): number {
  const pieces = [p.back, p.views, papers, p.presses].filter((w) => w > 0)
  return pieces.reduce((sum, w) => sum + w, 0) + p.gap * Math.max(0, pieces.length - 1) + p.chrome
}

/**
 * Whether the paper tabs fit on a title line `width` px wide (v2.7789): `title_line` when the line holds the way back,
 * the views, the papers and the four presses, `second_line` otherwise. `papers` is the tab row's measured width, the
 * same on either line. Papers with no width (off By paper, or not laid out yet) stay on the second line, so a bar that
 * could not be read never moves them. A line that holds the papers holds the presses, so this is never `title_line`
 * where `lienDeskTitleLineFit` is `none`.
 */
export function lienDeskPapersFit(width: number, p: LienDeskTitleLineParts, papers: number): LienDeskPapersFit {
  if (!(papers > 0)) return 'second_line'
  return lienDeskTitleLineWithPapersNeeds(p, papers) <= width ? 'title_line' : 'second_line'
}

/**
 * The title line as the bar drew it: its content width and its parts, read off the DOM (v2.7277). Null while the bar
 * has no width (not laid out yet, or jsdom), so the caller keeps the two steady lines. The bar reads a computer's line alone: a phone has its own rows. The parts are read wherever they
 * sit — the presses move between the title line and the second — since their width is the same in both.
 */
export function readLienDeskTitleLine(bar: HTMLElement): { width: number; parts: LienDeskTitleLineParts } | null {
  const line = readLienDeskBarLine(bar)
  if (!line) return null
  const { rect, px, cs } = line
  // Since v2.7465 a computer's heading is out of the line (the first tab carries the name): it takes no width and no gap, so it is no part.
  // It still sits before the views, so a bar with no way back has it as its first child.
  const heading = bar.querySelector(':scope > h2')
  const first = bar.firstElementChild
  // The way back keeps 8 px clear of the views by a margin of its own (`BACK_DOOR`), over the bar's gap. It is room the line needs, so it is
  // read with the button (v2.7465): read without it, the line came up 8 px short, and in an 8 px band of windows the presses fell to a line by themselves.
  const outer = (el: Element) => rect(el) + px(getComputedStyle(el).marginLeft, 0) + px(getComputedStyle(el).marginRight, 0)
  return {
    width: line.width,
    parts: {
      back: first && first !== heading ? outer(first) : 0,
      views: rect(bar.querySelector('[data-lien-desk-kinds]')),
      presses: rect(bar.querySelector('[data-lien-desk-presses]')),
      gap: px(cs.columnGap, LIEN_DESK_TITLE_LINE_PARTS.gap),
      chrome: 0,
    },
  }
}

/** The bar's content width and the readers both lines share; null while the bar has no width. */
function readLienDeskBarLine(bar: HTMLElement): { width: number; cs: CSSStyleDeclaration; rect: (el: Element | null | undefined) => number; px: (v: string, fallback: number) => number } | null {
  const rect = (el: Element | null | undefined) => (el ? el.getBoundingClientRect().width : 0)
  const whole = rect(bar)
  if (!(whole > 0)) return null
  const cs = getComputedStyle(bar)
  const px = (v: string, fallback: number) => (v.endsWith('px') ? parseFloat(v) : fallback)
  return { width: whole - px(cs.paddingLeft, 20) - px(cs.paddingRight, 20), cs, rect, px }
}

/**
 * What the pile line holds at its widest, in px, measured on the live desk on 2026-11-15: the three kinds of paper
 * with two-figure counts (*Monthly notices · 21 · Lien affidavits · 22 · Retainage notices · 1*), Affidavits' three
 * piles (*Needs the property facts · 7 · To draft · 3 · Ready to file · 12*, with the bar's gap between), and the right
 * span at its fullest, the four presses (231), which every kind of paper draws in a window whose title line has no
 * room for them. Until v2.7806 *⚠ Put a GC on notice…* (166) led the span on Monthly notices with the span's 0.6rem
 * gap, 406.6 in all, and until v2.7780 the owner-records door (199) sat between them. `gap` is the bar's column gap,
 * as on the title line. The paper tabs were measured again
 * on 2026-11-18 (v2.7784) at 8 px of side padding, with the same three counts written in: 411 px (410.9), where 10 px
 * drew 423. That day Lien affidavits drew five or six pile chips, 814 to 923 px, which is why its piles fell under the
 * paper tabs in most windows until v2.7789 took the papers up.
 */
export const LIEN_DESK_PILE_LINE_PARTS = { papers: 411, piles: 427, presses: 231, right: 231, gap: 14.4 } as const

/** The parts of the pile line as drawn, in px: a part that is not there is 0 (Monthly notices has no piles; a line whose tools are up on the title line has no right span). */
export type LienDeskPileLineParts = { papers: number; piles: number; right: number; gap: number }

/** Whether the right span ends the pile line, or falls under the piles as one piece, right-aligned (v2.7311). */
export type LienDeskPileLineFit = 'one_line' | 'right_below'

/** The width the pile line needs to hold these parts on one line. */
export function lienDeskPileLineNeeds(p: LienDeskPileLineParts): number {
  const pieces = [p.papers, p.piles, p.right].filter((w) => w > 0)
  return pieces.reduce((sum, w) => sum + w, 0) + p.gap * Math.max(0, pieces.length - 1)
}

/**
 * Which shape a pile line `width` px wide takes (v2.7311): the span at its right end when the parts fit, under the piles
 * when they do not. With the papers up on the title line (v2.7789, `papers: 'title_line'`) they are no part of this
 * line, whatever the reader measured: the line is the piles and the span.
 */
export function lienDeskPileLineFit(width: number, p: LienDeskPileLineParts, papers: LienDeskPapersFit = 'second_line'): LienDeskPileLineFit {
  return lienDeskPileLineNeeds(papers === 'title_line' ? { ...p, papers: 0 } : p) <= width ? 'one_line' : 'right_below'
}

/**
 * The pile line as the bar drew it (v2.7311): its content width and its parts, read off the DOM — the paper tabs, the
 * `data-lien-desk-piles` span and the `data-lien-desk-right` span, each 0 when not drawn. Null while the bar has no
 * width (not laid out yet, or jsdom), so the caller keeps the one line. The span is read wherever it sits: its width is
 * the same at the line's end and under the piles. So are the paper tabs, which the reader measures on either line
 * (v2.7789): `lienDeskPapersFit` takes their width from here.
 */
export function readLienDeskPileLine(bar: HTMLElement): { width: number; parts: LienDeskPileLineParts } | null {
  const line = readLienDeskBarLine(bar)
  if (!line) return null
  const { rect, px, cs } = line
  return {
    width: line.width,
    parts: {
      papers: rect(bar.querySelector('[data-lien-desk-paper-kinds]')),
      piles: rect(bar.querySelector('[data-lien-desk-piles]')),
      right: rect(bar.querySelector('[data-lien-desk-right]')),
      gap: px(cs.columnGap, LIEN_DESK_PILE_LINE_PARTS.gap),
    },
  }
}

export type LienDeskTitleBarLayout = {
  /** Where the four presses are drawn: under More on a phone, at the right end of the title line, or at the right end of the second line. */
  tools: 'more' | 'title_line' | 'second_line'
  /** Whether the bar breaks after the title line. */
  breakLine: boolean
  /** Whether the second line's right span is drawn: on a computer the tool row, where the title line has no room for it (alone since v2.7806). Empty, it would still take a column gap and push the tools off the edge. */
  rightSpan: boolean
  /** Whether the pile line breaks before its right span, so the span falls under the piles as one piece (v2.7311). Only on By paper on a computer. */
  pileBreak: boolean
  /** Where By paper's three paper tabs are drawn (v2.7789): on the title line between the views and the tools, or leading the second line. Null off By paper. */
  papers: LienDeskPapersFit | null
}

/**
 * The title bar's shape. `fit` is what the title line holds at its end (`lienDeskTitleLineFit`); `pileFit` whether the
 * pile line holds its right span (`lienDeskPileLineFit`); `paperShown` is By paper, whose three kinds of paper lead the
 * second line. Until v2.7780 a desk with the owner-records door kept a second line on every view, for the door
 * (v2.7277, v2.7311), and until v2.7806 `gcNotice`, *Put a GC on notice…*, kept one on Monthly notices.
 *
 * Since v2.7789 `papersFit` is whether the title line holds the paper tabs too (`lienDeskPapersFit`) and `piles`
 * whether the view draws pile chips (Lien affidavits and Retainage notices with a pile to show). With the papers up,
 * the second line is the piles, and a bar with none is one line.
 */
export function lienDeskTitleBarLayout(o: { isMobile: boolean; fit: LienDeskTitleLineFit; pileFit: LienDeskPileLineFit; papersFit: LienDeskPapersFit; paperShown: boolean; piles: boolean }): LienDeskTitleBarLayout {
  const papersBelow = o.paperShown ? ('second_line' as const) : null
  // A phone (punch list #352, PR 1): the tools are rows of More, the break comes only with the paper tabs, and the span holds the GC picker's sheet.
  if (o.isMobile) return { tools: 'more', breakLine: o.paperShown, rightSpan: true, pileBreak: false, papers: papersBelow }
  // The two steady lines of v2.6569: the break is always there and the tools end the second line. On By paper the span falls under the piles as one piece when the measured line cannot hold both (v2.7311).
  if (o.fit === 'none') return { tools: 'second_line', breakLine: true, rightSpan: true, pileBreak: o.paperShown && o.pileFit === 'right_below', papers: papersBelow }
  // The tools are up, so the second line has no span (v2.7806) and never breaks before one.
  // The papers ride the title line (v2.7789): a second line comes only for the piles.
  if (o.paperShown && o.papersFit === 'title_line') return { tools: 'title_line', breakLine: o.piles, rightSpan: false, pileBreak: false, papers: 'title_line' }
  // One line: a second comes only with By paper, for the paper tabs and the piles.
  return { tools: 'title_line', breakLine: o.paperShown, rightSpan: false, pileBreak: false, papers: papersBelow }
}
