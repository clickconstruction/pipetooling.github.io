// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSupabaseQuiet } from './useSupabaseQuiet'
import { __resetSupabaseInFlightForTests, SUPABASE_QUIET_MS, wrapFetchCountingInFlight } from '../lib/supabaseInFlight'

describe('useSupabaseQuiet (punch list #365, v2.8616)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    __resetSupabaseInFlightForTests()
  })

  it('is false until the client has been quiet for the window, false again while a request runs, and true once it lands', async () => {
    let resolve: ((r: Response) => void) | null = null
    const f = wrapFetchCountingInFlight(() => new Promise<Response>((r) => (resolve = r)))
    const { result } = renderHook(() => useSupabaseQuiet())
    expect(result.current).toBe(false)
    act(() => void vi.advanceTimersByTime(SUPABASE_QUIET_MS - 1))
    expect(result.current).toBe(false)
    act(() => void vi.advanceTimersByTime(1))
    expect(result.current).toBe(true)
    // A request starts: not quiet, at once, and not while it runs.
    let p: Promise<Response> | null = null
    act(() => {
      p = f('https://x/rest/v1/rows')
    })
    expect(result.current).toBe(false)
    act(() => void vi.advanceTimersByTime(SUPABASE_QUIET_MS * 3))
    expect(result.current).toBe(false)
    // It lands: quiet again only after a whole window with nothing in flight.
    await act(async () => {
      resolve?.(new Response('{}'))
      await p
    })
    expect(result.current).toBe(false)
    act(() => void vi.advanceTimersByTime(SUPABASE_QUIET_MS))
    expect(result.current).toBe(true)
  })

  it('takes its own window', () => {
    renderHook(() => useSupabaseQuiet(50))
    const { result } = renderHook(() => useSupabaseQuiet(50))
    act(() => void vi.advanceTimersByTime(50))
    expect(result.current).toBe(true)
  })
})
