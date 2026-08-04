// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useNavFitCollapse } from './useNavFitCollapse'

/**
 * Regression cover for the tablet-band header overflow (v2.1357).
 *
 * At ~760px the desktop nav row doesn't fit, and the fix for that has always
 * been this hook collapsing it to the hamburger. But the only triggers were a
 * window resize and a ResizeObserver — and ResizeObserver callbacks are
 * delivered on a rendering opportunity, so a tab that never renders never got
 * one and sat at a 164px document overflow until something resized it.
 *
 * jsdom has no ResizeObserver, which makes it exactly that environment: these
 * tests pass only because the hook now also re-measures on a settle schedule
 * and whenever `contentKey` changes.
 */

/** Only the two width properties are read while there is no ResizeObserver. */
type FakeNav = { clientWidth: number; scrollWidth: number; children: never[] }

function fakeNav(clientWidth: number, scrollWidth: number): FakeNav {
  return { clientWidth, scrollWidth, children: [] }
}

function navRefFor(nav: FakeNav) {
  return { current: nav as unknown as HTMLElement }
}

function setViewportWidth(px: number) {
  Object.defineProperty(document.documentElement, 'clientWidth', { value: px, configurable: true })
}

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(document.documentElement, 'clientWidth', { value: 0, configurable: true })
})

describe('useNavFitCollapse', () => {
  it('collapses when the header grows after mount, with no resize and no ResizeObserver', () => {
    vi.useFakeTimers()
    setViewportWidth(760)
    // Cold load: `role` is still null, so the row is short and fits.
    const nav = fakeNav(760, 760)
    const { result } = renderHook(() => useNavFitCollapse(navRefFor(nav), true))
    expect(result.current).toBe(false)

    // Role lands ~0.5s later and brings the rest of the links and icons: the
    // row now overflows by 164px. No resize event is dispatched.
    nav.scrollWidth = 924
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(result.current).toBe(true)
  })

  it('re-measures as soon as the content key changes', () => {
    vi.useFakeTimers()
    setViewportWidth(760)
    const nav = fakeNav(760, 760)
    const ref = navRefFor(nav)
    const { result, rerender } = renderHook(
      ({ contentKey }) => useNavFitCollapse(ref, true, contentKey),
      { initialProps: { contentKey: '|0|0' } }
    )
    expect(result.current).toBe(false)

    nav.scrollWidth = 924
    // The role flip re-renders with a new key — no timers, no observers.
    rerender({ contentKey: 'dev|0|0' })
    expect(result.current).toBe(true)
  })

  it('leaves a row that fits expanded across every settle pass', () => {
    vi.useFakeTimers()
    setViewportWidth(1440)
    const nav = fakeNav(1440, 1440)
    const { result } = renderHook(() => useNavFitCollapse(navRefFor(nav), true))
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current).toBe(false)
  })

  it('does not measure the desktop row while the caller renders the mobile header', () => {
    vi.useFakeTimers()
    setViewportWidth(375)
    // A narrow viewport already renders the mobile header; the desktop row is
    // not in the DOM, so its stale width must not drive a collapse decision.
    const nav = fakeNav(375, 924)
    const { result } = renderHook(() => useNavFitCollapse(navRefFor(nav), false))
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current).toBe(false)
  })
})
