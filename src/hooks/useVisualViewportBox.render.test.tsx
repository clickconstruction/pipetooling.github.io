// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useVisualViewportBox } from './useVisualViewportBox'

type Listener = () => void

/** The visual viewport, with the two things an iPhone does to it: `resize` for the keyboard, `scroll` for the slide. */
function installFakeVisualViewport(height: number) {
  const heard = { resize: new Set<Listener>(), scroll: new Set<Listener>() }
  const of = (type: string) => (type === 'resize' || type === 'scroll' ? heard[type] : undefined)
  const fake = {
    height,
    offsetTop: 0,
    addEventListener: (type: string, fn: Listener) => of(type)?.add(fn),
    removeEventListener: (type: string, fn: Listener) => of(type)?.delete(fn),
  }
  Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true })
  return {
    resize(next: number) {
      fake.height = next
      for (const fn of [...heard.resize]) fn()
    },
    slide(next: number) {
      fake.offsetTop = next
      for (const fn of [...heard.scroll]) fn()
    },
    listeners: () => heard.resize.size + heard.scroll.size,
  }
}

afterEach(() => {
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true })
})

describe('useVisualViewportBox', () => {
  it('is null where the VisualViewport API is missing', () => {
    const { result } = renderHook(() => useVisualViewportBox())
    expect(result.current).toBeNull()
  })

  it('hears the keyboard take room and give it back', () => {
    const vv = installFakeVisualViewport(740)
    const { result } = renderHook(() => useVisualViewportBox())
    expect(result.current).toEqual({ height: 740, offsetTop: 0 })
    act(() => vv.resize(377))
    expect(result.current).toEqual({ height: 377, offsetTop: 0 })
    act(() => vv.resize(740))
    expect(result.current).toEqual({ height: 740, offsetTop: 0 })
  })

  it('hears the page slide under the keyboard, which is a scroll and no resize', () => {
    const vv = installFakeVisualViewport(377)
    const { result } = renderHook(() => useVisualViewportBox())
    act(() => vv.slide(253))
    expect(result.current).toEqual({ height: 377, offsetTop: 253 })
    act(() => vv.slide(0))
    expect(result.current).toEqual({ height: 377, offsetTop: 0 })
  })

  it('keeps the same answer when nothing moved, so a window does not draw again', () => {
    const vv = installFakeVisualViewport(377)
    const { result } = renderHook(() => useVisualViewportBox())
    const first = result.current
    act(() => vv.slide(0))
    expect(result.current).toBe(first)
  })

  it('stops listening when the window closes', () => {
    const vv = installFakeVisualViewport(377)
    const { unmount } = renderHook(() => useVisualViewportBox())
    expect(vv.listeners()).toBe(2)
    unmount()
    expect(vv.listeners()).toBe(0)
  })
})
