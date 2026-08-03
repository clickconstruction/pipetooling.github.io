// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useVisualViewportHeight } from './useVisualViewportHeight'

type Listener = () => void

function installFakeVisualViewport(initialHeight: number) {
  const listeners = new Set<Listener>()
  const fake = {
    height: initialHeight,
    addEventListener: (_: string, fn: Listener) => listeners.add(fn),
    removeEventListener: (_: string, fn: Listener) => listeners.delete(fn),
    setHeight(h: number) {
      fake.height = h
      for (const fn of [...listeners]) fn()
    },
  }
  Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true })
  return fake
}

afterEach(() => {
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true })
})

describe('useVisualViewportHeight', () => {
  it('returns null when the VisualViewport API is unavailable', () => {
    const { result } = renderHook(() => useVisualViewportHeight())
    expect(result.current).toBeNull()
  })

  it('tracks the visual viewport height across resize events (keyboard open/close)', () => {
    const fake = installFakeVisualViewport(812)
    const { result, unmount } = renderHook(() => useVisualViewportHeight())
    expect(result.current).toBe(812)

    act(() => fake.setHeight(500)) // keyboard opened
    expect(result.current).toBe(500)

    act(() => fake.setHeight(812)) // keyboard closed
    expect(result.current).toBe(812)

    unmount()
    act(() => fake.setHeight(400)) // no crash / no update after unmount
    expect(result.current).toBe(812)
  })
})
