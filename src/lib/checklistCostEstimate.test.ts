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

describe('actuals', () => {
  it('actualDollars: null without a positive actual, whole dollars with one', async () => {
    const { actualDollars } = await import('./checklistCostEstimate')
    expect(actualDollars({ rate: 50, actualHours: null })).toBe(null)
    expect(actualDollars({ rate: 50 })).toBe(null)
    expect(actualDollars({ rate: 50, actualHours: 4 })).toBe(200)
    expect(actualDollars({ rate: 33, actualHours: 1.5 })).toBe(50)
  })

  it('estimateRelativeBands scales with the estimate and snaps to halves', async () => {
    const { estimateRelativeBands } = await import('./checklistCostEstimate')
    expect(estimateRelativeBands(2)).toEqual([1, 2, 3, 4])
    expect(estimateRelativeBands(16)).toEqual([8, 16, 24, 32])
    expect(estimateRelativeBands(1)).toEqual([0.5, 1, 1.5, 2])
    expect(estimateRelativeBands(0.5)).toEqual([0.5, 1])
    expect(estimateRelativeBands(0)).toEqual([0.5, 1, 2, 4])
  })

  it('estimateAccuracy is hours-weighted and null with no actuals', async () => {
    const { estimateAccuracy } = await import('./checklistCostEstimate')
    expect(estimateAccuracy([{ hours: 2, actualHours: null }])).toBe(null)
    const a = estimateAccuracy([
      { hours: 2, actualHours: 4 },
      { hours: 8, actualHours: 8 },
      { hours: 1, actualHours: null },
    ])
    expect(a?.count).toBe(2)
    expect(a?.multiplier).toBeCloseTo(12 / 10)
  })

  it('estimateAccuracyByPerson groups and sorts by count', async () => {
    const { estimateAccuracyByPerson } = await import('./checklistCostEstimate')
    const rows = [
      { hours: 2, actualHours: 4, personName: 'Malachi' },
      { hours: 2, actualHours: 3, personName: 'Malachi' },
      { hours: 4, actualHours: 4, personName: 'Darren' },
      { hours: 1, actualHours: null, personName: 'Darren' },
    ]
    const out = estimateAccuracyByPerson(rows)
    expect(out.map((o) => o.personName)).toEqual(['Malachi', 'Darren'])
    expect(out[0]?.multiplier).toBeCloseTo(7 / 4)
    expect(out[1]?.multiplier).toBe(1)
  })

  it('formatMultiplier keeps one decimal', async () => {
    const { formatMultiplier } = await import('./checklistCostEstimate')
    expect(formatMultiplier(1.62)).toBe('×1.6')
    expect(formatMultiplier(1)).toBe('×1.0')
  })
})
