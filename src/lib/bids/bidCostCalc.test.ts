import { describe, expect, it } from 'vitest'
import {
  computeTravelCost,
  costEstimateDrivingRate,
  costEstimateHoursPerTrip,
  costEstimateEstimatorCost,
  sumEquipmentRows,
} from './bidCostCalc'

describe('computeTravelCost', () => {
  it('defaults to 1 person, 1 night, $0 rates -> 0', () => {
    expect(computeTravelCost(null)).toBe(0)
    expect(computeTravelCost(undefined)).toBe(0)
    expect(computeTravelCost({})).toBe(0)
  })

  it('applies people x nights x (meals + hotel)', () => {
    expect(
      computeTravelCost({ travel_people: 2, travel_nights: 3, travel_meals_rate: 50, travel_hotel_rate: 100 })
    ).toBe(900)
  })

  it('uses default people/nights of 1 when only rates are provided', () => {
    expect(computeTravelCost({ travel_meals_rate: 40, travel_hotel_rate: 110 })).toBe(150)
  })

  it('coerces string inputs', () => {
    expect(
      computeTravelCost({ travel_people: '2', travel_nights: '2', travel_meals_rate: '25', travel_hotel_rate: '75' })
    ).toBe(400)
  })

  it('returns 0 when any value is non-finite', () => {
    expect(computeTravelCost({ travel_meals_rate: 'abc', travel_hotel_rate: 100 })).toBe(0)
    expect(computeTravelCost({ travel_people: NaN })).toBe(0)
  })
})

describe('costEstimateDrivingRate', () => {
  it('defaults to 0.70 when absent', () => {
    expect(costEstimateDrivingRate(null)).toBe(0.7)
    expect(costEstimateDrivingRate(undefined)).toBe(0.7)
    expect(costEstimateDrivingRate({})).toBe(0.7)
  })

  it('uses the stored value, including an explicit 0', () => {
    expect(costEstimateDrivingRate({ driving_cost_rate: 0.55 })).toBe(0.55)
    expect(costEstimateDrivingRate({ driving_cost_rate: 0 })).toBe(0)
  })

  it('coerces string values', () => {
    expect(costEstimateDrivingRate({ driving_cost_rate: '0.85' })).toBe(0.85)
  })
})

describe('costEstimateHoursPerTrip', () => {
  it('defaults to 2.0 when absent', () => {
    expect(costEstimateHoursPerTrip(null)).toBe(2)
    expect(costEstimateHoursPerTrip({})).toBe(2)
  })

  it('uses the stored value, including an explicit 0', () => {
    expect(costEstimateHoursPerTrip({ hours_per_trip: 3.5 })).toBe(3.5)
    expect(costEstimateHoursPerTrip({ hours_per_trip: 0 })).toBe(0)
  })

  it('coerces string values', () => {
    expect(costEstimateHoursPerTrip({ hours_per_trip: '1.5' })).toBe(1.5)
  })
})

describe('costEstimateEstimatorCost', () => {
  it('returns the flat amount when present, including 0', () => {
    expect(costEstimateEstimatorCost({ estimator_cost_flat_amount: 9000 }, 5)).toBe(9000)
    expect(costEstimateEstimatorCost({ estimator_cost_flat_amount: 0 }, 5)).toBe(0)
  })

  it('falls back to countLen * per-count when flat is absent', () => {
    expect(costEstimateEstimatorCost({ estimator_cost_per_count: 25 }, 4)).toBe(100)
  })

  it('uses a per-count default of 10 when per-count is missing, 0, or non-numeric', () => {
    expect(costEstimateEstimatorCost({}, 3)).toBe(30)
    expect(costEstimateEstimatorCost({ estimator_cost_per_count: 0 }, 3)).toBe(30)
    expect(costEstimateEstimatorCost({ estimator_cost_per_count: 'abc' }, 3)).toBe(30)
    expect(costEstimateEstimatorCost(null, 3)).toBe(30)
  })

  it('coerces a string flat amount', () => {
    expect(costEstimateEstimatorCost({ estimator_cost_flat_amount: '1200' }, 5)).toBe(1200)
  })
})

describe('sumEquipmentRows', () => {
  it('sums per-stage amounts across all rows', () => {
    expect(
      sumEquipmentRows([
        { rough_in: 100, top_out: 50, trim_set: 25 },
        { rough_in: 10, top_out: 0, trim_set: 5 },
      ]),
    ).toBe(190)
  })

  it('returns 0 for empty / null / undefined', () => {
    expect(sumEquipmentRows([])).toBe(0)
    expect(sumEquipmentRows(null)).toBe(0)
    expect(sumEquipmentRows(undefined)).toBe(0)
  })

  it('treats null/blank/negative/NaN stage values as 0', () => {
    expect(
      sumEquipmentRows([{ rough_in: 200, top_out: null, trim_set: -10 }, { rough_in: 'abc' }]),
    ).toBe(200)
  })

  it('coerces numeric strings', () => {
    expect(sumEquipmentRows([{ top_out: '300', trim_set: '0' }])).toBe(300)
  })
})
