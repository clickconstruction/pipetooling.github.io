// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { LIEN_DESK_PILE_LINE_PARTS, LIEN_DESK_TITLE_LINE_PARTS, lienDeskPileLineFit, lienDeskPileLineNeeds, lienDeskTitleBarLayout, lienDeskTitleLineFit, lienDeskTitleLineNeeds, readLienDeskPileLine, readLienDeskTitleLine, type LienDeskPileLineParts, type LienDeskTitleLineParts } from './lienDeskTitleBar'

/** The office's line: To do · 21, the office's door and four presses. In a window: chrome counts. The run's door was a fifth part, 270 px that day, until v2.7490. */
const today: LienDeskTitleLineParts = { ...LIEN_DESK_TITLE_LINE_PARTS, views: 278 }

describe('which tools the title line holds (v2.7277; without the run\'s door since v2.7490)', () => {
  it('a 1,300 px window now holds all five, a 900 one the four presses with the door under them, and an 800 one none', () => {
    // With the run's door on the line a 1,300 px window held the presses alone and an 1,100 one held none.
    expect(lienDeskTitleLineFit(1300, today)).toBe('all')
    expect(lienDeskTitleLineFit(1100, today)).toBe('all')
    expect(lienDeskTitleLineFit(900, today)).toBe('presses')
    expect(lienDeskTitleLineFit(800, today)).toBe('none')
  })

  it('the lines are the parts, a gap between each pair and the chrome: 1,038.8 with everything today, 830.2 with the presses alone', () => {
    expect(lienDeskTitleLineNeeds({ ...today, tools: today.door + today.toolsGap + today.presses })).toBeCloseTo(1038.8, 1)
    expect(lienDeskTitleLineFit(1039, today)).toBe('all')
    expect(lienDeskTitleLineFit(1038, today)).toBe('presses')
    expect(lienDeskTitleLineFit(831, today)).toBe('presses')
    expect(lienDeskTitleLineFit(830, today)).toBe('none')
  })

  it('the longest line the desk can draw needs 1,052 px for everything and 843 for the presses: 477 less than with the run\'s door on it', () => {
    expect(lienDeskTitleLineNeeds(LIEN_DESK_TITLE_LINE_PARTS)).toBeCloseTo(1051.2, 1)
    // The fit adds the door, its gap and the presses as drawn (439.6), a hair under the table's round 440.
    expect(lienDeskTitleLineFit(1051, LIEN_DESK_TITLE_LINE_PARTS)).toBe('all')
    expect(lienDeskTitleLineFit(1050, LIEN_DESK_TITLE_LINE_PARTS)).toBe('presses')
    expect(lienDeskTitleLineFit(843, LIEN_DESK_TITLE_LINE_PARTS)).toBe('presses')
    expect(lienDeskTitleLineFit(842, LIEN_DESK_TITLE_LINE_PARTS)).toBe('none')
    // The owner's 1,290 px window, which held the presses alone with the run's door on the line, holds all five.
    expect(lienDeskTitleLineFit(1290, LIEN_DESK_TITLE_LINE_PARTS)).toBe('all')
  })

  it('with no door there is nothing to slide under the presses: the leader’s line is all or none', () => {
    const leader = { ...today, door: 0, presses: 189 }
    // 90 + 100 + 278 + 189, three gaps, the chrome.
    expect(lienDeskTitleLineFit(789, leader)).toBe('all')
    expect(lienDeskTitleLineFit(788, leader)).toBe('none')
    // Four parts, three gaps.
    expect(lienDeskTitleLineNeeds({ back: 90, title: 100, views: 251, tools: 200, gap: 10, chrome: 88 })).toBe(90 + 100 + 251 + 200 + 30 + 88)
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
  const line = '<button data-part="back">← Back</button><h2 data-part="title">⏱ Lien desk</h2><div data-lien-desk-kinds data-part="views"></div><span data-lien-desk-tools><button data-testid="lien-owner-records-door" data-part="door"></button><span data-lien-desk-presses data-part="presses"></span></span>'

  it('reads the width inside the padding and every part where it sits, a missing one as 0', () => {
    const office = bar({ bar: 1252, back: 90, title: 100, views: 278, door: 199, presses: 231 }, line)
    office.style.padding = '1px 20px 3px' // the bar's padding since v2.7322; the reader counts the sides alone, so the width is the same as under the old 11.2 and 9.6
    office.style.columnGap = '14.4px'
    document.body.append(office)
    const read = readLienDeskTitleLine(office)!
    expect(read.width).toBe(1212)
    expect(read.parts).toEqual({ back: 90, title: 100, views: 278, door: 199, presses: 231, toolsGap: 9.6, gap: 14.4, chrome: 0 })
    // 950.8 px of parts and gaps in 1,212: all five. With the run's 270 px door on the line it held the presses alone.
    expect(lienDeskTitleLineFit(read.width, read.parts)).toBe('all')
    office.remove()
    // The leader: no way back given, no door. The title is the first child, not the way back.
    const leader = bar({ bar: 1252, title: 100, views: 278, presses: 189 }, line.replace('<button data-part="back">← Back</button>', ''))
    document.body.append(leader)
    expect(readLienDeskTitleLine(leader)!.parts).toMatchObject({ back: 0, title: 100, door: 0, presses: 189 })
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
  /** By paper's Lien affidavits as drawn on 2026-11-15: the three papers with their counts, the three piles, and the door alone in the span. */
  const affidavits: LienDeskPileLineParts = { papers: LIEN_DESK_PILE_LINE_PARTS.papers, piles: LIEN_DESK_PILE_LINE_PARTS.piles, right: LIEN_DESK_PILE_LINE_PARTS.door, gap: LIEN_DESK_PILE_LINE_PARTS.gap }

  it('the line is its parts and a gap between each pair: 1,077.8 px for Lien affidavits with the door, so a 1,352 px bar (a 1,400 px window) holds it on one line and a 720 px one (the 768 px tablet) puts the door under the piles', () => {
    expect(lienDeskPileLineNeeds(affidavits)).toBeCloseTo(1077.8, 1)
    expect(lienDeskPileLineFit(1352, affidavits)).toBe('one_line')
    expect(lienDeskPileLineFit(1078, affidavits)).toBe('one_line')
    expect(lienDeskPileLineFit(1077, affidavits)).toBe('right_below')
    expect(lienDeskPileLineFit(720, affidavits)).toBe('right_below')
  })

  it('a part that is not there counts no gap: Monthly notices has no piles, and the leader’s line off Monthly notices has no span', () => {
    const notices = { ...affidavits, piles: 0, right: LIEN_DESK_PILE_LINE_PARTS.gcDoor + LIEN_DESK_PILE_LINE_PARTS.rightGap + LIEN_DESK_PILE_LINE_PARTS.door }
    expect(lienDeskPileLineNeeds(notices)).toBeCloseTo(423 + 14.4 + 374.6, 1)
    expect(lienDeskPileLineNeeds({ ...affidavits, right: 0 })).toBeCloseTo(423 + 14.4 + 427, 1)
    expect(lienDeskPileLineFit(865, { ...affidavits, right: 0 })).toBe('one_line')
  })

  it('the fullest line — Monthly notices with the GC door, the door and the four presses in the span — needs 1,053 px, which is why a 768 px tablet puts the span under the papers', () => {
    const { papers, right, gap } = LIEN_DESK_PILE_LINE_PARTS
    expect(lienDeskPileLineNeeds({ papers, piles: 0, right, gap })).toBeCloseTo(1052.6, 1)
    expect(lienDeskPileLineFit(720, { papers, piles: 0, right, gap })).toBe('right_below')
    expect(lienDeskPileLineFit(1053, { papers, piles: 0, right, gap })).toBe('one_line')
  })
})

describe('the pile line read off the bar (v2.7311)', () => {
  const bar = (widths: Record<string, number>) => {
    const el = document.createElement('div')
    el.className = 'lienDeskTitleBar'
    el.innerHTML = '<h2 data-part="title"></h2><div data-lien-desk-kinds data-part="views"></div><span data-lien-desk-header-break></span><div data-lien-desk-paper-kinds data-part="papers"></div><span data-lien-desk-piles data-part="piles"></span><span data-lien-desk-right data-part="right"><button data-testid="lien-owner-records-door" data-part="door"></button></span>'
    for (const node of [el, ...Array.from(el.querySelectorAll('*'))]) {
      const key = node === el ? 'bar' : (node.getAttribute('data-part') ?? '')
      ;(node as HTMLElement).getBoundingClientRect = () => ({ width: widths[key] ?? 0 }) as DOMRect
    }
    return el
  }

  it('reads the width inside the padding, the papers, the piles span and the right span, a missing one as 0, and the bar’s column gap', () => {
    const office = bar({ bar: 1392, papers: 423, piles: 427, right: 199, door: 199 })
    office.style.padding = '1px 20px 3px' // the bar's padding since v2.7322; the reader counts the sides alone, so the width is the same as under the old 11.2 and 9.6
    office.style.columnGap = '14.4px'
    document.body.append(office)
    const read = readLienDeskPileLine(office)!
    expect(read).toEqual({ width: 1352, parts: { papers: 423, piles: 427, right: 199, gap: 14.4 } })
    expect(lienDeskPileLineFit(read.width, read.parts)).toBe('one_line')
    office.remove()
    const narrow = bar({ bar: 760, papers: 423, piles: 427, right: 199 })
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

describe('the Lien desk title bar on a computer (v2.7213; the door under the presses since v2.7277; on every view since v2.7311)', () => {
  it('when the line holds all five and there is no door, the tools end the title line and the bar has no second line off By paper', () => {
    for (const gcNotice of [false, true]) {
      expect(lienDeskTitleBarLayout({ pileFit: 'one_line', isMobile: false, fit: 'all', recordsDoor: false, paperShown: false, gcNotice })).toEqual({ tools: 'title_line', door: 'with_tools', breakLine: false, rightSpan: false, pileBreak: false })
    }
  })

  it('on By paper a line that holds all five keeps a second line for the paper tabs; without the door its right span comes only for Put a GC on notice', () => {
    expect(lienDeskTitleBarLayout({ pileFit: 'one_line', isMobile: false, fit: 'all', recordsDoor: false, paperShown: true, gcNotice: false })).toEqual({ tools: 'title_line', door: 'with_tools', breakLine: true, rightSpan: false, pileBreak: false })
    expect(lienDeskTitleBarLayout({ pileFit: 'one_line', isMobile: false, fit: 'all', recordsDoor: false, paperShown: true, gcNotice: true })).toEqual({ tools: 'title_line', door: 'with_tools', breakLine: true, rightSpan: true, pileBreak: false })
  })

  it('with a door, the door ends the second line on every view whatever the title line holds (v2.7311, the owner’s ask): the four presses stay up and the span is drawn for the door', () => {
    for (const fit of ['all', 'presses'] as const) {
      for (const paperShown of [false, true]) {
        for (const gcNotice of [false, true]) {
          expect(lienDeskTitleBarLayout({ pileFit: 'one_line', isMobile: false, fit, recordsDoor: true, paperShown, gcNotice })).toEqual({ tools: 'title_line', door: 'second_line', breakLine: true, rightSpan: true, pileBreak: false })
        }
      }
    }
  })

  it('a pile line too narrow for the piles and the span together breaks before the span, on every shape that draws the span on By paper, and nowhere else', () => {
    // The door on the pile line, under the presses, or with the whole tool row: the span falls under the piles as one piece.
    expect(lienDeskTitleBarLayout({ pileFit: 'right_below', isMobile: false, fit: 'all', recordsDoor: true, paperShown: true, gcNotice: false })).toEqual({ tools: 'title_line', door: 'second_line', breakLine: true, rightSpan: true, pileBreak: true })
    expect(lienDeskTitleBarLayout({ pileFit: 'right_below', isMobile: false, fit: 'presses', recordsDoor: true, paperShown: true, gcNotice: true })).toEqual({ tools: 'title_line', door: 'second_line', breakLine: true, rightSpan: true, pileBreak: true })
    expect(lienDeskTitleBarLayout({ pileFit: 'right_below', isMobile: false, fit: 'none', recordsDoor: true, paperShown: true, gcNotice: true })).toEqual({ tools: 'second_line', door: 'with_tools', breakLine: true, rightSpan: true, pileBreak: true })
    // The leader's By paper line with Put a GC on notice alone in the span breaks too.
    expect(lienDeskTitleBarLayout({ pileFit: 'right_below', isMobile: false, fit: 'all', recordsDoor: false, paperShown: true, gcNotice: true })).toEqual({ tools: 'title_line', door: 'with_tools', breakLine: true, rightSpan: true, pileBreak: true })
    // No span, no break; off By paper the tool row is the whole second line and never breaks; a phone never breaks.
    expect(lienDeskTitleBarLayout({ pileFit: 'right_below', isMobile: false, fit: 'all', recordsDoor: false, paperShown: true, gcNotice: false }).pileBreak).toBe(false)
    expect(lienDeskTitleBarLayout({ pileFit: 'right_below', isMobile: false, fit: 'none', recordsDoor: true, paperShown: false, gcNotice: false }).pileBreak).toBe(false)
    expect(lienDeskTitleBarLayout({ pileFit: 'right_below', isMobile: true, fit: 'none', recordsDoor: true, paperShown: true, gcNotice: true }).pileBreak).toBe(false)
  })

  it('when the line holds the four presses alone, they end the title line; with no door to slide under them the presses are the whole of the tools', () => {
    // With no door to slide, the presses alone are the whole of the tools: the one-line shape.
    expect(lienDeskTitleBarLayout({ pileFit: 'one_line', isMobile: false, fit: 'presses', recordsDoor: false, paperShown: false, gcNotice: false })).toEqual({ tools: 'title_line', door: 'with_tools', breakLine: false, rightSpan: false, pileBreak: false })
    expect(lienDeskTitleBarLayout({ pileFit: 'one_line', isMobile: false, fit: 'presses', recordsDoor: false, paperShown: true, gcNotice: true })).toEqual({ tools: 'title_line', door: 'with_tools', breakLine: true, rightSpan: true, pileBreak: false })
  })

  it('a narrower line keeps the two steady lines of v2.6569 on every view', () => {
    for (const paperShown of [false, true]) {
      for (const gcNotice of [false, true]) {
        for (const recordsDoor of [false, true]) {
          expect(lienDeskTitleBarLayout({ pileFit: 'one_line', isMobile: false, fit: 'none', recordsDoor, paperShown, gcNotice })).toEqual({ tools: 'second_line', door: 'with_tools', breakLine: true, rightSpan: true, pileBreak: false })
        }
      }
    }
  })

  it('a phone is not changed: the tools are under More whatever the line holds, and the break comes with the paper tabs', () => {
    for (const fit of ['all', 'presses', 'none'] as const) {
      expect(lienDeskTitleBarLayout({ pileFit: 'one_line', isMobile: true, fit, recordsDoor: true, paperShown: false, gcNotice: false })).toEqual({ tools: 'more', door: 'with_tools', breakLine: false, rightSpan: true, pileBreak: false })
      expect(lienDeskTitleBarLayout({ pileFit: 'one_line', isMobile: true, fit, recordsDoor: true, paperShown: true, gcNotice: true })).toEqual({ tools: 'more', door: 'with_tools', breakLine: true, rightSpan: true, pileBreak: false })
    }
  })
})
