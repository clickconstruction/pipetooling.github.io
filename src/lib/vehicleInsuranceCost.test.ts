import { describe, expect, it } from 'vitest'
import {
  effectiveWeeklyInsuranceCost,
  formatInsuranceCostLine,
  insuranceCostViews,
  insurancePlanTotals,
  weeklyInsuranceCostFromInput,
} from './vehicleInsuranceCost'

describe('vehicleInsuranceCost', () => {
  it('converts typed amounts to weekly cents', () => {
    expect(weeklyInsuranceCostFromInput('52', 'wk')).toBe(52)
    expect(weeklyInsuranceCostFromInput('$225', 'mo')).toBe(51.92)
    expect(weeklyInsuranceCostFromInput('2,704', 'yr')).toBe(52)
    expect(weeklyInsuranceCostFromInput('', 'mo')).toBeNull()
    expect(weeklyInsuranceCostFromInput('-5', 'wk')).toBeNull()
    expect(weeklyInsuranceCostFromInput('abc', 'wk')).toBeNull()
  })
  it('shows all three views and formats the line', () => {
    expect(insuranceCostViews(52)).toEqual({ wk: 52, mo: 225.33333333333334, yr: 2704 })
    expect(formatInsuranceCostLine(52)).toBe('$52.00/wk · ≈ $225/mo · $2,704/yr')
    expect(formatInsuranceCostLine(0)).toBe('$0.00/wk · ≈ $0/mo · $0/yr')
  })
  it('effective cost is $0 while off a plan, the stored cost while on one', () => {
    expect(effectiveWeeklyInsuranceCost(52, true)).toBe(52)
    expect(effectiveWeeklyInsuranceCost(52, false)).toBe(0)
    expect(effectiveWeeklyInsuranceCost(null, true)).toBe(0)
  })
  it('plan totals count priced vs unpriced vehicles', () => {
    expect(insurancePlanTotals([52, 48, 61.5, 0, null])).toEqual({ weekly: 161.5, priced: 3, unpriced: 2 })
    expect(insurancePlanTotals([])).toEqual({ weekly: 0, priced: 0, unpriced: 0 })
  })
})
