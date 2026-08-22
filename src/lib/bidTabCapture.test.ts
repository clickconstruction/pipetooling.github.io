import { describe, expect, it } from 'vitest'

import {
  bidTabNoteLine,
  bidTabPositionLabel,
  bidTabRangePosition,
  bidTabSummary,
  bidTabValuesFromRow,
  buildBidTabPatch,
  deriveBidTabInsight,
  hasAnyBidTabValue,
  parseBidTabCapture,
  parseTabCount,
  parseTabMoney,
  type BidTabValues,
} from './bidTabCapture'

function values(over: Partial<BidTabValues> = {}): BidTabValues {
  return { low: 230_000, high: 310_000, rankFromLow: 2, bidderCount: 6, ...over }
}

describe('parseTabMoney', () => {
  it('parses call shorthand: k, m, $, commas', () => {
    expect(parseTabMoney('230k')).toBe(230_000)
    expect(parseTabMoney('1.2m')).toBe(1_200_000)
    expect(parseTabMoney('$230,000')).toBe(230_000)
    expect(parseTabMoney(' 230000 ')).toBe(230_000)
    expect(parseTabMoney('230.5K')).toBe(230_500)
  })

  it('rejects blank, garbage, and non-positive amounts', () => {
    expect(parseTabMoney('')).toBeNull()
    expect(parseTabMoney('abc')).toBeNull()
    expect(parseTabMoney('230k-ish')).toBeNull()
    expect(parseTabMoney('0')).toBeNull()
  })
})

describe('parseTabCount', () => {
  it('whole positive numbers only', () => {
    expect(parseTabCount('2')).toBe(2)
    expect(parseTabCount(' 6 ')).toBe(6)
    expect(parseTabCount('')).toBeNull()
    expect(parseTabCount('0')).toBeNull()
    expect(parseTabCount('2.5')).toBeNull()
    expect(parseTabCount('two')).toBeNull()
  })
})

describe('parseBidTabCapture', () => {
  it('parses the happy path with no errors', () => {
    const r = parseBidTabCapture({ lowText: '230k', highText: '310k', rankText: '2', countText: '6' })
    expect(r.errors).toEqual([])
    expect(r.values).toEqual(values())
  })

  it('blank fields are fine — partial tabs are worth keeping', () => {
    const r = parseBidTabCapture({ lowText: '230k', highText: '', rankText: '', countText: '' })
    expect(r.errors).toEqual([])
    expect(r.values).toEqual(values({ high: null, rankFromLow: null, bidderCount: null }))
  })

  it('flags unparseable text, inverted range, and rank beyond count', () => {
    expect(parseBidTabCapture({ lowText: 'cheap', highText: '', rankText: '', countText: '' }).errors).toHaveLength(1)
    expect(parseBidTabCapture({ lowText: '310k', highText: '230k', rankText: '', countText: '' }).errors).toHaveLength(1)
    expect(parseBidTabCapture({ lowText: '', highText: '', rankText: '7', countText: '6' }).errors).toHaveLength(1)
  })
})

describe('deriveBidTabInsight', () => {
  it('derives % over the low with the position', () => {
    const i = deriveBidTabInsight(values(), 274_249)
    expect(i?.tone).toBe('ok')
    expect(i?.line).toContain('19% over the low')
    expect(i?.line).toContain('#2 of 6 from the bottom')
  })

  it('rank 1 (or at/below the low) reads as "we were the low bid"', () => {
    expect(deriveBidTabInsight(values({ rankFromLow: 1 }), 274_249)?.line).toContain('low bid')
    expect(deriveBidTabInsight(values({ rankFromLow: null }), 220_000)?.line).toContain('low bid')
  })

  it('warns when our number is above the shared high but we were not last', () => {
    const i = deriveBidTabInsight(values({ high: 260_000 }), 274_249)
    expect(i?.tone).toBe('warn')
    expect(i?.line).toContain('double-check')
  })

  it('null with nothing to say', () => {
    expect(deriveBidTabInsight(values({ low: null, high: null, rankFromLow: null, bidderCount: null }), 274_249)).toBeNull()
  })
})

describe('summary + note + patch', () => {
  it('summary strings the recorded parts together', () => {
    expect(bidTabSummary(values(), 274_249)).toBe(
      'low $230,000 · high $310,000 · we were #2 of 6 from the bottom · 19% over the low',
    )
    expect(bidTabSummary(values({ low: null, high: null, bidderCount: null }), 274_249)).toBe('we were #2 from the bottom')
    expect(bidTabSummary({ low: null, high: null, rankFromLow: null, bidderCount: null }, 274_249)).toBeNull()
  })

  it('small deltas keep one decimal', () => {
    expect(bidTabSummary(values({ low: 270_000 }), 274_249)).toContain('1.6% over the low')
  })

  it('note line wraps the summary; falls back to the plain action label', () => {
    expect(bidTabNoteLine(values(), 274_249)).toMatch(/^Bid tab recorded — low/)
    expect(bidTabNoteLine({ low: null, high: null, rankFromLow: null, bidderCount: null }, 274_249)).toBe('Bid tab received')
  })

  it('patch carries explicit nulls so edits can clear fields', () => {
    expect(buildBidTabPatch(values({ high: null }))).toEqual({
      bid_tab_low: 230_000,
      bid_tab_high: null,
      bid_tab_rank_from_low: 2,
      bid_tab_bidder_count: 6,
    })
  })
})

describe('row round-trip + range position', () => {
  it('reads values from a bids row shape', () => {
    const v = bidTabValuesFromRow({ bid_tab_low: 1, bid_tab_high: 2, bid_tab_rank_from_low: 3, bid_tab_bidder_count: 4 })
    expect(v).toEqual({ low: 1, high: 2, rankFromLow: 3, bidderCount: 4 })
    expect(hasAnyBidTabValue(v)).toBe(true)
    expect(hasAnyBidTabValue(bidTabValuesFromRow({}))).toBe(false)
  })

  it('position label variants', () => {
    expect(bidTabPositionLabel(values())).toBe('#2 of 6 from the bottom')
    expect(bidTabPositionLabel(values({ bidderCount: null }))).toBe('#2 from the bottom')
    expect(bidTabPositionLabel(values({ rankFromLow: null }))).toBeNull()
  })

  it('range position is 0–100 and clamped', () => {
    expect(bidTabRangePosition(values(), 270_000)).toBe(50)
    expect(bidTabRangePosition(values(), 100_000)).toBe(0)
    expect(bidTabRangePosition(values(), 400_000)).toBe(100)
    expect(bidTabRangePosition(values({ high: null }), 270_000)).toBeNull()
  })
})
