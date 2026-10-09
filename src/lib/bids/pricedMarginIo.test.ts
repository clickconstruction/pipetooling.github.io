/**
 * The priced-margin stamp's two server calls (v2.5043). Both are fail-soft: before the migration is
 * pushed, or on any error, the workbench prices on and every surface reads "no stamp".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const select = vi.fn()
const inFilter = vi.fn()
vi.mock('../supabase', () => ({
  supabase: {
    rpc: (fn: string, args: unknown) => rpc(fn, args),
    from: (table: string) => ({ select: (cols: string) => (select(table, cols), { in: (col: string, ids: string[]) => inFilter(col, ids) }) }),
  },
}))

import { BID_PRICED_MARGIN_COLUMNS, loadBidPricedMargins, stampBidPricedMargin } from './pricedMarginIo'

const input = { revenueUsd: 48_700, costUsd: 33_400, uncostedUsd: 0, rateSet: true }

beforeEach(() => {
  rpc.mockReset()
  select.mockReset()
  inFilter.mockReset()
})

describe('stampBidPricedMargin', () => {
  it('calls the function with the strip’s numbers and reads its answer', async () => {
    rpc.mockResolvedValue({ data: { ok: true, margin_pct: '31.42', priced_at: '2026-10-09T15:00:00Z' }, error: null })
    expect(await stampBidPricedMargin({ bidId: 'b1', bidVersionId: 'v1', input })).toEqual({ ok: true, marginPct: 31.42, pricedAt: '2026-10-09T15:00:00Z' })
    expect(rpc).toHaveBeenCalledWith('stamp_bid_priced_margin', { p_bid_id: 'b1', p_bid_version_id: 'v1', p_revenue_usd: 48_700, p_cost_usd: 33_400, p_uncosted_usd: 0, p_rate_set: true })
  })
  it('a sent bid comes back refused with its reason; an answer that does not say ok is not a stamp', async () => {
    rpc.mockResolvedValue({ data: { ok: false, reason: 'sent' }, error: null })
    expect(await stampBidPricedMargin({ bidId: 'b1', bidVersionId: null, input })).toEqual({ ok: false, reason: 'sent' })
    rpc.mockResolvedValue({ data: { margin_pct: 31.42 }, error: null })
    expect(await stampBidPricedMargin({ bidId: 'b1', bidVersionId: null, input })).toEqual({ ok: false, reason: 'refused' })
  })
  it('an error, a missing function or a throw reads null', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Could not find the function' } }).mockRejectedValueOnce(new Error('offline'))
    expect(await stampBidPricedMargin({ bidId: 'b1', bidVersionId: null, input })).toBeNull()
    expect(await stampBidPricedMargin({ bidId: 'b1', bidVersionId: null, input })).toBeNull()
  })
})

describe('loadBidPricedMargins', () => {
  it('reads the stamps of the bids asked for, once each', async () => {
    inFilter.mockResolvedValue({ data: [{ id: 'b1', priced_margin_pct: 31.42, priced_revenue_usd: 48_700, priced_cost_usd: 33_400, priced_uncosted_usd: 0, priced_rate_set: true, priced_bid_version_id: null, priced_at: null }, { id: 'b2', priced_margin_pct: null, priced_revenue_usd: null }], error: null })
    const m = await loadBidPricedMargins(['b1', 'b2', 'b1', ''])
    expect(select).toHaveBeenCalledWith('bids', BID_PRICED_MARGIN_COLUMNS)
    expect(inFilter).toHaveBeenCalledWith('id', ['b1', 'b2'])
    expect([...m.keys()]).toEqual(['b1'])
    expect(m.get('b1')!.pct).toBe(31.42)
  })
  it('no ids reads nothing; an error (the columns not there yet) reads no stamps', async () => {
    expect((await loadBidPricedMargins([])).size).toBe(0)
    expect(select).not.toHaveBeenCalled()
    inFilter.mockResolvedValue({ data: null, error: { message: 'column bids.priced_margin_pct does not exist' } })
    expect((await loadBidPricedMargins(['b1'])).size).toBe(0)
  })
})
