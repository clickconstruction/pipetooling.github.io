import { describe, expect, it } from 'vitest'
import { drivingSummaryFromInputs, laborTotalFromInputs, travelSummaryFromInputs } from './laborTabCostSummaries'

describe('drivingSummaryFromInputs', () => {
  it('trips = hours ÷ hours per trip; cost = trips × rate × distance', () => {
    const s = drivingSummaryFromInputs({ distanceFromOffice: '46', totalHours: 40, drivingCostRate: '0.70', hoursPerTrip: '8' })
    expect(s.numTrips).toBe(5)
    expect(s.drivingCost).toBeCloseTo(5 * 0.7 * 46, 6)
    expect(s.distance).toBe(46)
  })

  it('an empty, unparseable or zero rate box reads the 0.70 default; hours per trip defaults to 2.0 (the string quirk, map quirk 7)', () => {
    expect(drivingSummaryFromInputs({ distanceFromOffice: '10', totalHours: 4, drivingCostRate: '', hoursPerTrip: '' })).toMatchObject({ ratePerMile: 0.7, hoursPerTrip: 2, numTrips: 2, drivingCost: 14 })
    expect(drivingSummaryFromInputs({ distanceFromOffice: '10', totalHours: 4, drivingCostRate: '0', hoursPerTrip: 'abc' }).ratePerMile).toBe(0.7)
    expect(drivingSummaryFromInputs({ distanceFromOffice: '10', totalHours: 4, drivingCostRate: '0', hoursPerTrip: 'abc' }).hoursPerTrip).toBe(2)
  })

  it('no distance on the bid means no driving cost, and no hours means no trips', () => {
    expect(drivingSummaryFromInputs({ distanceFromOffice: null, totalHours: 40, drivingCostRate: '1', hoursPerTrip: '2' })).toMatchObject({ distance: 0, drivingCost: 0 })
    expect(drivingSummaryFromInputs({ distanceFromOffice: 46.5, totalHours: 0, drivingCostRate: '1', hoursPerTrip: '2' })).toMatchObject({ distance: 46.5, numTrips: 0, drivingCost: 0 })
  })
})

describe('travelSummaryFromInputs', () => {
  it('people × nights × (meals + hotel), with the two halves kept apart for the expanded lines', () => {
    const s = travelSummaryFromInputs({ travelPeople: '3', travelNights: '4', travelMealsRate: '59', travelHotelRate: '110' })
    expect(s).toMatchObject({ people: 3, nights: 4, mealsRate: 59, hotelRate: 110, mealsCost: 708, hotelCost: 1320, travelCost: 2028 })
  })

  it('people and nights are rounded to whole numbers and floored at zero; rates default to 0', () => {
    expect(travelSummaryFromInputs({ travelPeople: '2.6', travelNights: '-1', travelMealsRate: '', travelHotelRate: 'x' })).toMatchObject({ people: 3, nights: 0, mealsRate: 0, hotelRate: 0, travelCost: 0 })
    expect(travelSummaryFromInputs({ travelPeople: '2.4', travelNights: '1.5', travelMealsRate: '10', travelHotelRate: '0' })).toMatchObject({ people: 2, nights: 2, mealsCost: 40, hotelCost: 0, travelCost: 40 })
  })
})

describe('laborTotalFromInputs', () => {
  it('is the rows\u2019 hours added up, times the rate box', () => {
    expect(laborTotalFromInputs({ rowHours: [8, 12.5, 3.25], laborRateInput: '42.50' })).toEqual({ totalHours: 23.75, rate: 42.5, laborCost: 1009.375 })
  })

  it('reads an empty, blank or unparseable rate as 0 — the line shows what is typed', () => {
    for (const laborRateInput of ['', '   ', 'abc']) {
      expect(laborTotalFromInputs({ rowHours: [10], laborRateInput })).toEqual({ totalHours: 10, rate: 0, laborCost: 0 })
    }
  })

  it('reads the leading number of a rate with text after it, as the box does', () => {
    expect(laborTotalFromInputs({ rowHours: [2], laborRateInput: '40/hr' }).rate).toBe(40)
  })

  it('a sub line or an empty row adds 0 hours; no rows is 0', () => {
    expect(laborTotalFromInputs({ rowHours: [0, 6, 0], laborRateInput: '50' })).toEqual({ totalHours: 6, rate: 50, laborCost: 300 })
    expect(laborTotalFromInputs({ rowHours: [], laborRateInput: '50' })).toEqual({ totalHours: 0, rate: 50, laborCost: 0 })
  })
})
