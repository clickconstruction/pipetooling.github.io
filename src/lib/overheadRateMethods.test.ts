import { describe, expect, it } from 'vitest'
import { computeOverheadRateMethods } from './overheadRateMethods'

describe('computeOverheadRateMethods', () => {
  it('computes all three rates from one pool', () => {
    const r = computeOverheadRateMethods({
      overheadPoolUsd: 8200,
      fieldHours: 500,
      invoicedRevenueUsd: 69491.52,
      fieldLaborUsd: 13225.8,
    })
    expect(r.methodA).toBeCloseTo(16.4, 10)
    expect(r.methodB).toBeCloseTo(0.118, 3)
    expect(r.methodC).toBeCloseTo(0.62, 3)
  })

  it('nulls Method A when field hours are zero', () => {
    const r = computeOverheadRateMethods({
      overheadPoolUsd: 100,
      fieldHours: 0,
      invoicedRevenueUsd: 1000,
      fieldLaborUsd: 500,
    })
    expect(r.methodA).toBe(null)
    expect(r.methodB).toBe(0.1)
    expect(r.methodC).toBe(0.2)
  })

  it('nulls Method B when revenue is zero or negative', () => {
    expect(
      computeOverheadRateMethods({ overheadPoolUsd: 100, fieldHours: 10, invoicedRevenueUsd: 0, fieldLaborUsd: 500 })
        .methodB,
    ).toBe(null)
    expect(
      computeOverheadRateMethods({ overheadPoolUsd: 100, fieldHours: 10, invoicedRevenueUsd: -5, fieldLaborUsd: 500 })
        .methodB,
    ).toBe(null)
  })

  it('nulls Method C when field labor $ is zero', () => {
    const r = computeOverheadRateMethods({
      overheadPoolUsd: 100,
      fieldHours: 10,
      invoicedRevenueUsd: 1000,
      fieldLaborUsd: 0,
    })
    expect(r.methodC).toBe(null)
    expect(r.methodA).toBe(10)
  })

  it('nulls per-method on non-finite denominators', () => {
    const r = computeOverheadRateMethods({
      overheadPoolUsd: 100,
      fieldHours: Number.NaN,
      invoicedRevenueUsd: Number.POSITIVE_INFINITY,
      fieldLaborUsd: 50,
    })
    expect(r.methodA).toBe(null)
    expect(r.methodB).toBe(null)
    expect(r.methodC).toBe(2)
  })

  it('nulls everything when the pool is not finite', () => {
    const r = computeOverheadRateMethods({
      overheadPoolUsd: Number.NaN,
      fieldHours: 10,
      invoicedRevenueUsd: 1000,
      fieldLaborUsd: 500,
    })
    expect(r).toEqual({ methodA: null, methodB: null, methodC: null })
  })

  it('allows a $0 pool (rates are 0, not null)', () => {
    const r = computeOverheadRateMethods({
      overheadPoolUsd: 0,
      fieldHours: 10,
      invoicedRevenueUsd: 1000,
      fieldLaborUsd: 500,
    })
    expect(r).toEqual({ methodA: 0, methodB: 0, methodC: 0 })
  })

  /**
   * Agreement with the Review tab's previous inline math (pre-kernel):
   *   ratePerHour            = fieldHours   > 0 ? overheadTotal / fieldHours   : null
   *   ratePerRevenueDecimal  = revenueTotal > 0 ? overheadTotal / revenueTotal : null
   *   ratePerLaborDollar     = fieldLaborUsd> 0 ? overheadTotal / fieldLaborUsd: null
   */
  it('reproduces the Review tab inline formulas exactly', () => {
    const cases = [
      { overheadTotal: 12345.67, fieldHours: 812.25, revenueTotal: 250000, fieldLaborUsd: 30000 },
      { overheadTotal: 999.99, fieldHours: 0, revenueTotal: 0, fieldLaborUsd: 0 },
      { overheadTotal: 0.01, fieldHours: 1e-9, revenueTotal: 123, fieldLaborUsd: 0.5 },
    ]
    for (const c of cases) {
      const inlineA = c.fieldHours > 0 ? c.overheadTotal / c.fieldHours : null
      const inlineB = c.revenueTotal > 0 ? c.overheadTotal / c.revenueTotal : null
      const inlineC = c.fieldLaborUsd > 0 ? c.overheadTotal / c.fieldLaborUsd : null
      const r = computeOverheadRateMethods({
        overheadPoolUsd: c.overheadTotal,
        fieldHours: c.fieldHours,
        invoicedRevenueUsd: c.revenueTotal,
        fieldLaborUsd: c.fieldLaborUsd,
      })
      expect(r.methodA).toBe(inlineA)
      expect(r.methodB).toBe(inlineB)
      expect(r.methodC).toBe(inlineC)
    }
  })
})
