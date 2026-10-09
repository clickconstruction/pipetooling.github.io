// @vitest-environment jsdom
/**
 * The priced-margin stamp (Burn against the bid, piece 1, v2.5043): a price write on this bid arms
 * it, the strip's numbers settle, and the stamp goes on the bid, unless nothing moved, the screen
 * may not stamp, or the arm belongs to another bid. Opening a bid never writes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { BidPricedMargin } from '../lib/bids/pricedMargin'

const load = vi.fn<(ids: ReadonlyArray<string>) => Promise<Map<string, BidPricedMargin>>>()
const stampRpc = vi.fn()
vi.mock('../lib/bids/pricedMarginIo', () => ({
  loadBidPricedMargins: (ids: ReadonlyArray<string>) => load(ids),
  stampBidPricedMargin: (args: unknown) => stampRpc(args),
}))

import { PRICED_MARGIN_STAMP_SETTLE_MS, usePricedMarginStamp, type PricedMarginStampArm, type PricedMarginStampLatest } from './usePricedMarginStamp'

const kept: BidPricedMargin = { pct: 31.42, revenueUsd: 48_700, costUsd: 33_400, uncostedUsd: 0, rateSet: true, bidVersionId: null, at: '2026-10-01T15:00:00Z' }
const latest = (o: Partial<PricedMarginStampLatest> = {}): { current: PricedMarginStampLatest | null } => ({
  current: { bidId: 'b1', bidVersionId: null, input: { revenueUsd: 50_000, costUsd: 33_400, uncostedUsd: 0, rateSet: true }, mayStamp: true, ...o },
})

async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}
async function settleWindow() {
  await act(async () => {
    vi.advanceTimersByTime(PRICED_MARGIN_STAMP_SETTLE_MS + 10)
  })
  await flush()
}

beforeEach(() => {
  vi.useFakeTimers()
  load.mockReset()
  stampRpc.mockReset()
  load.mockResolvedValue(new Map([['b1', kept]]))
  stampRpc.mockResolvedValue({ ok: true, marginPct: 33.2, pricedAt: '2026-10-09T16:00:00Z' })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('usePricedMarginStamp', () => {
  it('reads the bid’s stamp on open and writes nothing', async () => {
    const ref = latest()
    const { result } = renderHook(() => usePricedMarginStamp('b1', null, ref))
    await flush()
    expect(load).toHaveBeenCalledWith(['b1'])
    expect(result.current).toEqual(kept)
    await settleWindow()
    expect(stampRpc).not.toHaveBeenCalled()
  })

  it('a price write on this bid stamps the settled numbers and shows them', async () => {
    const ref = latest()
    const { result, rerender } = renderHook(({ arm }: { arm: PricedMarginStampArm | null }) => usePricedMarginStamp('b1', arm, ref), { initialProps: { arm: null as PricedMarginStampArm | null } })
    await flush()
    rerender({ arm: { bidId: 'b1', at: 1 } })
    // The strip moves again inside the window: the stamp reads what is on screen when it fires.
    ref.current = { ...ref.current!, input: { revenueUsd: 50_000, costUsd: 33_400, uncostedUsd: 250, rateSet: true } }
    expect(stampRpc).not.toHaveBeenCalled()
    await settleWindow()
    expect(stampRpc).toHaveBeenCalledWith({ bidId: 'b1', bidVersionId: null, input: { revenueUsd: 50_000, costUsd: 33_400, uncostedUsd: 250, rateSet: true } })
    expect(result.current).toEqual({ pct: 33.2, revenueUsd: 50_000, costUsd: 33_400, uncostedUsd: 250, rateSet: true, bidVersionId: null, at: '2026-10-09T16:00:00Z' })
  })

  it('an arm made on another bid, numbers that did not move, or a screen that may not stamp write nothing', async () => {
    const other = renderHook(() => usePricedMarginStamp('b1', { bidId: 'b0', at: 1 }, latest()))
    await flush()
    await settleWindow()
    const same = renderHook(() => usePricedMarginStamp('b1', { bidId: 'b1', at: 2 }, latest({ input: { revenueUsd: 48_700, costUsd: 33_400, uncostedUsd: 0, rateSet: true } })))
    await flush()
    await settleWindow()
    const sent = renderHook(() => usePricedMarginStamp('b1', { bidId: 'b1', at: 3 }, latest({ mayStamp: false })))
    await flush()
    await settleWindow()
    expect(stampRpc).not.toHaveBeenCalled()
    other.unmount()
    same.unmount()
    sent.unmount()
  })

  it('a refused or failed stamp leaves the kept one on screen', async () => {
    stampRpc.mockResolvedValueOnce({ ok: false, reason: 'sent' }).mockResolvedValueOnce(null)
    const ref = latest()
    const { result, rerender } = renderHook(({ arm }: { arm: PricedMarginStampArm | null }) => usePricedMarginStamp('b1', arm, ref), { initialProps: { arm: null as PricedMarginStampArm | null } })
    await flush()
    rerender({ arm: { bidId: 'b1', at: 1 } })
    await settleWindow()
    rerender({ arm: { bidId: 'b1', at: 2 } })
    await settleWindow()
    expect(stampRpc).toHaveBeenCalledTimes(2)
    expect(result.current).toEqual(kept)
  })
})
