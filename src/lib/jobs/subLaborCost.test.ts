import { describe, expect, it } from 'vitest'
import { laborJobSubCost } from './subLaborCost'

describe('laborJobSubCost', () => {
  it('returns 0 with no items and no distance', () => {
    expect(laborJobSubCost({ labor_rate: 50 }, 0.5, 0.02)).toBe(0)
  })

  it('sums line costs using per-item rate', () => {
    expect(
      laborJobSubCost({ labor_rate: 50, items: [{ count: 2, hrs_per_unit: 1, labor_rate: 50 }] }, 0.5, 0.02),
    ).toBe(100)
  })

  it('adds mileage and drive-time cost when rate is positive', () => {
    // lineTotal 100 (direct) + 10*0.5 mileage + 10*0.02*50 drive-time = 100 + 5 + 10
    expect(
      laborJobSubCost(
        { labor_rate: 50, distance_miles: 10, items: [{ direct_labor_amount: 100 }] },
        0.5,
        0.02,
      ),
    ).toBe(115)
  })

  it('charges mileage only (no drive-time) when rate is zero', () => {
    expect(laborJobSubCost({ labor_rate: 0, distance_miles: 10 }, 0.5, 0.02)).toBe(5)
  })

  it('treats null/invalid distance as zero', () => {
    expect(laborJobSubCost({ labor_rate: 50, distance_miles: null, items: [{ direct_labor_amount: 80 }] }, 0.5, 0.02)).toBe(80)
  })
})
