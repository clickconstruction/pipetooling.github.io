// @vitest-environment jsdom
/**
 * The wait behind *looks off* (punch list #402, call 1), pinned with a stood-in clock. The 4 seconds
 * are held in state that one timer sets, and a better reading clears both the state and the timer.
 */
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { PRECISE_ROUGH_HOLD_MS } from '../lib/paintedMap/preciseLocation'
import { usePhoneKind, useRoughHeld } from './usePreciseLocation'

type Margin = number | null | undefined
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })
const held = (first: Margin) => renderHook(({ m }: { m: Margin }) => useRoughHeld(m), { initialProps: { m: first } })

describe('the wait before a rough reading is called rough', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is over once the readings have stayed rough for 4 seconds, and not a millisecond sooner', () => {
    expect(PRECISE_ROUGH_HOLD_MS).toBe(4000)
    const { result } = held(3200)
    expect(result.current).toBe(false)
    wait(3999)
    expect(result.current).toBe(false)
    wait(1)
    expect(result.current).toBe(true)
    // And it stays over for as long as the readings stay rough.
    wait(60_000)
    expect(result.current).toBe(true)
  })

  it('never starts with no reading, a sure one or a weak one, however long they last', () => {
    for (const m of [null, undefined, 4.5, 20, 35, 300, 1000, Number.NaN]) {
      const { result, unmount } = held(m)
      expect(vi.getTimerCount(), `${m}`).toBe(0)
      wait(60_000)
      expect(result.current, `${m}`).toBe(false)
      unmount()
    }
  })

  it('runs one timer: a second rough reading, wider or narrower, does not start the wait again', () => {
    const { result, rerender } = held(3200)
    expect(vi.getTimerCount()).toBe(1)
    wait(2000)
    rerender({ m: 5000 })
    expect(vi.getTimerCount()).toBe(1)
    wait(1000)
    rerender({ m: 1000.01 })
    expect(vi.getTimerCount()).toBe(1)
    wait(999)
    expect(result.current).toBe(false)
    wait(1)
    expect(result.current).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('is cleared, state and timer both, by a better reading that comes inside it', () => {
    const { result, rerender } = held(3200)
    wait(3000)
    rerender({ m: 6 })
    expect(result.current).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    // Nothing turns rough when the first 4 seconds would have been up.
    wait(60_000)
    expect(result.current).toBe(false)
  })

  it('is cleared at once by a better reading that comes after it, and the next rough reading waits again', () => {
    const { result, rerender } = held(3200)
    wait(4000)
    expect(result.current).toBe(true)
    rerender({ m: 35 })
    expect(result.current).toBe(false)
    rerender({ m: 3200 })
    expect(result.current).toBe(false)
    wait(3999)
    expect(result.current).toBe(false)
    wait(1)
    expect(result.current).toBe(true)
  })

  it('is never over for a reading that is not rough, not even for the one draw before the state clears', () => {
    const draws: Array<[Margin, boolean]> = []
    const { rerender } = renderHook(
      ({ m }: { m: Margin }) => {
        const over = useRoughHeld(m)
        draws.push([m, over])
        return over
      },
      { initialProps: { m: 3200 as Margin } },
    )
    wait(4000)
    rerender({ m: 6 })
    rerender({ m: null })
    expect(draws.some(([m, over]) => m === 3200 && over)).toBe(true)
    expect(draws.filter(([m, over]) => m !== 3200 && over)).toEqual([])
  })

  it('is cleared by no reading too, so a pause starts it over', () => {
    const { result, rerender } = held(3200)
    wait(4000)
    expect(result.current).toBe(true)
    rerender({ m: null })
    expect(result.current).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    rerender({ m: 3200 })
    expect(result.current).toBe(false)
    wait(4000)
    expect(result.current).toBe(true)
  })

  it('leaves no timer behind when the screen closes', () => {
    const { unmount } = held(3200)
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('which phone this is', () => {
  const real = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent')
  const asBrowser = (userAgent: string, more: { standalone?: boolean; maxTouchPoints?: number } = {}) => {
    Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true })
    Object.defineProperty(window.navigator, 'standalone', { value: more.standalone, configurable: true })
    Object.defineProperty(window.navigator, 'maxTouchPoints', { value: more.maxTouchPoints ?? 0, configurable: true })
  }
  afterEach(() => {
    if (real) Object.defineProperty(window.navigator, 'userAgent', real)
    else delete (window.navigator as unknown as { userAgent?: string }).userAgent
    delete (window.navigator as unknown as { standalone?: boolean }).standalone
    delete (window.navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints
  })
  const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)'

  it('reads the browser’s own name for itself', () => {
    asBrowser(`${IOS} Version/18.1 Mobile/15E148 Safari/604.1`)
    expect(renderHook(() => usePhoneKind()).result.current).toBe('iphone-safari')
    asBrowser(`${IOS} CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1`)
    expect(renderHook(() => usePhoneKind()).result.current).toBe('iphone-chrome')
    asBrowser('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36')
    expect(renderHook(() => usePhoneKind()).result.current).toBe('android')
  })

  it('tells an app opened from the Home Screen, and an iPad that calls itself a Mac', () => {
    asBrowser(`${IOS} Mobile/15E148`, { standalone: true })
    expect(renderHook(() => usePhoneKind()).result.current).toBe('iphone-home')
    asBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15', { maxTouchPoints: 5 })
    expect(renderHook(() => usePhoneKind()).result.current).toBe('iphone-safari')
  })

  it('takes a desk as neither, and reads it once', () => {
    asBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')
    const { result, rerender } = renderHook(() => usePhoneKind())
    expect(result.current).toBe('other')
    asBrowser(`${IOS} Version/18.1 Mobile/15E148 Safari/604.1`)
    rerender()
    expect(result.current).toBe('other')
  })
})
