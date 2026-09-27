import { describe, expect, it } from 'vitest'
import { subLaborSummary } from './subLaborSummary'
import { laborJobSubCost } from './subLaborCost'

describe('subLaborSummary', () => {
  it('is null until the inputs load, and zero for a job with no sheets', () => {
    expect(subLaborSummary(null)).toBeNull()
    expect(subLaborSummary(undefined)).toBeNull()
    expect(subLaborSummary({ laborJobs: [], mileageCost: 0.7, timePerMile: 0.02 })).toEqual({ count: 0, total: 0 })
  })

  it('counts the sheets and sums each one through the shared cost kernel — lines plus drive', () => {
    const a = { labor_rate: 50, distance_miles: 10, items: [{ count: 2, hrs_per_unit: 3, is_fixed: false, labor_rate: null, direct_labor_amount: null }] }
    const b = { labor_rate: null, distance_miles: 4, items: [] }
    const data = { laborJobs: [a, b], mileageCost: 0.7, timePerMile: 0.02 }
    const out = subLaborSummary(data)
    expect(out?.count).toBe(2)
    expect(out?.total).toBeCloseTo(laborJobSubCost(a, 0.7, 0.02) + laborJobSubCost(b, 0.7, 0.02), 6)
    // The formula the form used to carry by hand: 2 × 3 h × $50 = $300 of lines, then 10 mi × $0.70 + 10 mi × 0.02 h/mi × $50 = $17 of drive; a rate-less sheet drives at mileage only.
    expect(laborJobSubCost(a, 0.7, 0.02)).toBeCloseTo(317, 6)
    expect(laborJobSubCost(b, 0.7, 0.02)).toBeCloseTo(2.8, 6)
  })
})
