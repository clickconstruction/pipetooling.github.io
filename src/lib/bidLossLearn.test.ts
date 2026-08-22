import { describe, expect, it } from 'vitest'

import {
  buildBidLossLearnStats,
  formatLearnPct,
  learnReadKey,
  overLowPct,
  type BidLossLearnRow,
} from './bidLossLearn'
import { countTabsMatchedOrBeaten, marginPctToMatchTabLow } from './bidTabCapture'

const NOW = '2026-08-22T12:00:00.000Z'

let seq = 0
function row(over: Partial<BidLossLearnRow>): BidLossLearnRow {
  seq += 1
  return {
    id: `b${seq}`,
    builderKey: 'gc-knight',
    builderName: 'Knight Contracting',
    value: 274_249,
    sentIso: '2026-07-17',
    tab: { low: 230_000, high: 310_000, rankFromLow: 2, bidderCount: 6 },
    ...over,
  }
}

describe('overLowPct', () => {
  it('percent over the low; null when at/below or no low', () => {
    expect(overLowPct(230_000 * 1.1, 230_000)).toBeCloseTo(10)
    expect(overLowPct(230_000, 230_000)).toBeNull()
    expect(overLowPct(200_000, 230_000)).toBeNull()
    expect(overLowPct(200_000, null)).toBeNull()
  })
})

describe('buildBidLossLearnStats', () => {
  it('median, coverage, buckets, and GC rollup from a mixed set', () => {
    const rows = [
      row({ value: 236_900, tab: { low: 230_000, high: null, rankFromLow: 2, bidderCount: null } }), // 3.0%
      row({ value: 241_500, tab: { low: 230_000, high: null, rankFromLow: 2, bidderCount: null } }), // 5.0%
      row({
        builderKey: 'gc-structura',
        builderName: 'Structura',
        value: 295_000,
        tab: { low: 250_000, high: null, rankFromLow: 5, bidderCount: 6 },
      }), // 18%
      row({ tab: { low: null, high: null, rankFromLow: null, bidderCount: null } }), // lost, no tab
    ]
    const s = buildBidLossLearnStats(rows, 'all', NOW)
    expect(s.lostCount).toBe(4)
    expect(s.tabbedCount).toBe(3)
    expect(s.medianPct).toBeCloseTo(5.0, 1)
    expect(s.deltaBuckets.map((b) => b.count)).toEqual([1, 1, 1, 0]) // 5.0% sits in the 5–10% bucket
    expect(s.rankBuckets.map((b) => `${b.label}:${b.count}`)).toEqual(['#2:2', '#3:0', '#4:0', '#5+:1'])
    expect(s.gcRows[0]!.builderName).toBe('Knight Contracting') // closest first
    expect(s.gcRows[0]!.medianPct).toBeCloseTo(4.0, 1)
    expect(s.gcRows[0]!.usualRank).toBe(2)
    expect(s.gcRows[1]!.read).toBe('far')
  })

  it('counts low-bid losses separately and adds a #1 bucket only when it happened', () => {
    const rows = [
      row({ value: 220_000, tab: { low: 230_000, high: null, rankFromLow: 1, bidderCount: 4 } }),
      row({ value: 241_500 }),
    ]
    const s = buildBidLossLearnStats(rows, 'all', NOW)
    expect(s.lowBidLossCount).toBe(1)
    expect(s.rankBuckets[0]).toEqual({ label: '#1', count: 1 })
    expect(s.medianPct).not.toBeNull() // only the real over-the-low delta feeds the median
  })

  it('window slicing drops old and undated rows', () => {
    const rows = [
      row({ sentIso: '2026-08-01' }),
      row({ sentIso: '2025-01-15' }),
      row({ sentIso: null }),
    ]
    expect(buildBidLossLearnStats(rows, 'all', NOW).tabbedCount).toBe(3)
    expect(buildBidLossLearnStats(rows, '12', NOW).tabbedCount).toBe(1)
    expect(buildBidLossLearnStats(rows, '6', NOW).tabbedCount).toBe(1)
  })

  it('quarter trend is chronological with per-quarter medians', () => {
    const rows = [
      row({ value: 253_000, sentIso: '2026-02-10' }), // Q1 10%
      row({ value: 247_250, sentIso: '2026-05-10' }), // Q2 7.5%
      row({ value: 241_500, sentIso: '2026-08-10' }), // Q3 5%
    ]
    const s = buildBidLossLearnStats(rows, 'all', NOW)
    expect(s.quarters.map((q) => q.label)).toEqual(["Q1 '26", "Q2 '26", "Q3 '26"])
    expect(s.quarters.map((q) => Math.round(q.medianPct * 10) / 10)).toEqual([10, 7.5, 5])
  })
})

describe('read thresholds + pct formatting', () => {
  it('maps medians to reads', () => {
    expect(learnReadKey(3.2)).toBe('razor')
    expect(learnReadKey(6)).toBe('close')
    expect(learnReadKey(9.5)).toBe('mid')
    expect(learnReadKey(18)).toBe('far')
  })

  it('formats like the capture kernel: decimals only under 10', () => {
    expect(formatLearnPct(7.44)).toBe('7.4%')
    expect(formatLearnPct(18.2)).toBe('18%')
  })
})

describe('workbench strip helpers', () => {
  it('margin to match a tab low', () => {
    expect(marginPctToMatchTabLow(230_000, 161_000)).toBeCloseTo(30)
    expect(marginPctToMatchTabLow(230_000, 230_000)).toBeNull() // cost at the low — no margin matches
    expect(marginPctToMatchTabLow(null, 100_000)).toBeNull()
    expect(marginPctToMatchTabLow(230_000, 0)).toBeNull()
  })

  it('counts tabs a candidate margin would have matched or beaten', () => {
    expect(countTabsMatchedOrBeaten(32, [30, 33, 40, 28])).toBe(2)
    expect(countTabsMatchedOrBeaten(30.4, [30])).toBe(1) // half-point tolerance
  })
})
