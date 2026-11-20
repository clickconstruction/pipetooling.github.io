import { describe, expect, it } from 'vitest'
import {
  APP_BOTTOM_CHROME_VAR,
  APP_TAB_BAR_VAR,
  ON_TAB_BAR_BORDER,
  ON_TAB_BAR_LAP_PX,
  bottomChromeCss,
  onTabBarBottomCss,
  onTabBarKeyboardSlideCss,
  pageBottomPaddingCss,
  tabBarHeightPx,
} from './bottomChrome'
import { JOB_MODE_PRESS_BAR_VAR } from './jobMode/pressBar'

describe('tabBarHeightPx', () => {
  it('publishes nothing without a measurement', () => {
    expect(tabBarHeightPx(null)).toBeNull()
    expect(tabBarHeightPx(undefined)).toBeNull()
    expect(tabBarHeightPx(0)).toBeNull()
    expect(tabBarHeightPx(-4)).toBeNull()
    expect(tabBarHeightPx(Number.NaN)).toBeNull()
    expect(tabBarHeightPx(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('keeps a whole height as it is', () => {
    expect(tabBarHeightPx(60)).toBe(60)
    expect(tabBarHeightPx(84)).toBe(84)
  })

  it('rounds a part pixel down, so what sits on the tab bar never stands above its top edge', () => {
    // An iPhone with a home indicator: 22 px glyph, 3 px gap, 11 px label, 12.8 px padding, 1 px border, 34 px inset.
    expect(tabBarHeightPx(83.78)).toBe(83)
    expect(tabBarHeightPx(83.2)).toBe(83)
    expect(tabBarHeightPx(70.78)).toBe(70)
  })

  it("does not take a float's dust for a missing pixel", () => {
    expect(tabBarHeightPx(83.999999)).toBe(84)
    expect(tabBarHeightPx(60.0000001)).toBe(60)
  })

  it('publishes nothing for a box under a pixel', () => {
    expect(tabBarHeightPx(0.4)).toBeNull()
  })

  it('is never above what was measured, plus the dust, and under a pixel below it', () => {
    for (const h of [50, 60, 60.4, 70.78, 83.78, 84, 91.5, 120.99]) {
      const out = tabBarHeightPx(h)
      expect(out).not.toBeNull()
      // No gap: the bar's bottom edge is at or below the tab bar's top edge.
      expect(out!).toBeLessThanOrEqual(h + 0.01)
      // No more than a sub-pixel overlap.
      expect(h - out!).toBeLessThan(1)
    }
  })
})

describe('bottomChromeCss', () => {
  it('is 0px with no tab bar', () => {
    expect(bottomChromeCss(false, 60)).toBe('0px')
  })

  it('reads the measured tab bar, and the old sum until one is measured', () => {
    expect(bottomChromeCss(true, 60)).toBe(`var(${APP_TAB_BAR_VAR}, calc(60px + env(safe-area-inset-bottom, 0px)))`)
  })

  it('never names the inset outside the fallback, so it is not counted on top of a measured bar', () => {
    const css = bottomChromeCss(true, 60)
    expect(css.startsWith(`var(${APP_TAB_BAR_VAR}, `)).toBe(true)
    expect(css.match(/safe-area-inset-bottom/g)).toHaveLength(1)
  })
})

describe('what sits on the tab bar', () => {
  it('pads the page by the chrome, the press bar and the pixel the rounding took, and by nothing else', () => {
    expect(pageBottomPaddingCss()).toBe(`calc(var(${APP_BOTTOM_CHROME_VAR}, 0px) + var(${JOB_MODE_PRESS_BAR_VAR}, 0px) + 1px)`)
    expect(pageBottomPaddingCss()).not.toContain('safe-area-inset-bottom')
  })

  it('clears the tab bar with that pixel whatever it measures', () => {
    for (const measured of [50, 60, 60.4, 70.78, 83.2, 83.78, 84, 95.69, 103.53]) {
      expect(tabBarHeightPx(measured)! + 1).toBeGreaterThanOrEqual(measured)
    }
  })

  it("puts a pinned bar on the chrome, lapped over the tab bar's top border", () => {
    expect(ON_TAB_BAR_LAP_PX).toBe(1)
    expect(onTabBarBottomCss()).toBe(`calc(var(${APP_BOTTOM_CHROME_VAR}, 0px) - 1px)`)
  })

  it("draws the covered line again in the tab bar's own border colour, as wide as the lap", () => {
    expect(ON_TAB_BAR_BORDER).toBe('1px solid var(--chrome-border)')
  })

  it('leaves no strip between the two whatever the tab bar measures', () => {
    // The pinned bar's bottom edge, from the foot of the screen: the published height less the lap.
    // The tab bar's top edge: its measured height. The first must never be above the second.
    for (const measured of [50, 60, 60.4, 70.78, 83.2, 83.78, 84, 95.69, 103.53]) {
      const barBottomEdge = tabBarHeightPx(measured)! - ON_TAB_BAR_LAP_PX
      expect(barBottomEdge).toBeLessThanOrEqual(measured - ON_TAB_BAR_LAP_PX + 0.01)
      // And the lap stays under two pixels: the border and a part pixel, never a tab's glyph.
      expect(measured - barBottomEdge).toBeLessThan(2)
    }
  })

  it('slides a pinned bar out by its own height, the chrome and its border', () => {
    expect(onTabBarKeyboardSlideCss()).toBe(`translateY(calc(100% + var(${APP_BOTTOM_CHROME_VAR}, 0px) + 1px))`)
  })
})
