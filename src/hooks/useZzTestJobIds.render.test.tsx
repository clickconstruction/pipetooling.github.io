// @vitest-environment jsdom
/**
 * The shared ZZ ids as a screen sees them (punch list #61, review on #5241): `loading` until they land,
 * two quiet retries, then `failed` until Try again; `off` for a role that sees ZZ jobs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const load = vi.fn()
vi.mock('../lib/jobs/zzTestJobRows', () => ({ loadZzTestJobIds: (...a: unknown[]) => load(...a) }))

const { useZzTestJobIds, ZZ_TEST_JOB_IDS_RETRY_DELAYS_MS } = await import('./useZzTestJobIds')

beforeEach(() => {
  vi.useFakeTimers()
  load.mockReset()
})
afterEach(() => vi.useRealTimers())

const flush = async () => {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('useZzTestJobIds', () => {
  it('is off, with no read, when the role sees ZZ jobs', () => {
    const { result } = renderHook(() => useZzTestJobIds(false, 'u-dev'))
    expect(result.current.status).toBe('off')
    expect(load).not.toHaveBeenCalled()
  })

  it('reads as loading until the ids land, for this user', async () => {
    load.mockResolvedValue(new Set(['Z']))
    const { result } = renderHook(() => useZzTestJobIds(true, 'u-ann'))
    expect(result.current.status).toBe('loading')
    expect(result.current.ids).toBeNull()
    await flush()
    expect(result.current.status).toBe('ready')
    expect(result.current.ids).toEqual(new Set(['Z']))
    expect(load).toHaveBeenCalledWith('u-ann')
  })

  it('retries twice, then fails until Try again', async () => {
    load.mockRejectedValue(new Error('down'))
    const { result } = renderHook(() => useZzTestJobIds(true, 'u-ann'))
    await flush()
    expect(result.current.status).toBe('loading')
    await act(async () => {
      vi.advanceTimersByTime(ZZ_TEST_JOB_IDS_RETRY_DELAYS_MS[0])
    })
    await flush()
    await act(async () => {
      vi.advanceTimersByTime(ZZ_TEST_JOB_IDS_RETRY_DELAYS_MS[1])
    })
    await flush()
    expect(load).toHaveBeenCalledTimes(3)
    expect(result.current.status).toBe('failed')
    expect(result.current.ids).toBeNull()
    load.mockResolvedValue(new Set(['Z']))
    act(() => result.current.retry())
    expect(result.current.status).toBe('loading')
    await flush()
    expect(result.current.status).toBe('ready')
  })
})
