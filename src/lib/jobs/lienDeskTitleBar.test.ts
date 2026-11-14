import { describe, expect, it } from 'vitest'
import { LIEN_DESK_ONE_LINE_MIN_WIDTH, LIEN_DESK_ONE_LINE_QUERY, LIEN_DESK_TITLE_LINE_PARTS, lienDeskTitleBarLayout, lienDeskTitleLineNeeds } from './lienDeskTitleBar'

describe('the Lien desk title bar on a computer (v2.7213)', () => {
  it('in a wide window the tools end the title line, and the bar has no second line off All filings', () => {
    for (const gcNotice of [false, true]) {
      expect(lienDeskTitleBarLayout({ isMobile: false, wide: true, paperShown: false, gcNotice })).toEqual({ tools: 'title_line', breakLine: false, rightSpan: false })
    }
  })

  it('on All filings a wide window keeps a second line for the paper tabs, with the right span only for Put a GC on notice', () => {
    expect(lienDeskTitleBarLayout({ isMobile: false, wide: true, paperShown: true, gcNotice: false })).toEqual({ tools: 'title_line', breakLine: true, rightSpan: false })
    expect(lienDeskTitleBarLayout({ isMobile: false, wide: true, paperShown: true, gcNotice: true })).toEqual({ tools: 'title_line', breakLine: true, rightSpan: true })
  })

  it('a narrower window keeps the two steady lines of v2.6569 on every view', () => {
    for (const paperShown of [false, true]) {
      for (const gcNotice of [false, true]) {
        expect(lienDeskTitleBarLayout({ isMobile: false, wide: false, paperShown, gcNotice })).toEqual({ tools: 'second_line', breakLine: true, rightSpan: true })
      }
    }
  })

  it('a phone is not changed: the tools are under More whatever the window says, and the break comes with the paper tabs', () => {
    for (const wide of [false, true]) {
      expect(lienDeskTitleBarLayout({ isMobile: true, wide, paperShown: false, gcNotice: false })).toEqual({ tools: 'more', breakLine: false, rightSpan: true })
      expect(lienDeskTitleBarLayout({ isMobile: true, wide, paperShown: true, gcNotice: true })).toEqual({ tools: 'more', breakLine: true, rightSpan: true })
    }
  })

  it('the width is the longest title line the desk can draw, so the tools never fall off it', () => {
    const longest = lienDeskTitleLineNeeds(LIEN_DESK_TITLE_LINE_PARTS)
    expect(longest).toBeLessThanOrEqual(LIEN_DESK_ONE_LINE_MIN_WIDTH)
    // Not padded past the next round number either: a 1,512 px laptop is wide.
    expect(LIEN_DESK_ONE_LINE_MIN_WIDTH - longest).toBeLessThan(20)
    expect(LIEN_DESK_ONE_LINE_QUERY).toBe('(min-width: 1500px)')
  })

  it('the line needs less with a shorter run or none, and counts a gap only between the parts that are there', () => {
    // The screenshot's line: Record the mailing · 7 sealed is 270 px, the views 251 with a two-figure count.
    expect(lienDeskTitleLineNeeds({ ...LIEN_DESK_TITLE_LINE_PARTS, views: 251, run: 270 })).toBeCloseTo(1296.6, 1)
    // The leader's desk has no run: four parts, three gaps.
    expect(lienDeskTitleLineNeeds({ back: 90, title: 100, views: 251, run: 0, tools: 200, gap: 10, chrome: 88 })).toBe(90 + 100 + 251 + 200 + 30 + 88)
  })
})
