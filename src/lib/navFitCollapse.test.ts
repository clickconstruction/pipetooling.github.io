import { describe, expect, it } from 'vitest'
import {
  NAV_FIT_HYSTERESIS_PX,
  NAV_FIT_INITIAL,
  navFitOnCollapsedResize,
  navFitOnDesktopMeasure,
} from './navFitCollapse'

describe('navFitOnDesktopMeasure', () => {
  it('stays expanded (same reference) when the desktop header fits', () => {
    expect(navFitOnDesktopMeasure(NAV_FIT_INITIAL, 1200, 0)).toBe(NAV_FIT_INITIAL)
    expect(navFitOnDesktopMeasure(NAV_FIT_INITIAL, 1200, -40)).toBe(NAV_FIT_INITIAL)
  })

  it('collapses on overflow and records the viewport the desktop header would need', () => {
    const next = navFitOnDesktopMeasure(NAV_FIT_INITIAL, 681, 301)
    expect(next.collapsed).toBe(true)
    expect(next.minExpandViewportPx).toBe(681 + 301 + NAV_FIT_HYSTERESIS_PX)
  })

  it('re-collapses with an updated requirement if content grew after an expand', () => {
    const collapsed = navFitOnDesktopMeasure(NAV_FIT_INITIAL, 700, 100)
    const expanded = navFitOnCollapsedResize(collapsed, 900)
    const again = navFitOnDesktopMeasure(expanded, 900, 50)
    expect(again.collapsed).toBe(true)
    expect(again.minExpandViewportPx).toBe(900 + 50 + NAV_FIT_HYSTERESIS_PX)
  })

  it('expands if somehow measured as fitting while collapsed', () => {
    const collapsed = navFitOnDesktopMeasure(NAV_FIT_INITIAL, 700, 100)
    const next = navFitOnDesktopMeasure(collapsed, 700, 0)
    expect(next.collapsed).toBe(false)
    expect(next.minExpandViewportPx).toBe(collapsed.minExpandViewportPx)
  })
})

describe('navFitOnCollapsedResize', () => {
  const collapsed = navFitOnDesktopMeasure(NAV_FIT_INITIAL, 681, 301) // needs 1006

  it('stays collapsed (same reference) below the recorded requirement', () => {
    expect(navFitOnCollapsedResize(collapsed, 1005)).toBe(collapsed)
  })

  it('expands at the recorded requirement', () => {
    const next = navFitOnCollapsedResize(collapsed, 1006)
    expect(next.collapsed).toBe(false)
    expect(next.minExpandViewportPx).toBe(collapsed.minExpandViewportPx)
  })

  it('is a no-op when already expanded', () => {
    expect(navFitOnCollapsedResize(NAV_FIT_INITIAL, 500)).toBe(NAV_FIT_INITIAL)
  })
})
