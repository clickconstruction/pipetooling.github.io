// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { LIEN_DESK_NAME, LIEN_DESK_PILE_LINE_PARTS, LIEN_DESK_TITLE_LINE_PARTS, lienDeskFirstTab, lienDeskPileLineFit, lienDeskPileLineNeeds, lienDeskTitleBarLayout, lienDeskTitleLineFit, lienDeskTitleLineNeeds, readLienDeskPileLine, readLienDeskTitleLine, type LienDeskPileLineParts, type LienDeskTitleLineParts } from './lienDeskTitleBar'

/**
 * The office's line with the title in the first tab (v2.7465): the views with a two-figure count (372 px, measured
 * 2026-11-16 as *⏱ Lien desk · 32 to do*) and the four presses. In a window: chrome counts. The run's door was a part
 * too, 270 px that day, until v2.7490, and the owner-records door, 199 px, until v2.7780.
 */
const today: LienDeskTitleLineParts = { ...LIEN_DESK_TITLE_LINE_PARTS, views: 372 }
/** The same stretch of the line as it was until v2.7465: the title (100) with its gap (14.4), and the views as *To do · 21* (278). */
const beforeTheTitleWasTheTab = 100 + 14.4 + 278

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
  it('a 900 px window holds the four presses at the end of the title line, and an 800 one does not', () => {
    // With the owner-records door a tool too, a 900 px window held the presses with the door under them, on a second line.
    expect(lienDeskTitleLineFit(1300, today)).toBe('all')
    expect(lienDeskTitleLineFit(900, today)).toBe('all')
    expect(lienDeskTitleLineFit(800, today)).toBe('none')
  })

  it('the line is the parts, a gap between each pair and the chrome: 817.8 px today', () => {
    expect(lienDeskTitleLineNeeds({ ...today, tools: today.presses })).toBeCloseTo(817.8, 1)
    expect(lienDeskTitleLineFit(818, today)).toBe('all')
    expect(lienDeskTitleLineFit(817, today)).toBe('none')
  })

  it('the title in the first tab made the line 20 px shorter with a two-figure count: the title and its gap went (114.4) and the views grew by 94', () => {
    expect(beforeTheTitleWasTheTab - today.views).toBeCloseTo(20.4, 1)
    // So the presses come up to the title line in a window 20 px narrower: 839 px with the title on the line, 818 with it in the first tab.
    expect(lienDeskTitleLineFit(825, today)).toBe('all')
  })

  it('the longest line the desk can draw needs 829 px: 209 less than with the owner-records door on it', () => {
    expect(lienDeskTitleLineNeeds(LIEN_DESK_TITLE_LINE_PARTS)).toBeCloseTo(828.8, 1)
    expect(lienDeskTitleLineFit(829, LIEN_DESK_TITLE_LINE_PARTS)).toBe('all')
    expect(lienDeskTitleLineFit(828, LIEN_DESK_TITLE_LINE_PARTS)).toBe('none')
    // The owner's 1,290 px window holds them with 461 px to spare.
    expect(lienDeskTitleLineFit(1290, LIEN_DESK_TITLE_LINE_PARTS)).toBe('all')
  })

  it('a line with narrower presses needs less, and the needs are the parts with a gap between each pair', () => {
    const leader = { ...today, presses: 189 }
    // 98 + 372 + 189, two gaps, the chrome.
    expect(lienDeskTitleLineFit(776, leader)).toBe('all')
    expect(lienDeskTitleLineFit(775, leader)).toBe('none')
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

  it('the line is its parts and a gap between each pair: 1,109.8 px for Lien affidavits with the presses, so a 1,352 px bar (a 1,400 px window) holds it on one line and a 720 px one (the 768 px tablet) puts the span under the piles', () => {
    expect(lienDeskPileLineNeeds(affidavits)).toBeCloseTo(1109.8, 1)
    expect(lienDeskPileLineFit(1352, affidavits)).toBe('one_line')
    expect(lienDeskPileLineFit(1110, affidavits)).toBe('one_line')
    expect(lienDeskPileLineFit(1109, affidavits)).toBe('right_below')
    expect(lienDeskPileLineFit(720, affidavits)).toBe('right_below')
  })

  it('a part that is not there counts no gap: Monthly notices has no piles, and a line with the tools up on the title line has no span off Monthly notices', () => {
    const notices = { ...affidavits, piles: 0, right: LIEN_DESK_PILE_LINE_PARTS.gcDoor }
    expect(lienDeskPileLineNeeds(notices)).toBeCloseTo(423 + 14.4 + 166, 1)
    expect(lienDeskPileLineNeeds({ ...affidavits, right: 0 })).toBeCloseTo(423 + 14.4 + 427, 1)
    expect(lienDeskPileLineFit(865, { ...affidavits, right: 0 })).toBe('one_line')
  })

  it('the fullest line — Monthly notices with the GC door and the four presses in the span — needs 844 px, which is why a 768 px tablet puts the span under the papers', () => {
    const { papers, right, gap, gcDoor, rightGap, presses } = LIEN_DESK_PILE_LINE_PARTS
    expect(right).toBeCloseTo(gcDoor + rightGap + presses, 1)
    expect(lienDeskPileLineNeeds({ papers, piles: 0, right, gap })).toBeCloseTo(844, 1)
    expect(lienDeskPileLineFit(720, { papers, piles: 0, right, gap })).toBe('right_below')
    expect(lienDeskPileLineFit(844, { papers, piles: 0, right, gap })).toBe('one_line')
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
  it('when the line holds the presses, the tools end the title line and the bar has no second line off By paper', () => {
    for (const gcNotice of [false, true]) {
      expect(lienDeskTitleBarLayout({ pileFit: 'one_line', isMobile: false, fit: 'all', paperShown: false, gcNotice })).toEqual({ tools: 'title_line', breakLine: false, rightSpan: false, pileBreak: false })
    }
  })

  it('on By paper a line that holds the presses keeps a second line for the paper tabs; its right span comes only for Put a GC on notice', () => {
    expect(lienDeskTitleBarLayout({ pileFit: 'one_line', isMobile: false, fit: 'all', paperShown: true, gcNotice: false })).toEqual({ tools: 'title_line', breakLine: true, rightSpan: false, pileBreak: false })
    expect(lienDeskTitleBarLayout({ pileFit: 'one_line', isMobile: false, fit: 'all', paperShown: true, gcNotice: true })).toEqual({ tools: 'title_line', breakLine: true, rightSpan: true, pileBreak: false })
  })

  it('a pile line too narrow for the piles and the span together breaks before the span, on every shape that draws the span on By paper, and nowhere else', () => {
    // Put a GC on notice alone in the span, or the whole tool row: the span falls under the piles as one piece.
    expect(lienDeskTitleBarLayout({ pileFit: 'right_below', isMobile: false, fit: 'all', paperShown: true, gcNotice: true })).toEqual({ tools: 'title_line', breakLine: true, rightSpan: true, pileBreak: true })
    expect(lienDeskTitleBarLayout({ pileFit: 'right_below', isMobile: false, fit: 'none', paperShown: true, gcNotice: true })).toEqual({ tools: 'second_line', breakLine: true, rightSpan: true, pileBreak: true })
    expect(lienDeskTitleBarLayout({ pileFit: 'right_below', isMobile: false, fit: 'none', paperShown: true, gcNotice: false })).toEqual({ tools: 'second_line', breakLine: true, rightSpan: true, pileBreak: true })
    // No span, no break; off By paper the tool row is the whole second line and never breaks; a phone never breaks.
    expect(lienDeskTitleBarLayout({ pileFit: 'right_below', isMobile: false, fit: 'all', paperShown: true, gcNotice: false }).pileBreak).toBe(false)
    expect(lienDeskTitleBarLayout({ pileFit: 'right_below', isMobile: false, fit: 'none', paperShown: false, gcNotice: false }).pileBreak).toBe(false)
    expect(lienDeskTitleBarLayout({ pileFit: 'right_below', isMobile: true, fit: 'none', paperShown: true, gcNotice: true }).pileBreak).toBe(false)
  })

  it('a narrower line keeps the two steady lines of v2.6569 on every view', () => {
    for (const paperShown of [false, true]) {
      for (const gcNotice of [false, true]) {
        expect(lienDeskTitleBarLayout({ pileFit: 'one_line', isMobile: false, fit: 'none', paperShown, gcNotice })).toEqual({ tools: 'second_line', breakLine: true, rightSpan: true, pileBreak: false })
      }
    }
  })

  it('a phone is not changed: the tools are under More whatever the line holds, and the break comes with the paper tabs', () => {
    for (const fit of ['all', 'none'] as const) {
      expect(lienDeskTitleBarLayout({ pileFit: 'one_line', isMobile: true, fit, paperShown: false, gcNotice: false })).toEqual({ tools: 'more', breakLine: false, rightSpan: true, pileBreak: false })
      expect(lienDeskTitleBarLayout({ pileFit: 'one_line', isMobile: true, fit, paperShown: true, gcNotice: true })).toEqual({ tools: 'more', breakLine: true, rightSpan: true, pileBreak: false })
    }
  })
})
