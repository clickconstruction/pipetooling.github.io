import { describe, expect, it } from 'vitest'
import type { FinanceAgingBuckets } from './dashboardFinanceModalRows'
import { financeCardBarSegments, financeCardRisk } from './financeCardAging'

const buckets = (ok: number, warn: number, late: number): FinanceAgingBuckets => ({
  ok: { count: ok > 0 ? 1 : 0, total: ok },
  warn: { count: warn > 0 ? 1 : 0, total: warn },
  late: { count: late > 0 ? 1 : 0, total: late },
})

describe('financeCardBarSegments', () => {
  it('sizes segments as percentages of the card total, in ok→warn→late order', () => {
    const segs = financeCardBarSegments(buckets(50, 25, 25), 200)
    expect(segs).toEqual([
      { tone: 'ok', pct: 25 },
      { tone: 'warn', pct: 12.5 },
      { tone: 'late', pct: 12.5 },
    ])
  })

  it('skips empty bands — fresh/undated money is the uncolored remainder', () => {
    const segs = financeCardBarSegments(buckets(0, 0, 80), 100)
    expect(segs).toEqual([{ tone: 'late', pct: 80 }])
  })

  it('clamps a band to 100% and returns nothing for a zero or negative total', () => {
    expect(financeCardBarSegments(buckets(0, 0, 500), 100)[0]?.pct).toBe(100)
    expect(financeCardBarSegments(buckets(10, 0, 0), 0)).toEqual([])
    expect(financeCardBarSegments(buckets(10, 0, 0), -5)).toEqual([])
  })
})

describe('financeCardRisk', () => {
  it('leads with 30d+ money when present', () => {
    expect(financeCardRisk(buckets(50, 30, 20))).toEqual({ tone: 'late', amount: 20 })
  })

  it('falls back to 15–30d money when nothing is past 30', () => {
    expect(financeCardRisk(buckets(50, 30, 0))).toEqual({ tone: 'warn', amount: 30 })
  })

  it('reports none when no money is aged past 15 days', () => {
    expect(financeCardRisk(buckets(50, 0, 0))).toEqual({ tone: 'none' })
    expect(financeCardRisk(buckets(0, 0, 0))).toEqual({ tone: 'none' })
  })
})
