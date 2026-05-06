import { describe, expect, it } from 'vitest'
import { unitPriceFromTargetPctOfTotal } from './unitPriceFromTargetPctOfTotal'

describe('unitPriceFromTargetPctOfTotal', () => {
  it('non-fixed: T=1000 pct=25 count=4 → revenue 250 unit 62.5', () => {
    expect(
      unitPriceFromTargetPctOfTotal({
        totalRevenue: 1000,
        targetPct: 25,
        count: 4,
        isFixed: false,
      }),
    ).toEqual({ rowRevenue: 250, unitPrice: 62.5 })
  })

  it('fixed: unit equals row revenue', () => {
    expect(
      unitPriceFromTargetPctOfTotal({
        totalRevenue: 800,
        targetPct: 50,
        count: 99,
        isFixed: true,
      }),
    ).toEqual({ rowRevenue: 400, unitPrice: 400 })
  })

  it('returns null when totalRevenue <= 0', () => {
    expect(
      unitPriceFromTargetPctOfTotal({
        totalRevenue: 0,
        targetPct: 10,
        count: 1,
        isFixed: false,
      }),
    ).toBeNull()
  })

  it('returns null when targetPct <= 0 or above max', () => {
    expect(
      unitPriceFromTargetPctOfTotal({
        totalRevenue: 100,
        targetPct: 0,
        count: 1,
        isFixed: false,
      }),
    ).toBeNull()
    expect(
      unitPriceFromTargetPctOfTotal({
        totalRevenue: 100,
        targetPct: 1001,
        count: 1,
        isFixed: false,
      }),
    ).toBeNull()
  })

  it('returns null when non-fixed count <= 0', () => {
    expect(
      unitPriceFromTargetPctOfTotal({
        totalRevenue: 100,
        targetPct: 10,
        count: 0,
        isFixed: false,
      }),
    ).toBeNull()
  })
})
