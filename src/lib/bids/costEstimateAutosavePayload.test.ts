import { describe, expect, it } from 'vitest'
import { buildCostEstimateAutosavePayload, laborRowAutosaveUpdate, stageAmountRowAutosaveUpdate, type CostEstimateAutosaveInputs } from './costEstimateAutosavePayload'
import type { CostEstimateLaborRow } from './bidPricingEngineTypes'

const blankBoxes: CostEstimateAutosaveInputs = {
  laborRateInput: '',
  drivingCostRate: '',
  hoursPerTrip: '',
  estimatorCostUseFlat: false,
  estimatorCostPerCount: '',
  estimatorCostFlatAmount: '',
  travelPeople: '',
  travelNights: '',
  travelMealsRate: '',
  travelHotelRate: '',
}

describe('buildCostEstimateAutosavePayload', () => {
  it('blank boxes save the tab defaults: no rate, $0.70/mi, 2 h per trip, $10 per count, 1 person, 1 night, no travel rates', () => {
    const r = buildCostEstimateAutosavePayload(blankBoxes)
    expect(r).toEqual({ ok: true, values: { labor_rate: null, driving_cost_rate: 0.7, hours_per_trip: 2, estimator_cost_per_count: 10, estimator_cost_flat_amount: null, travel_people: 1, travel_nights: 1, travel_meals_rate: null, travel_hotel_rate: null } })
  })
  it('typed boxes save as typed; people and nights round; flat mode nulls the per-count', () => {
    const r = buildCostEstimateAutosavePayload({ ...blankBoxes, laborRateInput: ' 35.76 ', drivingCostRate: '0.655', hoursPerTrip: '8', estimatorCostUseFlat: true, estimatorCostFlatAmount: '500', travelPeople: '2.4', travelNights: '2.6', travelMealsRate: '60', travelHotelRate: '140' })
    expect(r).toEqual({ ok: true, values: { labor_rate: 35.76, driving_cost_rate: 0.655, hours_per_trip: 8, estimator_cost_per_count: null, estimator_cost_flat_amount: 500, travel_people: 2, travel_nights: 3, travel_meals_rate: 60, travel_hotel_rate: 140 } })
  })
  it('says which box is wrong instead of silently not saving', () => {
    expect(buildCostEstimateAutosavePayload({ ...blankBoxes, laborRateInput: '-1' })).toEqual({ ok: false, reason: 'the labor rate must be a number, 0 or more' })
    expect(buildCostEstimateAutosavePayload({ ...blankBoxes, laborRateInput: 'abc' })).toMatchObject({ ok: false })
    expect(buildCostEstimateAutosavePayload({ ...blankBoxes, hoursPerTrip: '0' })).toEqual({ ok: false, reason: 'hours per trip must be more than 0' })
    expect(buildCostEstimateAutosavePayload({ ...blankBoxes, travelPeople: '0' })).toEqual({ ok: false, reason: 'travel people must be 1 or more' })
    expect(buildCostEstimateAutosavePayload({ ...blankBoxes, travelNights: '-2' })).toEqual({ ok: false, reason: 'travel nights must be 0 or more' })
    expect(buildCostEstimateAutosavePayload({ ...blankBoxes, travelHotelRate: '-9' })).toEqual({ ok: false, reason: 'the hotel rate must be 0 or more' })
    expect(buildCostEstimateAutosavePayload({ ...blankBoxes, estimatorCostUseFlat: true, estimatorCostFlatAmount: '-1' })).toEqual({ ok: false, reason: 'the flat estimator cost must be 0 or more' })
  })
  it('a blank flat amount in flat mode saves null (falls back to the per-count default at read time)', () => {
    const r = buildCostEstimateAutosavePayload({ ...blankBoxes, estimatorCostUseFlat: true })
    expect(r).toMatchObject({ ok: true, values: { estimator_cost_per_count: null, estimator_cost_flat_amount: null } })
  })
})

describe('row payloads', () => {
  it('a labor row sends its hours, count, is_fixed and kind — never unit, source or note (those are the New view\'s to write)', () => {
    const row = { id: 'r', rough_in_hrs_per_unit: 1, top_out_hrs_per_unit: 2, trim_set_hrs_per_unit: 3, count: 4, is_fixed: null, kind: null, unit: 'per_100ft', source: 'book' } as unknown as CostEstimateLaborRow
    expect(laborRowAutosaveUpdate(row)).toEqual({ rough_in_hrs_per_unit: 1, top_out_hrs_per_unit: 2, trim_set_hrs_per_unit: 3, count: 4, is_fixed: false, kind: 'fixture' })
  })
  it('a direct-cost row sends note, the three amounts as numbers (blank → 0) and its order', () => {
    expect(stageAmountRowAutosaveUpdate({ note: 'permit', rough_in: '1240', top_out: '', trim_set: null, sequence_order: 2 })).toEqual({ note: 'permit', rough_in: 1240, top_out: 0, trim_set: 0, sequence_order: 2 })
  })
})
