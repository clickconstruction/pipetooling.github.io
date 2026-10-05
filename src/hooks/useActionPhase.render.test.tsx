// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useActionPhase } from './useActionPhase'
import { DOWNLOADED_HOLD_MS, DOWNLOADING_MIN_MS } from '../lib/jobs/downloadFeedback'

describe('useActionPhase', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('holds busy for the minimum after quick work, then done, then idle', async () => {
    const { result } = renderHook(() => useActionPhase())
    await act(async () => {
      await result.current.run(async () => true)
    })
    expect(result.current.phase).toBe('busy')
    act(() => void vi.advanceTimersByTime(DOWNLOADING_MIN_MS - 1))
    expect(result.current.phase).toBe('busy')
    act(() => void vi.advanceTimersByTime(1))
    expect(result.current.phase).toBe('done')
    act(() => void vi.advanceTimersByTime(DOWNLOADED_HOLD_MS))
    expect(result.current.phase).toBe('idle')
  })

  it('work that fails or throws goes straight back to idle', async () => {
    const { result } = renderHook(() => useActionPhase())
    await act(async () => {
      await result.current.run(async () => false)
    })
    expect(result.current.phase).toBe('idle')
    await act(async () => {
      await result.current.run(async () => {
        throw new Error('no')
      })
    })
    expect(result.current.phase).toBe('idle')
  })

  it('a second press while busy starts nothing, and flashDone shows done then idle', async () => {
    const { result } = renderHook(() => useActionPhase())
    const work = vi.fn(async () => true)
    await act(async () => {
      await result.current.run(work)
      await result.current.run(work)
    })
    expect(work).toHaveBeenCalledTimes(1)
    act(() => void vi.advanceTimersByTime(DOWNLOADING_MIN_MS + DOWNLOADED_HOLD_MS))
    expect(result.current.phase).toBe('idle')
    act(() => result.current.flashDone())
    expect(result.current.phase).toBe('done')
    act(() => void vi.advanceTimersByTime(DOWNLOADED_HOLD_MS))
    expect(result.current.phase).toBe('idle')
  })
})
