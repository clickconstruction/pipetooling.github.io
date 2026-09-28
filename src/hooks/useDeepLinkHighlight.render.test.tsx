// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { DEEP_LINK_HIGHLIGHT_MS, useDeepLinkHighlight } from './useDeepLinkHighlight'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useDeepLinkHighlight', () => {
  it('starts with nothing ringed', () => {
    const { result } = renderHook(() => useDeepLinkHighlight())
    expect(result.current.id).toBeNull()
    expect(result.current.gen).toBe(0)
  })

  it('rings the id for two and a half seconds, then lets go', () => {
    const { result } = renderHook(() => useDeepLinkHighlight())
    act(() => result.current.flash('bid-1'))
    expect(result.current.id).toBe('bid-1')
    expect(result.current.gen).toBe(1)
    act(() => { vi.advanceTimersByTime(DEEP_LINK_HIGHLIGHT_MS - 1) })
    expect(result.current.id).toBe('bid-1')
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current.id).toBeNull()
    expect(result.current.gen).toBe(1)
  })

  it('a second landing replaces the ring and restarts its clock', () => {
    const { result } = renderHook(() => useDeepLinkHighlight())
    act(() => result.current.flash('bid-1'))
    act(() => { vi.advanceTimersByTime(2000) })
    act(() => result.current.flash('bid-2'))
    expect(result.current.id).toBe('bid-2')
    expect(result.current.gen).toBe(2)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current.id).toBe('bid-2')
    act(() => { vi.advanceTimersByTime(500) })
    expect(result.current.id).toBeNull()
  })

  it('landing on the same row twice counts twice', () => {
    const { result } = renderHook(() => useDeepLinkHighlight())
    act(() => result.current.flash('bid-1'))
    act(() => result.current.flash('bid-1'))
    expect(result.current.id).toBe('bid-1')
    expect(result.current.gen).toBe(2)
  })

  it('keeps the same flash across renders', () => {
    const { result, rerender } = renderHook(() => useDeepLinkHighlight())
    const first = result.current.flash
    act(() => result.current.flash('bid-1'))
    rerender()
    expect(result.current.flash).toBe(first)
  })

  it('leaving the page drops the pending clock', () => {
    const { result, unmount } = renderHook(() => useDeepLinkHighlight())
    act(() => result.current.flash('bid-1'))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
