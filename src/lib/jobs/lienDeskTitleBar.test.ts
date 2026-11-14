// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { LIEN_DESK_TITLE_LINE_PARTS, lienDeskTitleBarLayout, lienDeskTitleLineFit, lienDeskTitleLineNeeds, readLienDeskTitleLine, type LienDeskTitleLineParts } from './lienDeskTitleBar'

/** The owner's screenshot of 2026-11-14: To do · 21, Record the mailing · 7 sealed, the office's door and four presses. In a window: chrome counts. */
const today: LienDeskTitleLineParts = { ...LIEN_DESK_TITLE_LINE_PARTS, views: 278, run: 270 }

describe('which tools the title line holds (v2.7277)', () => {
  it('a 2,000 px window holds all five, a 1,300 one the four presses with the door under them, and an 1,100 one none', () => {
    expect(lienDeskTitleLineFit(2000, today)).toBe('all')
    expect(lienDeskTitleLineFit(1300, today)).toBe('presses')
    expect(lienDeskTitleLineFit(1100, today)).toBe('none')
  })

  it('the lines are the parts, a gap between each pair and the chrome: 1,323.2 with everything today, 1,114.6 with the presses alone', () => {
    expect(lienDeskTitleLineNeeds({ ...today, tools: today.door + today.toolsGap + today.presses })).toBeCloseTo(1323.2, 1)
    expect(lienDeskTitleLineFit(1324, today)).toBe('all')
    expect(lienDeskTitleLineFit(1323, today)).toBe('presses')
    expect(lienDeskTitleLineFit(1115, today)).toBe('presses')
    expect(lienDeskTitleLineFit(1114, today)).toBe('none')
  })

  it('the longest line the desk can draw needs 1,529 px for everything and 1,320 for the presses, which is why the bar measures the line it drew', () => {
    expect(lienDeskTitleLineNeeds(LIEN_DESK_TITLE_LINE_PARTS)).toBeCloseTo(1528.6, 1)
    // A rule sized for it would have left the owner's 1,290 px window as it was: with today's run, the presses fit there.
    expect(lienDeskTitleLineFit(1290, LIEN_DESK_TITLE_LINE_PARTS)).toBe('none')
    expect(lienDeskTitleLineFit(1290, today)).toBe('presses')
    expect(lienDeskTitleLineFit(1319, LIEN_DESK_TITLE_LINE_PARTS)).toBe('none')
    expect(lienDeskTitleLineFit(1320, LIEN_DESK_TITLE_LINE_PARTS)).toBe('presses')
  })

  it('with no door there is nothing to slide under the presses: the leader’s line is all or none, and a line with no run counts no gap for it', () => {
    const leader = { ...today, door: 0, presses: 189 }
    expect(lienDeskTitleLineFit(1100, leader)).toBe('all')
    // 90 + 100 + 278 + 270 + 189, four gaps, the chrome.
    expect(lienDeskTitleLineFit(1073, leader)).toBe('all')
    expect(lienDeskTitleLineFit(1072, leader)).toBe('none')
    // Affidavits has no run: four parts, three gaps.
    expect(lienDeskTitleLineNeeds({ back: 90, title: 100, views: 251, run: 0, tools: 200, gap: 10, chrome: 88 })).toBe(90 + 100 + 251 + 200 + 30 + 88)
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
  const line = '<button data-part="back">← Back</button><h2 data-part="title">⏱ Lien desk</h2><div data-lien-desk-kinds data-part="views"></div><button data-lien-desk-run data-part="run"></button><span data-lien-desk-tools><button data-testid="lien-owner-records-door" data-part="door"></button><span data-lien-desk-presses data-part="presses"></span></span>'

  it('reads the width inside the padding and every part where it sits, a missing one as 0', () => {
    const office = bar({ bar: 1252, back: 90, title: 100, views: 278, run: 270, door: 199, presses: 231 }, line)
    office.style.padding = '11.2px 20px 9.6px'
    office.style.columnGap = '14.4px'
    document.body.append(office)
    const read = readLienDeskTitleLine(office)!
    expect(read.width).toBe(1212)
    expect(read.parts).toEqual({ back: 90, title: 100, views: 278, run: 270, door: 199, presses: 231, toolsGap: 9.6, gap: 14.4, chrome: 0 })
    expect(lienDeskTitleLineFit(read.width, read.parts)).toBe('presses')
    office.remove()
    // The leader on Affidavits: no way back given, no run, no door. The title is the first child, not the way back.
    const leader = bar({ bar: 1252, title: 100, views: 278, presses: 189 }, line.replace('<button data-part="back">← Back</button>', ''))
    document.body.append(leader)
    expect(readLienDeskTitleLine(leader)!.parts).toMatchObject({ back: 0, title: 100, run: 0, door: 0, presses: 189 })
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

describe('the Lien desk title bar on a computer (v2.7213; the door under the presses since v2.7277)', () => {
  it('when the line holds all five, the tools end the title line, and the bar has no second line off By paper', () => {
    for (const gcNotice of [false, true]) {
      for (const recordsDoor of [false, true]) {
        expect(lienDeskTitleBarLayout({ isMobile: false, fit: 'all', recordsDoor, paperShown: false, gcNotice })).toEqual({ tools: 'title_line', door: 'with_tools', breakLine: false, rightSpan: false })
      }
    }
  })

  it('on By paper a line that holds all five keeps a second line for the paper tabs, with the right span only for Put a GC on notice', () => {
    expect(lienDeskTitleBarLayout({ isMobile: false, fit: 'all', recordsDoor: true, paperShown: true, gcNotice: false })).toEqual({ tools: 'title_line', door: 'with_tools', breakLine: true, rightSpan: false })
    expect(lienDeskTitleBarLayout({ isMobile: false, fit: 'all', recordsDoor: true, paperShown: true, gcNotice: true })).toEqual({ tools: 'title_line', door: 'with_tools', breakLine: true, rightSpan: true })
  })

  it('when the line holds the four presses, they end the title line and the door slides under them at the right end of the second line, on every view', () => {
    for (const paperShown of [false, true]) {
      for (const gcNotice of [false, true]) {
        expect(lienDeskTitleBarLayout({ isMobile: false, fit: 'presses', recordsDoor: true, paperShown, gcNotice })).toEqual({ tools: 'title_line', door: 'second_line', breakLine: true, rightSpan: true })
      }
    }
    // With no door to slide, the presses alone are the whole of the tools: the one-line shape.
    expect(lienDeskTitleBarLayout({ isMobile: false, fit: 'presses', recordsDoor: false, paperShown: false, gcNotice: false })).toEqual({ tools: 'title_line', door: 'with_tools', breakLine: false, rightSpan: false })
    expect(lienDeskTitleBarLayout({ isMobile: false, fit: 'presses', recordsDoor: false, paperShown: true, gcNotice: true })).toEqual({ tools: 'title_line', door: 'with_tools', breakLine: true, rightSpan: true })
  })

  it('a narrower line keeps the two steady lines of v2.6569 on every view', () => {
    for (const paperShown of [false, true]) {
      for (const gcNotice of [false, true]) {
        for (const recordsDoor of [false, true]) {
          expect(lienDeskTitleBarLayout({ isMobile: false, fit: 'none', recordsDoor, paperShown, gcNotice })).toEqual({ tools: 'second_line', door: 'with_tools', breakLine: true, rightSpan: true })
        }
      }
    }
  })

  it('a phone is not changed: the tools are under More whatever the line holds, and the break comes with the paper tabs', () => {
    for (const fit of ['all', 'presses', 'none'] as const) {
      expect(lienDeskTitleBarLayout({ isMobile: true, fit, recordsDoor: true, paperShown: false, gcNotice: false })).toEqual({ tools: 'more', door: 'with_tools', breakLine: false, rightSpan: true })
      expect(lienDeskTitleBarLayout({ isMobile: true, fit, recordsDoor: true, paperShown: true, gcNotice: true })).toEqual({ tools: 'more', door: 'with_tools', breakLine: true, rightSpan: true })
    }
  })
})
