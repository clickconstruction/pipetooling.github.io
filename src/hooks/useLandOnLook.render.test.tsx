// @vitest-environment jsdom
/**
 * Landing a page on one of its looks (punch list #379, PR 6): once the link asked and the look is on the
 * page, the look is opened and scrolled to, one time. The move is handed back for a press on the page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { LAND_ON_LOOK_MS, useLandOnLook } from './useLandOnLook'

let seen: string[] = []
beforeEach(() => {
  vi.useFakeTimers()
  seen = []
  Element.prototype.scrollIntoView = function (this: Element) {
    seen.push(this.id)
  }
  const look = document.createElement('div')
  look.id = 'the-look'
  document.body.appendChild(look)
})
afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  vi.useRealTimers()
})
const beat = () => act(() => void vi.advanceTimersByTime(LAND_ON_LOOK_MS + 5))

describe('useLandOnLook', () => {
  it('does nothing until the look is asked for and on the page, then opens it and scrolls to it once', () => {
    const unfold = vi.fn()
    const { rerender } = renderHook(({ asked }) => useLandOnLook({ asked, anchorId: 'the-look', unfold }), { initialProps: { asked: false } })
    beat()
    expect(unfold).not.toHaveBeenCalled()
    expect(seen).toEqual([])
    // The look shows up late, after its read.
    rerender({ asked: true })
    expect(unfold).toHaveBeenCalledTimes(1)
    beat()
    expect(seen).toEqual(['the-look'])
    // The reader scrolls away; the page does not jump again.
    rerender({ asked: false })
    rerender({ asked: true })
    beat()
    expect(unfold).toHaveBeenCalledTimes(1)
    expect(seen).toEqual(['the-look'])
  })

  it('hands back the same move for a press on the page', () => {
    const unfold = vi.fn()
    const { result } = renderHook(() => useLandOnLook({ asked: false, anchorId: 'the-look', unfold }))
    act(() => result.current())
    beat()
    expect(unfold).toHaveBeenCalledTimes(1)
    expect(seen).toEqual(['the-look'])
  })

  it('is quiet when the look is not on the page', () => {
    const { result } = renderHook(() => useLandOnLook({ asked: true, anchorId: 'no-such-look', unfold: () => undefined }))
    act(() => result.current())
    beat()
    expect(seen).toEqual([])
  })
})
