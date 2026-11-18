// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { LIEN_DESK_NAME, LIEN_DESK_PILE_LINE_PARTS, LIEN_DESK_TITLE_LINE_PARTS, LIEN_DESK_VIEW_NAMES, lienDeskFirstTab, lienDeskPapersFit, lienDeskPileLineFit, lienDeskPileLineNeeds, lienDeskTitleBarLayout, lienDeskTitleLineFit, lienDeskTitleLineNeeds, lienDeskTitleLineWithPapersNeeds, lienDeskViewTab, readLienDeskPileLine, readLienDeskTitleLine, type LienDeskPileLineParts, type LienDeskTitleLineParts } from './lienDeskTitleBar'

/**
 * The office's line with the title in the first tab (v2.7465): the views with a two-figure count (305 px, measured
 * 2026-11-18 as *⏱ Lien desk · 35 to do*, *Date*, *Paper*, *Job*; 372 as *By date*, *By paper*, *By job* until v2.7784)
 * and the four presses. In a window: chrome counts. The run's door was a part too, 270 px that day, until v2.7490, and
 * the owner-records door, 199 px, until v2.7780.
 */
const today: LienDeskTitleLineParts = { ...LIEN_DESK_TITLE_LINE_PARTS, views: 305 }
/** The views as v2.7465 drew them with a two-figure count: the title in the first tab, and *By date*, *By paper*, *By job* at 10 px of side padding. */
const viewsWithTheBys = 372
/** The same stretch of the line as it was until v2.7465: the title (100) with its gap (14.4), and the views as *To do · 21* (278). */
const beforeTheTitleWasTheTab = 100 + 14.4 + 278

describe('the three views after the title (v2.7784, the owner’s pick: Date, Paper, Job)', () => {
  it('on a computer each tab reads one word, and keeps the view’s name as its accessible name and the start of its hint', () => {
    expect((['calendar', 'paper', 'timeline'] as const).map((v) => lienDeskViewTab(v, { isMobile: false }).words)).toEqual(['Date', 'Paper', 'Job'])
    expect((['calendar', 'paper', 'timeline'] as const).map((v) => lienDeskViewTab(v, { isMobile: false }).name)).toEqual(['By date', 'By paper', 'By job'])
    for (const v of ['calendar', 'paper', 'timeline'] as const) {
      const tab = lienDeskViewTab(v, { isMobile: false })
      expect(tab.name).toBe(LIEN_DESK_VIEW_NAMES[v])
      expect(tab.hint.startsWith(`${tab.name}: `)).toBe(true)
      // The name holds the words on the tab, so a spoken *Paper* finds the tab named *By paper*.
      expect(tab.name.toLowerCase()).toContain(tab.words.toLowerCase())
    }
  })

  it('a phone’s tabs read the names whole', () => {
    for (const v of ['calendar', 'paper', 'timeline'] as const) {
      const tab = lienDeskViewTab(v, { isMobile: true })
      expect(tab.words).toBe(LIEN_DESK_VIEW_NAMES[v])
      expect(tab.name).toBe(tab.words)
    }
  })

  it('the short words and the tighter padding took 67 px off the views: 372 to 305 with a two-figure count, 383 to 316 at the longest', () => {
    expect(viewsWithTheBys - today.views).toBe(67)
    expect(LIEN_DESK_TITLE_LINE_PARTS.views).toBe(316)
  })
})

describe('the first tab’s words (v2.7465, the owner’s pick: the title is the tab)', () => {
  it('on a computer the tab carries the page’s name and the count, and is the title', () => {
    expect(lienDeskFirstTab({ isMobile: false, count: 32 })).toEqual({ words: 'Lien desk · 32 to do', titled: true })
    expect(lienDeskFirstTab({ isMobile: false, count: 1 })).toEqual({ words: 'Lien desk · 1 to do', titled: true })
    expect(lienDeskFirstTab({ isMobile: false, count: 188 }).words).toBe('Lien desk · 188 to do')
    expect(lienDeskFirstTab({ isMobile: false, count: 32 }).words.startsWith(LIEN_DESK_NAME)).toBe(true)
  })

  it('while the count is not in yet a computer’s tab reads the name alone, so the page is never without it', () => {
    expect(lienDeskFirstTab({ isMobile: false, count: null })).toEqual({ words: 'Lien desk', titled: true })
  })

  it('nothing waiting reads 0 to do: the figure keeps its place, and a count that is no whole number of rows is floored and never under 0', () => {
    expect(lienDeskFirstTab({ isMobile: false, count: 0 }).words).toBe('Lien desk · 0 to do')
    expect(lienDeskFirstTab({ isMobile: true, count: 0 }).words).toBe('To do · 0')
    expect(lienDeskFirstTab({ isMobile: false, count: -3 }).words).toBe('Lien desk · 0 to do')
    expect(lienDeskFirstTab({ isMobile: false, count: 4.9 }).words).toBe('Lien desk · 4 to do')
    expect(lienDeskFirstTab({ isMobile: false, count: Number.NaN }).words).toBe('Lien desk')
  })

  it('a phone keeps its title on a row of its own, so its first tab reads To do and the count as before and is no title', () => {
    expect(lienDeskFirstTab({ isMobile: true, count: 32 })).toEqual({ words: 'To do · 32', titled: false })
    expect(lienDeskFirstTab({ isMobile: true, count: null })).toEqual({ words: 'To do', titled: false })
  })
})

describe('whether the title line holds the tools (v2.7277; no title part since v2.7465, without the run\'s door since v2.7490 and the owner-records door since v2.7780)', () => {
  it('a 900 px window holds the four presses at the end of the title line, and a 750 one does not', () => {
    // With the owner-records door a tool too, a 900 px window held the presses with the door under them, on a second line.
    expect(lienDeskTitleLineFit(1300, today)).toBe('all')
    expect(lienDeskTitleLineFit(900, today)).toBe('all')
    // 800 did not until v2.7784, when the views read *By date*, *By paper* and *By job*.
    expect(lienDeskTitleLineFit(800, today)).toBe('all')
    expect(lienDeskTitleLineFit(800, { ...today, views: viewsWithTheBys })).toBe('none')
    expect(lienDeskTitleLineFit(750, today)).toBe('none')
  })

  it('the line is the parts, a gap between each pair and the chrome: 750.8 px today', () => {
    expect(lienDeskTitleLineNeeds({ ...today, tools: today.presses })).toBeCloseTo(750.8, 1)
    expect(lienDeskTitleLineFit(751, today)).toBe('all')
    expect(lienDeskTitleLineFit(750, today)).toBe('none')
  })

  it('the title in the first tab made the line 20 px shorter with a two-figure count: the title and its gap went (114.4) and the views grew by 94', () => {
    expect(beforeTheTitleWasTheTab - viewsWithTheBys).toBeCloseTo(20.4, 1)
    // So the presses come up to the title line in a window 20 px narrower: 839 px with the title on the line, 818 with it in the first tab.
    expect(lienDeskTitleLineFit(825, today)).toBe('all')
  })

  it('the longest line the desk can draw needs 762 px: 829 with the three By’s, and 1,038 with the owner-records door on it too', () => {
    expect(lienDeskTitleLineNeeds(LIEN_DESK_TITLE_LINE_PARTS)).toBeCloseTo(761.8, 1)
    expect(lienDeskTitleLineFit(762, LIEN_DESK_TITLE_LINE_PARTS)).toBe('all')
    expect(lienDeskTitleLineFit(761, LIEN_DESK_TITLE_LINE_PARTS)).toBe('none')
    // The owner's 1,290 px window holds them with 528 px to spare.
    expect(lienDeskTitleLineFit(1290, LIEN_DESK_TITLE_LINE_PARTS)).toBe('all')
  })

  it('a line with narrower presses needs less, and the needs are the parts with a gap between each pair', () => {
    const leader = { ...today, presses: 189 }
    // 98 + 305 + 189, two gaps, the chrome.
    expect(lienDeskTitleLineFit(709, leader)).toBe('all')
    expect(lienDeskTitleLineFit(708, leader)).toBe('none')
    // Three parts, two gaps.
    expect(lienDeskTitleLineNeeds({ back: 90, views: 251, tools: 200, gap: 10, chrome: 88 })).toBe(90 + 251 + 200 + 20 + 88)
  })
})

describe('the title line read off the bar (v2.7277)', () => {
  const bar = (widths: Record<string, number>, html: string) => {
    const el = document.createElement('div')
    el.className = 'lienDeskTitleBar'
    el.innerHTML = html
    for (const node of [el, ...Array.from(el.querySelectorAll('*'))]) {
      const key = node === el ? 'bar' : (node.getAttribute('data-part') ?? '')
      ;(node as HTMLElement).getBoundingClientRect = () => ({ width: widths[key] ?? 0 }) as DOMRect
    }
    return el
  }
  // A computer's bar since v2.7465: the heading is out of the line (1 px, clipped) and the first of the views carries the name.
  const line = '<button data-part="back">← Back</button><h2 data-lien-desk-heading="outline" data-part="heading">Lien desk</h2><div data-lien-desk-kinds data-part="views"></div><span data-lien-desk-tools><span data-lien-desk-presses data-part="presses"></span></span>'

  it('reads the width inside the padding and every part where it sits, a missing one as 0', () => {
    const office = bar({ bar: 1252, back: 90, heading: 1, views: 372, presses: 231 }, line)
    office.style.padding = '1px 20px 3px' // the bar's padding since v2.7322; the reader counts the sides alone, so the width is the same as under the old 11.2 and 9.6
    office.style.columnGap = '14.4px'
    // The way back keeps 8 px clear of the views by its own margin, over the bar's gap: the line needs that room, so it is read with the button.
    ;(office.firstElementChild as HTMLElement).style.marginRight = '8px'
    document.body.append(office)
    const read = readLienDeskTitleLine(office)!
    expect(read.width).toBe(1212)
    // The heading is no part of the line: its clipped pixel is not counted, and it takes no gap.
    expect(read.parts).toEqual({ back: 98, views: 372, presses: 231, gap: 14.4, chrome: 0 })
    // 729.8 px of parts and gaps in 1,212: the four presses end the title line.
    expect(lienDeskTitleLineFit(read.width, read.parts)).toBe('all')
    // The margin decides it at the edge: 98 + 372 + 231 and two gaps is 729.8, so a 725 px line holds no tools, and read without the margin it would have.
    expect(lienDeskTitleLineFit(725, read.parts)).toBe('none')
    expect(lienDeskTitleLineFit(725, { ...read.parts, back: 90 })).toBe('all')
    office.remove()
    // A bar with no way back given. The heading is the first child, and it is not the way back.
    const leader = bar({ bar: 1252, heading: 1, views: 372, presses: 189 }, line.replace('<button data-part="back">← Back</button>', ''))
    document.body.append(leader)
    expect(readLienDeskTitleLine(leader)!.parts).toMatchObject({ back: 0, views: 372, presses: 189 })
    leader.remove()
  })

  it('a bar with no width is not read: the caller keeps the two steady lines, so a jsdom render is the narrow desk', () => {
    const none = bar({}, line)
    document.body.append(none)
    expect(readLienDeskTitleLine(none)).toBeNull()
    none.remove()
  })

  it('a gap or a padding the style sheet has not given yet falls back to the measured constants', () => {
    const bare = bar({ bar: 1292 }, line)
    document.body.append(bare)
    const read = readLienDeskTitleLine(bare)!
    expect(read.width).toBe(1252)
    expect(read.parts.gap).toBe(14.4)
    bare.remove()
  })
})

describe('which shape the pile line takes (v2.7311)', () => {
  /** By paper's Lien affidavits in a window too narrow for the presses on the title line: the three papers with their counts, the three piles, and the four presses in the span. */
  const affidavits: LienDeskPileLineParts = { papers: LIEN_DESK_PILE_LINE_PARTS.papers, piles: LIEN_DESK_PILE_LINE_PARTS.piles, right: LIEN_DESK_PILE_LINE_PARTS.presses, gap: LIEN_DESK_PILE_LINE_PARTS.gap }

  it('the line is its parts and a gap between each pair: 1,097.8 px for Lien affidavits with the presses, so a 1,352 px bar (a 1,400 px window) holds it on one line and a 720 px one (the 768 px tablet) puts the span under the piles', () => {
    expect(lienDeskPileLineNeeds(affidavits)).toBeCloseTo(1097.8, 1)
    expect(lienDeskPileLineFit(1352, affidavits)).toBe('one_line')
    expect(lienDeskPileLineFit(1098, affidavits)).toBe('one_line')
    expect(lienDeskPileLineFit(1097, affidavits)).toBe('right_below')
    expect(lienDeskPileLineFit(720, affidavits)).toBe('right_below')
  })

  it('a part that is not there counts no gap: Monthly notices has no piles, and a line with the tools up on the title line has no span off Monthly notices', () => {
    const notices = { ...affidavits, piles: 0, right: LIEN_DESK_PILE_LINE_PARTS.gcDoor }
    expect(lienDeskPileLineNeeds(notices)).toBeCloseTo(411 + 14.4 + 166, 1)
    expect(lienDeskPileLineNeeds({ ...affidavits, right: 0 })).toBeCloseTo(411 + 14.4 + 427, 1)
    expect(lienDeskPileLineFit(865, { ...affidavits, right: 0 })).toBe('one_line')
  })

  it('the fullest line — Monthly notices with the GC door and the four presses in the span — needs 832 px, which is why a 768 px tablet puts the span under the papers', () => {
    const { papers, right, gap, gcDoor, rightGap, presses } = LIEN_DESK_PILE_LINE_PARTS
    expect(right).toBeCloseTo(gcDoor + rightGap + presses, 1)
    expect(lienDeskPileLineNeeds({ papers, piles: 0, right, gap })).toBeCloseTo(832, 1)
    expect(lienDeskPileLineFit(720, { papers, piles: 0, right, gap })).toBe('right_below')
    expect(lienDeskPileLineFit(832, { papers, piles: 0, right, gap })).toBe('one_line')
    expect(lienDeskPileLineFit(831, { papers, piles: 0, right, gap })).toBe('right_below')
  })
})

describe('the pile line read off the bar (v2.7311)', () => {
  const bar = (widths: Record<string, number>) => {
    const el = document.createElement('div')
    el.className = 'lienDeskTitleBar'
    el.innerHTML = '<h2 data-part="title"></h2><div data-lien-desk-kinds data-part="views"></div><span data-lien-desk-header-break></span><div data-lien-desk-paper-kinds data-part="papers"></div><span data-lien-desk-piles data-part="piles"></span><span data-lien-desk-right data-part="right"><button data-part="gc"></button></span>'
    for (const node of [el, ...Array.from(el.querySelectorAll('*'))]) {
      const key = node === el ? 'bar' : (node.getAttribute('data-part') ?? '')
      ;(node as HTMLElement).getBoundingClientRect = () => ({ width: widths[key] ?? 0 }) as DOMRect
    }
    return el
  }

  it('reads the width inside the padding, the papers, the piles span and the right span, a missing one as 0, and the bar’s column gap', () => {
    const office = bar({ bar: 1392, papers: 423, piles: 427, right: 166, gc: 166 })
    office.style.padding = '1px 20px 3px' // the bar's padding since v2.7322; the reader counts the sides alone, so the width is the same as under the old 11.2 and 9.6
    office.style.columnGap = '14.4px'
    document.body.append(office)
    const read = readLienDeskPileLine(office)!
    expect(read).toEqual({ width: 1352, parts: { papers: 423, piles: 427, right: 166, gap: 14.4 } })
    expect(lienDeskPileLineFit(read.width, read.parts)).toBe('one_line')
    office.remove()
    const narrow = bar({ bar: 760, papers: 423, piles: 427, right: 166 })
    document.body.append(narrow)
    expect(lienDeskPileLineFit(readLienDeskPileLine(narrow)!.width, readLienDeskPileLine(narrow)!.parts)).toBe('right_below')
    narrow.remove()
  })

  it('a bar with no width is not read, so a jsdom render keeps the one line', () => {
    const none = bar({})
    document.body.append(none)
    expect(readLienDeskPileLine(none)).toBeNull()
    none.remove()
  })
})

describe('the Lien desk title bar on a computer (v2.7213; one line off By paper since v2.7780, when the owner-records door left the bar for the call window)', () => {
  /** A bar whose paper tabs lead the second line, as before v2.7789: the title line has no room for them, or the view draws none. */
  const below = { papersFit: 'second_line', piles: false } as const

  it('when the line holds the presses, the tools end the title line and the bar has no second line off By paper', () => {
    for (const gcNotice of [false, true]) {
      expect(lienDeskTitleBarLayout({ ...below, pileFit: 'one_line', isMobile: false, fit: 'all', paperShown: false, gcNotice })).toEqual({ tools: 'title_line', breakLine: false, rightSpan: false, pileBreak: false, papers: null })
    }
  })

  it('on By paper a line that holds the presses and not the papers keeps a second line for the paper tabs; its right span comes only for Put a GC on notice', () => {
    expect(lienDeskTitleBarLayout({ ...below, pileFit: 'one_line', isMobile: false, fit: 'all', paperShown: true, gcNotice: false })).toEqual({ tools: 'title_line', breakLine: true, rightSpan: false, pileBreak: false, papers: 'second_line' })
    expect(lienDeskTitleBarLayout({ ...below, pileFit: 'one_line', isMobile: false, fit: 'all', paperShown: true, gcNotice: true })).toEqual({ tools: 'title_line', breakLine: true, rightSpan: true, pileBreak: false, papers: 'second_line' })
    // The piles change nothing while the papers are under: the second line is there for the papers.
    expect(lienDeskTitleBarLayout({ papersFit: 'second_line', piles: true, pileFit: 'one_line', isMobile: false, fit: 'all', paperShown: true, gcNotice: false })).toEqual({ tools: 'title_line', breakLine: true, rightSpan: false, pileBreak: false, papers: 'second_line' })
  })

  it('a pile line too narrow for the piles and the span together breaks before the span, on every shape that draws the span on By paper, and nowhere else', () => {
    // Put a GC on notice alone in the span, or the whole tool row: the span falls under the piles as one piece.
    expect(lienDeskTitleBarLayout({ ...below, pileFit: 'right_below', isMobile: false, fit: 'all', paperShown: true, gcNotice: true })).toEqual({ tools: 'title_line', breakLine: true, rightSpan: true, pileBreak: true, papers: 'second_line' })
    expect(lienDeskTitleBarLayout({ ...below, pileFit: 'right_below', isMobile: false, fit: 'none', paperShown: true, gcNotice: true })).toEqual({ tools: 'second_line', breakLine: true, rightSpan: true, pileBreak: true, papers: 'second_line' })
    expect(lienDeskTitleBarLayout({ ...below, pileFit: 'right_below', isMobile: false, fit: 'none', paperShown: true, gcNotice: false })).toEqual({ tools: 'second_line', breakLine: true, rightSpan: true, pileBreak: true, papers: 'second_line' })
    // No span, no break; off By paper the tool row is the whole second line and never breaks; a phone never breaks.
    expect(lienDeskTitleBarLayout({ ...below, pileFit: 'right_below', isMobile: false, fit: 'all', paperShown: true, gcNotice: false }).pileBreak).toBe(false)
    expect(lienDeskTitleBarLayout({ ...below, pileFit: 'right_below', isMobile: false, fit: 'none', paperShown: false, gcNotice: false }).pileBreak).toBe(false)
    expect(lienDeskTitleBarLayout({ ...below, pileFit: 'right_below', isMobile: true, fit: 'none', paperShown: true, gcNotice: true }).pileBreak).toBe(false)
  })

  it('a narrower line keeps the two steady lines of v2.6569 on every view, the papers leading the second on By paper', () => {
    for (const paperShown of [false, true]) {
      for (const gcNotice of [false, true]) {
        expect(lienDeskTitleBarLayout({ ...below, pileFit: 'one_line', isMobile: false, fit: 'none', paperShown, gcNotice })).toEqual({ tools: 'second_line', breakLine: true, rightSpan: true, pileBreak: false, papers: paperShown ? 'second_line' : null })
      }
    }
  })

  it('a phone is not changed: the tools are under More whatever the line holds, the break comes with the paper tabs, and the papers are its second row whatever was measured', () => {
    for (const fit of ['all', 'none'] as const) {
      for (const papersFit of ['second_line', 'title_line'] as const) {
        expect(lienDeskTitleBarLayout({ papersFit, piles: false, pileFit: 'one_line', isMobile: true, fit, paperShown: false, gcNotice: false })).toEqual({ tools: 'more', breakLine: false, rightSpan: true, pileBreak: false, papers: null })
        expect(lienDeskTitleBarLayout({ papersFit, piles: true, pileFit: 'one_line', isMobile: true, fit, paperShown: true, gcNotice: true })).toEqual({ tools: 'more', breakLine: true, rightSpan: true, pileBreak: false, papers: 'second_line' })
      }
    }
  })
})

describe('whether By paper’s paper tabs fit on the title line (v2.7789, the owner’s ask: up when it can fit, wrapped as it has been when it cannot)', () => {
  /** The office's line on 2026-11-18: the way back, the views as *⏱ Lien desk · 35 to do*, *Date*, *Paper*, *Job*, and the four presses, read off the bar (no chrome). */
  const line: LienDeskTitleLineParts = { back: 98, views: 305, presses: 231, gap: 14.4, chrome: 0 }
  /** The three paper tabs with two-figure counts, 8 px of side padding. */
  const papers = 411

  it('the line needs its four parts and a gap between each pair: 1,088.2 px, so a 1,089 px line takes the papers and a 1,088 px one leaves them under', () => {
    expect(lienDeskTitleLineWithPapersNeeds(line, papers)).toBeCloseTo(1088.2, 1)
    expect(lienDeskPapersFit(1089, line, papers)).toBe('title_line')
    expect(lienDeskPapersFit(1088, line, papers)).toBe('second_line')
    // In a window the chrome counts: 1,177 px of window, where the same line with the three By’s and 10 px of padding needed 1,256.
    expect(lienDeskTitleLineWithPapersNeeds({ ...line, chrome: 88 }, papers)).toBeCloseTo(1176.2, 1)
    expect(lienDeskTitleLineWithPapersNeeds({ ...line, views: 372, chrome: 88 }, 423)).toBeCloseTo(1255.2, 1)
  })

  it('the owner’s windows: 1,440 and 1,280 px take the papers up, 1,024 and 900 keep them under', () => {
    // A bar's line is the window less the page's 48 px of margin and the bar's 40 of padding.
    expect(lienDeskPapersFit(1440 - 88, line, papers)).toBe('title_line')
    expect(lienDeskPapersFit(1280 - 88, line, papers)).toBe('title_line')
    // Under 1,132 px the bar draws tighter (`index.css`): the views 297, the papers 405, the presses 189 and an 8 px gap.
    const tight: LienDeskTitleLineParts = { back: 98, views: 297, presses: 189, gap: 8, chrome: 0 }
    expect(lienDeskPapersFit(1024 - 88, tight, 405)).toBe('second_line')
    expect(lienDeskPapersFit(900 - 88, tight, 405)).toBe('second_line')
    // The tighter bar holds them from 1,101 px of window: 98 + 297 + 405 + 189 and three gaps is 1,013.
    expect(lienDeskPapersFit(1013, tight, 405)).toBe('title_line')
    expect(lienDeskPapersFit(1012, tight, 405)).toBe('second_line')
  })

  it('longer counts need more room, and a line that holds the papers always holds the presses', () => {
    // Three-figure counts on all three papers draw 451 px of tabs, and the first tab's three figures 316 px of views.
    const long: LienDeskTitleLineParts = { ...line, views: 316 }
    expect(lienDeskPapersFit(1139, long, 451)).toBe('second_line')
    expect(lienDeskPapersFit(1140, long, 451)).toBe('title_line')
    for (const width of [600, 760, 900, 1089, 1352, 1952]) {
      if (lienDeskPapersFit(width, line, papers) === 'title_line') expect(lienDeskTitleLineFit(width, line)).toBe('all')
    }
    // And never the other way round at the edge: a line that just holds the presses leaves the papers under.
    expect(lienDeskTitleLineFit(663, line)).toBe('all')
    expect(lienDeskPapersFit(663, line, papers)).toBe('second_line')
  })

  it('papers with no width stay under: off By paper, or a bar that was not laid out', () => {
    expect(lienDeskPapersFit(1952, line, 0)).toBe('second_line')
    expect(lienDeskPapersFit(1952, line, Number.NaN)).toBe('second_line')
  })

  it('a bar with no way back counts no gap for it', () => {
    const leader = { ...line, back: 0 }
    expect(lienDeskTitleLineWithPapersNeeds(leader, papers)).toBeCloseTo(305 + 411 + 231 + 28.8, 1)
  })
})

describe('the title bar with the papers up on the title line (v2.7789)', () => {
  const up = { papersFit: 'title_line', pileFit: 'one_line', isMobile: false, fit: 'all', paperShown: true } as const

  it('Monthly notices: the second line is Put a GC on notice alone, at the right, and a desk with no GC to put on notice is one line', () => {
    expect(lienDeskTitleBarLayout({ ...up, gcNotice: true, piles: false })).toEqual({ tools: 'title_line', breakLine: true, rightSpan: true, pileBreak: false, papers: 'title_line' })
    expect(lienDeskTitleBarLayout({ ...up, gcNotice: false, piles: false })).toEqual({ tools: 'title_line', breakLine: false, rightSpan: false, pileBreak: false, papers: 'title_line' })
  })

  it('Lien affidavits and Retainage notices: the second line is the piles, with no span at its end', () => {
    expect(lienDeskTitleBarLayout({ ...up, gcNotice: false, piles: true })).toEqual({ tools: 'title_line', breakLine: true, rightSpan: false, pileBreak: false, papers: 'title_line' })
  })

  it('a pile line that cannot hold the piles and the span still breaks before the span', () => {
    expect(lienDeskTitleBarLayout({ ...up, pileFit: 'right_below', gcNotice: true, piles: true })).toEqual({ tools: 'title_line', breakLine: true, rightSpan: true, pileBreak: true, papers: 'title_line' })
  })

  it('the answer is used only where it can be true: off By paper there are no papers, and a line with no room for the presses keeps them under', () => {
    expect(lienDeskTitleBarLayout({ ...up, paperShown: false, gcNotice: false, piles: false })).toEqual({ tools: 'title_line', breakLine: false, rightSpan: false, pileBreak: false, papers: null })
    expect(lienDeskTitleBarLayout({ ...up, fit: 'none', gcNotice: false, piles: true })).toEqual({ tools: 'second_line', breakLine: true, rightSpan: true, pileBreak: false, papers: 'second_line' })
  })

  it('the pile line is measured without the papers once they are up: the piles and the GC door alone', () => {
    const { piles, gcDoor, gap, papers } = LIEN_DESK_PILE_LINE_PARTS
    const parts: LienDeskPileLineParts = { papers, piles, right: gcDoor, gap }
    // With the papers on it the line needs 1,032.8 px; without them, 607.4.
    expect(lienDeskPileLineNeeds(parts)).toBeCloseTo(1032.8, 1)
    expect(lienDeskPileLineFit(800, parts)).toBe('right_below')
    expect(lienDeskPileLineFit(800, parts, 'second_line')).toBe('right_below')
    expect(lienDeskPileLineFit(800, parts, 'title_line')).toBe('one_line')
    expect(lienDeskPileLineFit(608, parts, 'title_line')).toBe('one_line')
    expect(lienDeskPileLineFit(607, parts, 'title_line')).toBe('right_below')
  })
})
