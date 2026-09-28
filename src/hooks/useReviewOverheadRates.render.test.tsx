// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { EMPTY_REVIEW_OVERHEAD_RATES, type ReviewOverheadRates } from '../lib/people/loadReviewOverheadRates'

const load = vi.fn<(opts: { isCancelled?: () => boolean }) => Promise<ReviewOverheadRates | null>>()
vi.mock('../lib/people/loadReviewOverheadRates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/people/loadReviewOverheadRates')>()),
  loadReviewOverheadRates: (opts: { isCancelled?: () => boolean }) => load(opts),
}))

import { useReviewOverheadRates } from './useReviewOverheadRates'

const LOADED: ReviewOverheadRates = {
  ratePerHour: 30,
  ratePerRevenueDecimal: 0.1,
  ratePerLaborDollar: 1,
  loading: false,
  windowStart: '2026-06-13',
  windowEnd: '2026-09-10',
  officeLabor90d: 40,
  bidLabor90d: 20,
  officeParts90d: 60,
  invoices90d: 1200,
  fieldHours90d: 4,
  fieldLaborUsd90d: 120,
}

/** A load the test finishes by hand. */
function pending() {
  let resolve!: (v: ReviewOverheadRates | null) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<ReviewOverheadRates | null>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  load.mockReset()
})

describe('useReviewOverheadRates', () => {
  it('does not load for someone who is not a dev, or before the user is known', () => {
    const notDev = renderHook(() => useReviewOverheadRates(false, 'user-1'))
    const noUser = renderHook(() => useReviewOverheadRates(true, undefined))
    expect(load).not.toHaveBeenCalled()
    expect(notDev.result.current).toEqual(EMPTY_REVIEW_OVERHEAD_RATES)
    expect(noUser.result.current).toEqual(EMPTY_REVIEW_OVERHEAD_RATES)
  })

  it('shows loading while the scan runs, then the rates', async () => {
    const p = pending()
    load.mockReturnValue(p.promise)
    const { result } = renderHook(() => useReviewOverheadRates(true, 'user-1'))
    expect(load).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual({ ...EMPTY_REVIEW_OVERHEAD_RATES, loading: true })
    await act(async () => {
      p.resolve(LOADED)
    })
    expect(result.current).toEqual(LOADED)
  })

  it('resets to all-null when the scan fails', async () => {
    load.mockRejectedValue(new Error('rls'))
    const { result } = renderHook(() => useReviewOverheadRates(true, 'user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current).toEqual(EMPTY_REVIEW_OVERHEAD_RATES)
  })

  it('tells the scan it is cancelled on unmount, and takes nothing from it afterwards', async () => {
    const p = pending()
    load.mockReturnValue(p.promise)
    const { result, unmount } = renderHook(() => useReviewOverheadRates(true, 'user-1'))
    const isCancelled = load.mock.calls[0]![0].isCancelled!
    expect(isCancelled()).toBe(false)
    unmount()
    expect(isCancelled()).toBe(true)
    await act(async () => {
      p.resolve(LOADED)
    })
    expect(result.current).toEqual({ ...EMPTY_REVIEW_OVERHEAD_RATES, loading: true })
  })

  it('loads again when the signed-in user changes, and ignores the first scan', async () => {
    const first = pending()
    const second = pending()
    load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result, rerender } = renderHook(({ id }) => useReviewOverheadRates(true, id), { initialProps: { id: 'user-1' } })
    rerender({ id: 'user-2' })
    expect(load).toHaveBeenCalledTimes(2)
    await act(async () => {
      first.resolve({ ...LOADED, ratePerHour: 999 })
      second.resolve(LOADED)
    })
    expect(result.current).toEqual(LOADED)
  })

  it('keeps what it has when a scan comes back cancelled', async () => {
    load.mockResolvedValue(null)
    const { result } = renderHook(() => useReviewOverheadRates(true, 'user-1'))
    await act(async () => {})
    expect(result.current).toEqual({ ...EMPTY_REVIEW_OVERHEAD_RATES, loading: true })
  })
})
