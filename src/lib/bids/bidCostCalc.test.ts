import { describe, expect, it } from 'vitest'
import { computeTravelCost } from './bidCostCalc'

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
