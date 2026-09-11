import { describe, expect, it } from 'vitest'
import { computeBidCostBreakdown, directCostRowsFromTables } from './bidTotalCostBreakdown'

const laborRows = [
  { count: 10, is_fixed: false, rough_in_hrs_per_unit: 1, top_out_hrs_per_unit: 1, trim_set_hrs_per_unit: 1 }, // 30 h
  { count: 729.5, is_fixed: false, unit: 'per_100ft', rough_in_hrs_per_unit: 4, top_out_hrs_per_unit: 0, trim_set_hrs_per_unit: 0 }, // 29.18 h
  { count: 3, is_fixed: false, kind: 'sub', rough_in_hrs_per_unit: 5, top_out_hrs_per_unit: 5, trim_set_hrs_per_unit: 5 }, // 0 h
  { count: 1, is_fixed: true, rough_in_hrs_per_unit: 6, top_out_hrs_per_unit: 0, trim_set_hrs_per_unit: 0 }, // 6 h
]
const est = { driving_cost_rate: 0.7, hours_per_trip: 8, estimator_cost_flat_amount: 500, travel_people: 2, travel_nights: 3, travel_meals_rate: 60, travel_hotel_rate: 140 }

describe('computeBidCostBreakdown', () => {
  it('adds materials, labor at the rate, driving, estimator, travel, team labor and the five direct-cost kinds into one total', () => {
    const b = computeBidCostBreakdown({
      materialTotalRoughIn: 40_000,
      materialTotalTopOut: 15_000,
      materialTotalTrimSet: 6_300,
      laborRate: 35.76,
      laborRows,
      distanceFromOffice: '41',
      costEstimate: est,
      countRowsLength: 4,
      directCostRows: directCostRowsFromTables({
        sub: [{ rough_in: 6_500 }],
        permit: [{ rough_in: 1_240 }],
        equipment: [{ rough_in: 1_900, top_out: null, trim_set: -5 }],
      }),
      teamLaborCost: 446,
    })
    expect(b.totalMaterials).toBe(61_300)
    expect(b.totalLaborHours).toBeCloseTo(65.18, 2)
    expect(b.laborCost).toBeCloseTo(65.18 * 35.76, 2)
    expect(b.numTrips).toBeCloseTo(65.18 / 8, 4)
    expect(b.drivingCost).toBeCloseTo((65.18 / 8) * 0.7 * 41, 2)
    expect(b.estimatorCost).toBe(500)
    expect(b.travelCost).toBe(2 * 3 * 200)
    expect(b.teamLaborCost).toBe(446)
    expect(b.subcontractorCost).toBe(6_500)
    expect(b.permitCost).toBe(1_240)
    expect(b.equipmentRentalCost).toBe(1_900)
    expect(b.otherDirectCost).toBe(9_640)
    expect(b.laborCostWithDriving).toBeCloseTo(b.laborCost + b.drivingCost + 500 + 1_200, 6)
    expect(b.directCost).toBeCloseTo(b.laborCostWithDriving + 446 + 9_640, 6)
    expect(b.totalCost).toBeCloseTo(61_300 + b.directCost, 6)
  })
  it('reads the lib defaults off a bare cost estimate: $0.70/mi, 2 h per trip, $10 per count, no travel', () => {
    const b = computeBidCostBreakdown({ materialTotalRoughIn: null, materialTotalTopOut: null, materialTotalTrimSet: null, laborRate: null, laborRows: [laborRows[0]!], distanceFromOffice: 10, costEstimate: {}, countRowsLength: 3 })
    expect(b.rate).toBe(0)
    expect(b.ratePerMile).toBe(0.7)
    expect(b.hrsPerTrip).toBe(2)
    expect(b.numTrips).toBe(15)
    expect(b.drivingCost).toBeCloseTo(15 * 0.7 * 10, 6)
    expect(b.estimatorCost).toBe(30)
    expect(b.travelCost).toBe(0)
    expect(b.otherDirectCost).toBe(0)
    expect(b.totalCost).toBeCloseTo(105 + 30, 6)
  })
  it('honors the string-box overrides the Labor print passes, and ignores a zero hours-per-trip', () => {
    const b = computeBidCostBreakdown({ materialTotalRoughIn: 0, materialTotalTopOut: 0, materialTotalTrimSet: 0, laborRate: 10, laborRows: [laborRows[0]!], distanceFromOffice: '5', costEstimate: {}, countRowsLength: 0, ratePerMileOverride: 1, hoursPerTripOverride: 0 })
    expect(b.ratePerMile).toBe(1)
    expect(b.hrsPerTrip).toBe(2)
    expect(b.drivingCost).toBeCloseTo(15 * 1 * 5, 6)
  })
  it('skips direct-cost rows of a kind it does not know', () => {
    const b = computeBidCostBreakdown({ materialTotalRoughIn: 0, materialTotalTopOut: 0, materialTotalTrimSet: 0, laborRate: 0, laborRows: [], distanceFromOffice: null, costEstimate: {}, countRowsLength: 0, directCostRows: [{ kind: 'driving', rough_in: 100 }, { kind: 'waste', top_out: 40 }] })
    expect(b.otherDirectCost).toBe(40)
    expect(b.totalCost).toBe(40)
  })
})

describe('directCostRowsFromTables', () => {
  it('tags each table\'s rows with its kind, in the five-kind order, skipping missing tables', () => {
    const rows = directCostRowsFromTables({ other: [{ rough_in: 1 }], equipment: [{ rough_in: 2 }, { rough_in: 3 }], waste: null })
    expect(rows.map((r) => [r.kind, r.rough_in])).toEqual([['equipment', 2], ['equipment', 3], ['other', 1]])
  })
})
