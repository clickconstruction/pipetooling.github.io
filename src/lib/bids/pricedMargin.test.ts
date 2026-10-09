import { describe, expect, it } from 'vitest'
import {
  mayStampPricedMargin,
  parseBidPricedMargin,
  pricedMarginDetailWords,
  pricedMarginPartialWords,
  pricedMarginPct,
  pricedMarginPctWords,
  pricedMarginStampDiffers,
  pricedMarginStampInput,
  pricedMarginStampOnScreen,
  pricedVsDirectWords,
  type BidPricedMargin,
} from './pricedMargin'

const stamp: BidPricedMargin = { pct: 31.42, revenueUsd: 48_700, costUsd: 33_400, uncostedUsd: 0, rateSet: true, bidVersionId: null, at: '2026-10-09T15:00:00Z' }

describe('pricedMarginStampInput (v2.5043)', () => {
  it('reads saved prices × counts, the workbench cost, the uncosted revenue and whether a rate is set', () => {
    const rows = [
      { unitPrice: 450, count: 40 }, // $18,000
      { unitPrice: 1_230, count: 25 }, // $30,750
      { unitPrice: 0, count: 3 }, // a saved $0 is not a price
      { unitPrice: null, count: 9 }, // unpriced
    ]
    expect(pricedMarginStampInput({ rows, totalCost: 33_400.004, uncostedRevenue: 1_200, laborRate: 35.76 })).toEqual({ revenueUsd: 48_750, costUsd: 33_400, uncostedUsd: 1_200, rateSet: true })
  })
  it('nothing priced reads null; a missing rate and a negative cost read as none', () => {
    expect(pricedMarginStampInput({ rows: [{ unitPrice: null, count: 4 }], totalCost: 10, uncostedRevenue: 0, laborRate: 30 })).toBeNull()
    expect(pricedMarginStampInput({ rows: [{ unitPrice: 100, count: 1 }], totalCost: -5, uncostedRevenue: -1, laborRate: null })).toEqual({ revenueUsd: 100, costUsd: 0, uncostedUsd: 0, rateSet: false })
  })
  it('the margin to two decimals, as the server computes it', () => {
    expect(pricedMarginPct({ revenueUsd: 48_700, costUsd: 33_400, uncostedUsd: 0, rateSet: true })).toBe(31.42)
    expect(pricedMarginPct({ revenueUsd: 1_000, costUsd: 1_250, uncostedUsd: 0, rateSet: true })).toBe(-25)
  })
})

describe('mayStampPricedMargin (v2.5043)', () => {
  const ok = { bidDateSent: null, viewingPricingId: 'p1', customerFacingPricingId: 'p1', bidVersion: null }
  it('an unsent bid on its customer-facing price, with no versions or on its own GC’s base', () => {
    expect(mayStampPricedMargin(ok)).toBe(true)
    expect(mayStampPricedMargin({ ...ok, bidVersion: { customer_id: null, is_alternate: false } })).toBe(true)
  })
  it('never once sent, on another price, on another GC’s version or on an add-on alternate', () => {
    expect(mayStampPricedMargin({ ...ok, bidDateSent: '2026-10-09' })).toBe(false)
    expect(mayStampPricedMargin({ ...ok, viewingPricingId: 'p2' })).toBe(false)
    expect(mayStampPricedMargin({ ...ok, viewingPricingId: null, customerFacingPricingId: null })).toBe(false)
    expect(mayStampPricedMargin({ ...ok, bidVersion: { customer_id: 'gc-2' } })).toBe(false)
    expect(mayStampPricedMargin({ ...ok, bidVersion: { is_alternate: true } })).toBe(false)
  })
})

describe('pricedMarginStampDiffers (v2.5043)', () => {
  const input = { revenueUsd: 48_700, costUsd: 33_400, uncostedUsd: 0, rateSet: true }
  it('no stamp yet, or any input or the version moved, is worth a write', () => {
    expect(pricedMarginStampDiffers(null, input, null)).toBe(true)
    expect(pricedMarginStampDiffers(stamp, { ...input, revenueUsd: 48_705 }, null)).toBe(true)
    expect(pricedMarginStampDiffers(stamp, { ...input, costUsd: 33_399.99 }, null)).toBe(true)
    expect(pricedMarginStampDiffers(stamp, { ...input, uncostedUsd: 5 }, null)).toBe(true)
    expect(pricedMarginStampDiffers(stamp, { ...input, rateSet: false }, null)).toBe(true)
    expect(pricedMarginStampDiffers(stamp, input, 'v2')).toBe(true)
  })
  it('the same numbers to the cent are not', () => {
    expect(pricedMarginStampDiffers({ ...stamp, costUsd: 33_400.001 }, input, null)).toBe(false)
  })
})

describe('parseBidPricedMargin (v2.5043)', () => {
  it('reads the bids row’s priced columns, numeric strings included', () => {
    expect(
      parseBidPricedMargin({ priced_margin_pct: '31.42', priced_revenue_usd: '48700', priced_cost_usd: '33400', priced_uncosted_usd: null, priced_rate_set: true, priced_bid_version_id: 'v1', priced_at: '2026-10-09T15:00:00Z' }),
    ).toEqual({ ...stamp, bidVersionId: 'v1' })
  })
  it('no stamp, or a row without a revenue, reads null', () => {
    expect(parseBidPricedMargin(null)).toBeNull()
    expect(parseBidPricedMargin({ priced_margin_pct: null, priced_revenue_usd: null })).toBeNull()
    expect(parseBidPricedMargin({ priced_margin_pct: 30, priced_revenue_usd: 0 })).toBeNull()
  })
})

describe('the words (v2.5043)', () => {
  it('whole points, the inputs behind them, and why a stamp reads high', () => {
    expect(pricedMarginPctWords(stamp)).toBe('31%')
    expect(pricedMarginDetailWords(stamp)).toBe('$33,400 cost on $48,700')
    expect(pricedMarginPartialWords({ rateSet: false, uncostedUsd: 1_200 })).toEqual(['no labor rate', '$1,200 on rows with no cost'])
    expect(pricedMarginDetailWords({ ...stamp, rateSet: false, uncostedUsd: 0.4 })).toBe('$33,400 cost on $48,700 · no labor rate')
  })
  it('the job’s direct margin at completion against the price, in whole points', () => {
    expect(pricedVsDirectWords(15.3, stamp)).toBe('16 pts under the price')
    expect(pricedVsDirectWords(32.2, stamp)).toBe('1 pt over the price')
    expect(pricedVsDirectWords(30.6, stamp)).toBe('on the price')
    expect(pricedVsDirectWords(null, stamp)).toBeNull()
    expect(pricedVsDirectWords(20, null)).toBeNull()
  })
})

describe('pricedMarginStampOnScreen (v2.5043)', () => {
  const derived = { rows: [{ unitPrice: 450, count: 40 }, { unitPrice: null, count: 2 }], totalCost: 12_000, uncostedRevenue: 0, rate: 35.76 }
  const base = { bid: { id: 'b1', bid_date_sent: null }, derived, selectedBidVersionId: null, bidVersions: [], viewingPricingId: 'p1', customerFacingPricingId: 'p1' }
  it('the numbers over saved prices and the gate, for the bid on screen', () => {
    expect(pricedMarginStampOnScreen(base)).toEqual({ bidId: 'b1', bidVersionId: null, input: { revenueUsd: 18_000, costUsd: 12_000, uncostedUsd: 0, rateSet: true }, mayStamp: true })
  })
  it('reads the version on screen: another GC’s version may not stamp, its own base may', () => {
    const versions = [{ id: 'v1', customer_id: null, is_alternate: false }, { id: 'v2', customer_id: 'gc-2', is_alternate: false }]
    expect(pricedMarginStampOnScreen({ ...base, bidVersions: versions, selectedBidVersionId: 'v1' })).toMatchObject({ bidVersionId: 'v1', mayStamp: true })
    expect(pricedMarginStampOnScreen({ ...base, bidVersions: versions, selectedBidVersionId: 'v2' })).toMatchObject({ bidVersionId: 'v2', mayStamp: false })
  })
  it('no bid, nothing; no derivation yet, no numbers; a sent bid may not stamp', () => {
    expect(pricedMarginStampOnScreen({ ...base, bid: null })).toBeNull()
    expect(pricedMarginStampOnScreen({ ...base, derived: null })!.input).toBeNull()
    expect(pricedMarginStampOnScreen({ ...base, bid: { id: 'b1', bid_date_sent: '2026-10-09' } })!.mayStamp).toBe(false)
  })
})
