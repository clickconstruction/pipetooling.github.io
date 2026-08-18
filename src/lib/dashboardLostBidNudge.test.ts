import { describe, expect, it } from 'vitest'
import {
  LOST_BID_NUDGE_MIN_COUNT,
  buildLostBidNudge,
  formatLostBidNudgeValue,
} from './dashboardLostBidNudge'

const uncat = (bid_value: number | null = 100000) => ({ loss_category: null, bid_value })

describe('buildLostBidNudge', () => {
  it('returns null below the threshold', () => {
    expect(buildLostBidNudge([uncat(), uncat(), uncat(), uncat()])).toBeNull()
  })

  it('fires at the threshold with count and summed value', () => {
    const rows = Array.from({ length: LOST_BID_NUDGE_MIN_COUNT }, () => uncat(200000))
    expect(buildLostBidNudge(rows)).toEqual({ count: 5, value: 1000000 })
  })

  it('categorized bids never count — even with a large backlog of them', () => {
    const rows = [
      ...Array.from({ length: 20 }, () => ({ loss_category: 'gc_lost', bid_value: 500000 })),
      ...Array.from({ length: 3 }, () => uncat()),
    ]
    expect(buildLostBidNudge(rows)).toBeNull()
  })

  it('legacy free-text junk in loss_category still counts as uncategorized', () => {
    const rows = Array.from({ length: 5 }, () => ({ loss_category: 'some old text', bid_value: 1000 }))
    expect(buildLostBidNudge(rows)).toEqual({ count: 5, value: 5000 })
  })

  it('null and non-finite bid values contribute zero dollars but still count', () => {
    const rows = [uncat(null), uncat(Number.NaN), uncat(100), uncat(100), uncat(100)]
    expect(buildLostBidNudge(rows)).toEqual({ count: 5, value: 300 })
  })

  it('honors a custom threshold', () => {
    expect(buildLostBidNudge([uncat()], 1)).toEqual({ count: 1, value: 100000 })
    expect(buildLostBidNudge([], 0)).toBeNull()
  })
})

describe('formatLostBidNudgeValue', () => {
  it('formats millions with one decimal below 10M, none above', () => {
    expect(formatLostBidNudgeValue(5847108)).toBe('$5.8M')
    expect(formatLostBidNudgeValue(12400000)).toBe('$12M')
  })

  it('formats thousands and small values', () => {
    expect(formatLostBidNudgeValue(713900)).toBe('$714k')
    expect(formatLostBidNudgeValue(940)).toBe('$940')
  })

  it('handles zero and junk', () => {
    expect(formatLostBidNudgeValue(0)).toBe('$0')
    expect(formatLostBidNudgeValue(Number.NaN)).toBe('$0')
  })
})
