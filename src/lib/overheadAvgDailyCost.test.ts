import { describe, expect, it } from 'vitest'
import {
  bucketInvoiceRevenueByAppTzDay,
  computeOverheadTrailingAverages,
  computeOverheadTrailingWindow,
} from './overheadAvgDailyCost'

describe('computeOverheadTrailingWindow', () => {
  const totalsByDay = new Map([
    ['2026-06-10', 100],
    ['2026-06-09', 50],
    ['2026-06-01', 700], // outside a 7-day window ending 06-10
  ])
  const revenueByDay = new Map([
    ['2026-06-10', 1000],
    ['2026-06-04', 500], // inside the 7-day window (10 - 6)
  ])

  it('sums only the trailing N days and divides by the FIXED window length', () => {
    const w = computeOverheadTrailingWindow({ totalsByDay, revenueByDay, endYmd: '2026-06-10', days: 7 })
    expect(w.costUsd).toBe(150)
    expect(w.revenueUsd).toBe(1500)
    // Zero-activity days are included in the divisor: 150 / 7, not 150 / 2.
    expect(w.avgDailyCostUsd).toBeCloseTo(150 / 7, 10)
    expect(w.per100RevenueUsd).toBeCloseTo(10, 10)
  })

  it('includes the boundary day exactly N-1 back', () => {
    const w = computeOverheadTrailingWindow({
      totalsByDay: new Map([['2026-06-01', 700]]),
      revenueByDay: new Map(),
      endYmd: '2026-06-10',
      days: 10,
    })
    expect(w.costUsd).toBe(700)
  })

  it('returns null per-$100 when window revenue is zero', () => {
    const w = computeOverheadTrailingWindow({
      totalsByDay,
      revenueByDay: new Map(),
      endYmd: '2026-06-10',
      days: 7,
    })
    expect(w.per100RevenueUsd).toBe(null)
    expect(w.avgDailyCostUsd).toBeCloseTo(150 / 7, 10)
  })

  it('handles empty maps (all-zero window)', () => {
    const w = computeOverheadTrailingWindow({
      totalsByDay: new Map(),
      revenueByDay: new Map(),
      endYmd: '2026-06-10',
      days: 30,
    })
    expect(w.costUsd).toBe(0)
    expect(w.avgDailyCostUsd).toBe(0)
    expect(w.per100RevenueUsd).toBe(null)
  })
})

describe('computeOverheadTrailingAverages', () => {
  it('produces the 7/30/90 windows off the same maps', () => {
    const totalsByDay = new Map([
      ['2026-06-10', 70],
      ['2026-05-20', 30], // >7 days back, inside 30
      ['2026-03-20', 900], // >30 days back, inside 90
    ])
    const r = computeOverheadTrailingAverages({ totalsByDay, revenueByDay: new Map(), todayYmd: '2026-06-10' })
    expect(r.w7.costUsd).toBe(70)
    expect(r.w30.costUsd).toBe(100)
    expect(r.w90.costUsd).toBe(1000)
    expect(r.w7.days).toBe(7)
    expect(r.w30.days).toBe(30)
    expect(r.w90.days).toBe(90)
  })
})

describe('bucketInvoiceRevenueByAppTzDay', () => {
  it('buckets by Chicago wall date, not UTC date', () => {
    // 2026-06-03T03:30Z = 2026-06-02 22:30 in America/Chicago (CDT, UTC-5).
    const out = bucketInvoiceRevenueByAppTzDay(
      [{ amount: 250, sent_to_customer_at: '2026-06-03T03:30:00Z' }],
      '2026-06-01',
      '2026-06-10',
    )
    expect(out.get('2026-06-02')).toBe(250)
    expect(out.has('2026-06-03')).toBe(false)
  })

  it('sums multiple invoices on the same day and coerces string amounts', () => {
    const out = bucketInvoiceRevenueByAppTzDay(
      [
        { amount: 100, sent_to_customer_at: '2026-06-05T15:00:00Z' },
        { amount: '25.50', sent_to_customer_at: '2026-06-05T16:00:00Z' },
      ],
      '2026-06-01',
      '2026-06-10',
    )
    expect(out.get('2026-06-05')).toBe(125.5)
  })

  it('clamps to the ymd window (the fetch is deliberately a day wide)', () => {
    const out = bucketInvoiceRevenueByAppTzDay(
      [
        { amount: 10, sent_to_customer_at: '2026-05-31T18:00:00Z' }, // before start
        { amount: 20, sent_to_customer_at: '2026-06-11T18:00:00Z' }, // after end
        { amount: 30, sent_to_customer_at: '2026-06-01T18:00:00Z' }, // in range
      ],
      '2026-06-01',
      '2026-06-10',
    )
    expect([...out.entries()]).toEqual([['2026-06-01', 30]])
  })

  it('skips null timestamps and null amounts count as $0', () => {
    const out = bucketInvoiceRevenueByAppTzDay(
      [
        { amount: 99, sent_to_customer_at: null },
        { amount: null, sent_to_customer_at: '2026-06-05T15:00:00Z' },
      ],
      '2026-06-01',
      '2026-06-10',
    )
    expect(out.get('2026-06-05')).toBe(0)
    expect(out.size).toBe(1)
  })
})
