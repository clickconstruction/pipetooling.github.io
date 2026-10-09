// @vitest-environment jsdom
/** The Costs verdict's read of the linked bid's priced margin (v2.5043): one bid, fail-soft, nothing without a bid or a wage role. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const load = vi.fn()
vi.mock('../lib/bids/pricedMarginIo', () => ({ loadBidPricedMargins: (ids: ReadonlyArray<string>) => load(ids) }))

import { useBidPricedMargin } from './useBidPricedMargin'

const stamp = { pct: 31.42, revenueUsd: 48_700, costUsd: 33_400, uncostedUsd: 0, rateSet: true, bidVersionId: null, at: null }

beforeEach(() => {
  load.mockReset()
})

describe('useBidPricedMargin', () => {
  it('reads the linked bid’s stamp', async () => {
    load.mockResolvedValue(new Map([['b1', stamp]]))
    const { result } = renderHook(() => useBidPricedMargin('b1', true))
    await waitFor(() => expect(result.current).toEqual(stamp))
    expect(load).toHaveBeenCalledWith(['b1'])
  })
  it('no bid, or a role that does not see the verdict, reads nothing', () => {
    const noBid = renderHook(() => useBidPricedMargin(null, true))
    const off = renderHook(() => useBidPricedMargin('b1', false))
    expect(noBid.result.current).toBeNull()
    expect(off.result.current).toBeNull()
    expect(load).not.toHaveBeenCalled()
  })
  it('a bid with no stamp reads null', async () => {
    load.mockResolvedValue(new Map())
    const { result } = renderHook(() => useBidPricedMargin('b2', true))
    await waitFor(() => expect(load).toHaveBeenCalled())
    expect(result.current).toBeNull()
  })
})
