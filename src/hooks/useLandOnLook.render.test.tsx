// @vitest-environment jsdom
/**
 * Landing a page on one of its looks (punch list #379, PR 6): once the link asked and the look is on the
 * page, the look is opened and scrolled to, one time. The move is handed back for a press on the page.
 * A link that asks for something new on the same page (another trip under `?trip=`) lands again. A landing
 * that names a target inside the look scrolls to the target, one time, and to the look when it is not there.
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

  it('lands again when the link asks for something new, and once for each thing asked', () => {
    const unfold = vi.fn()
    const { rerender } = renderHook(({ askKey }) => useLandOnLook({ asked: true, anchorId: 'the-look', unfold, askKey }), { initialProps: { askKey: 't5' } })
    beat()
    expect(seen).toEqual(['the-look'])
    rerender({ askKey: 't5' })
    beat()
    expect(seen).toEqual(['the-look'])
    // A second link, to another trip, on the same mounted page.
    rerender({ askKey: 't6' })
    beat()
    expect(unfold).toHaveBeenCalledTimes(2)
    expect(seen).toEqual(['the-look', 'the-look'])
  })

  it('lands on the target inside the look when it is on the page, in the one scroll it makes', () => {
    const row = document.createElement('div')
    row.id = 'the-row'
    document.body.appendChild(row)
    const unfold = vi.fn()
    const { rerender, result } = renderHook(({ asked }) => useLandOnLook({ asked, anchorId: 'the-look', unfold, askKey: 't5', targetId: 'the-row' }), { initialProps: { asked: true } })
    beat()
    expect(unfold).toHaveBeenCalledTimes(1)
    expect(seen).toEqual(['the-row'])
    // A later render moves nothing: the reader's own scrolling is left alone.
    rerender({ asked: true })
    rerender({ asked: false })
    rerender({ asked: true })
    beat()
    expect(seen).toEqual(['the-row'])
    // A press names its own target, and a plain press goes to the look.
    act(() => result.current('the-row'))
    beat()
    act(() => result.current())
    beat()
    expect(seen).toEqual(['the-row', 'the-row', 'the-look'])
  })

  it('lands on the look’s top when the target is not on the page', () => {
    const { result } = renderHook(() => useLandOnLook({ asked: true, anchorId: 'the-look', unfold: () => undefined, askKey: 't-gone', targetId: 'no-such-row' }))
    beat()
    expect(seen).toEqual(['the-look'])
    act(() => result.current('no-such-row'))
    beat()
    expect(seen).toEqual(['the-look', 'the-look'])
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
