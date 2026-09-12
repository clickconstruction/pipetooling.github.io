import { describe, expect, it } from 'vitest'
import { buildEarnedRevenue } from '../bridge/earnedRevenue'
import { reviewJobEarned, reviewShareRatio } from './reviewEarned'

describe('reviewJobEarned — the Bridge’s rule on Review', () => {
  it('a finished job is 100% whatever its % says', () => {
    for (const status of ['ready_to_bill', 'billed', 'paid']) {
      const e = reviewJobEarned({ revenue: 10_000, pctComplete: 40, status, lifetimeHours: 100 })
      expect(e).toMatchObject({ pctEffective: 1, finished: true, assumedHalf: false, valueCreated: 10_000, expectedHours: 100 })
    }
    expect(reviewJobEarned({ revenue: 10_000, pctComplete: null, status: 'paid', lifetimeHours: 100 }).valueCreated).toBe(10_000)
  })

  it('an open job with a % uses it; with none it is assumed half done and marked', () => {
    expect(reviewJobEarned({ revenue: 10_000, pctComplete: 40, status: 'working', lifetimeHours: 100 })).toMatchObject({ pctEffective: 0.4, valueCreated: 4000, assumedHalf: false, expectedHours: 250 })
    expect(reviewJobEarned({ revenue: 10_000, pctComplete: null, status: 'working', lifetimeHours: 100 })).toMatchObject({ pctEffective: 0.5, valueCreated: 5000, assumedHalf: true, expectedHours: 200 })
    expect(reviewJobEarned({ revenue: 10_000, pctComplete: 0, status: 'working', lifetimeHours: 100 }).assumedHalf).toBe(true)
    expect(reviewJobEarned({ revenue: 10_000, pctComplete: 130, status: 'working', lifetimeHours: 100 }).pctEffective).toBe(1)
  })

  it('an unknown status is not finished; no contract $ creates no value', () => {
    expect(reviewJobEarned({ revenue: 10_000, pctComplete: null, status: null, lifetimeHours: 10 }).pctEffective).toBe(0.5)
    expect(reviewJobEarned({ revenue: null, pctComplete: 80, status: 'working', lifetimeHours: 10 }).valueCreated).toBe(0)
    expect(reviewJobEarned({ revenue: -5, pctComplete: 80, status: 'working', lifetimeHours: 10 }).valueCreated).toBe(0)
  })

  it('hours × the Bridge’s rate equals value created × the hours share — a person’s earned agrees across the two surfaces', () => {
    const job = { id: 'j', revenueUsd: 50_000, pctComplete: 40, status: 'working', lifetimeHours: 100 }
    const bridge = buildEarnedRevenue({ jobs: [job], sessions: [{ jobId: 'j', ymd: '2026-09-08', hours: 8 }] })
    const review = reviewJobEarned({ revenue: 50_000, pctComplete: 40, status: 'working', lifetimeHours: 100 })
    const onReview = review.valueCreated * reviewShareRatio(8, 100)
    expect(onReview).toBeCloseTo(bridge.earnedByJob.get('j')!, 6)
    expect(onReview).toBe(1600)
  })
})

describe('reviewShareRatio', () => {
  it('is hours ÷ lifetime hours, capped at 1, whole when lifetime is unknown, zero without hours', () => {
    expect(reviewShareRatio(8, 100)).toBe(0.08)
    expect(reviewShareRatio(120, 100)).toBe(1)
    expect(reviewShareRatio(8, 0)).toBe(1)
    expect(reviewShareRatio(0, 100)).toBe(0)
  })
})
