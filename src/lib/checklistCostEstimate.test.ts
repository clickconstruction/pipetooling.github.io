import { describe, expect, it } from 'vitest'
import {
  estimateDollars,
  formatOpenCostSummary,
  formatWholeDollars,
  sumEstimateDollars,
  summarizeOpenTaskCosts,
} from './checklistCostEstimate'

describe('estimateDollars', () => {
  it('rounds hours × rate to whole dollars', () => {
    expect(estimateDollars({ hours: 2, rate: 50 })).toBe(100)
    expect(estimateDollars({ hours: 0.5, rate: 35 })).toBe(18) // 17.5 rounds up
    expect(estimateDollars({ hours: 1.5, rate: 33 })).toBe(50) // 49.5 rounds up
  })

  it('non-finite inputs cost zero', () => {
    expect(estimateDollars({ hours: Number.NaN, rate: 50 })).toBe(0)
    expect(estimateDollars({ hours: 2, rate: Number.POSITIVE_INFINITY })).toBe(0)
  })
})

describe('formatWholeDollars', () => {
  it('formats with thousands separators, no cents', () => {
    expect(formatWholeDollars(210)).toBe('$210')
    expect(formatWholeDollars(1234.6)).toBe('$1,235')
  })
})

describe('sumEstimateDollars', () => {
  it('sums entries and skips undefined slots', () => {
    expect(sumEstimateDollars([{ hours: 2, rate: 50 }, undefined, { hours: 1, rate: 40 }])).toBe(140)
    expect(sumEstimateDollars([])).toBe(0)
  })
})

describe('summarizeOpenTaskCosts', () => {
  const estimates = {
    a: { hours: 2, rate: 50 },
    b: { hours: 4, rate: 50 },
    unrelated: { hours: 100, rate: 100 },
  }

  it('sums only the keys that have estimates and counts costed vs total', () => {
    expect(summarizeOpenTaskCosts(['a', 'b', 'c', 'd'], estimates)).toEqual({ dollars: 300, costed: 2, total: 4 })
  })

  it('empty key list is an empty summary', () => {
    expect(summarizeOpenTaskCosts([], estimates)).toEqual({ dollars: 0, costed: 0, total: 0 })
  })
})

describe('formatOpenCostSummary', () => {
  it('marks a partially costed sum as a floor with a trailing +', () => {
    expect(formatOpenCostSummary({ dollars: 300, costed: 2, total: 4 })).toBe('$300+')
    expect(formatOpenCostSummary({ dollars: 300, costed: 4, total: 4 })).toBe('$300')
  })
})

describe('canSeeTaskCosts', () => {
  it('allows exactly dev and controller', async () => {
    const { canSeeTaskCosts } = await import('./checklistCostEstimate')
    expect(canSeeTaskCosts('dev')).toBe(true)
    expect(canSeeTaskCosts('controller')).toBe(true)
    for (const r of ['master_technician', 'assistant', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent', null, undefined]) {
      expect(canSeeTaskCosts(r)).toBe(false)
    }
  })
})
