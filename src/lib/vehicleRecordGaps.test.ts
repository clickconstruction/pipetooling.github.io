import { describe, expect, it } from 'vitest'
import type { FleetInsurancePeriod, FleetPossession } from './vehicleFleet'
import { vehicleRecordGapWords, vehicleRecordGaps, type VehicleRecordVehicle } from './vehicleRecordGaps'

const TODAY = '2026-10-06'

function vehicle(id: string, over: Partial<VehicleRecordVehicle> = {}): VehicleRecordVehicle {
  return { id, year: 2019, make: 'Ford', model: `F-150 ${id}`, weekly_insurance_cost: 48, weekly_registration_cost: 6, ...over }
}
function held(vehicleId: string, userId: string | null, start = '2026-01-01', end: string | null = null): FleetPossession {
  return { id: `p-${vehicleId}-${start}`, vehicle_id: vehicleId, user_id: userId, start_date: start, end_date: end, created_at: null }
}
function onPlan(vehicleId: string, start = '2026-01-01', end: string | null = null): FleetInsurancePeriod {
  return { id: `i-${vehicleId}-${start}`, vehicle_id: vehicleId, plan_id: 'plan-1', start_date: start, end_date: end, created_at: null }
}

describe('vehicleRecordGaps', () => {
  const names = new Map([
    ['u-mal', 'Sam P.'],
    ['u-mic', 'Lee'],
  ])

  it('lists an active vehicle missing all three, with its holder and the parts in order', () => {
    const gaps = vehicleRecordGaps({
      vehicles: [vehicle('ram', { year: 2016, make: 'Ford', model: 'F-250', weekly_insurance_cost: 0, weekly_registration_cost: 0 })],
      possessions: [held('ram', 'u-mal')],
      insurancePeriods: [],
      serviceVehicleIds: new Set(),
      holderNameByUserId: names,
      todayYmd: TODAY,
    })
    expect(gaps).toEqual([{ vehicleId: 'ram', name: '2016 Ford F-250', holderUserId: 'u-mal', holderName: 'Sam P.', missing: ['insurance', 'registration', 'service'], insuranceOnPlan: false }])
  })

  it('skips a vehicle with everything on file', () => {
    const gaps = vehicleRecordGaps({
      vehicles: [vehicle('a')],
      possessions: [held('a', 'u-mic')],
      insurancePeriods: [onPlan('a')],
      serviceVehicleIds: new Set(['a']),
      holderNameByUserId: names,
      todayYmd: TODAY,
    })
    expect(gaps).toEqual([])
  })

  it('checks only active vehicles: the motor pool, an unassigned vehicle and an ended hold are skipped', () => {
    const bare = { weekly_insurance_cost: 0, weekly_registration_cost: 0 }
    const gaps = vehicleRecordGaps({
      vehicles: [vehicle('pool', bare), vehicle('none', bare), vehicle('ended', bare), vehicle('future', bare)],
      possessions: [held('pool', null), held('ended', 'u-mal', '2026-01-01', '2026-09-30'), held('future', 'u-mal', '2026-11-01')],
      insurancePeriods: [],
      serviceVehicleIds: new Set(),
      holderNameByUserId: names,
      todayYmd: TODAY,
    })
    expect(gaps).toEqual([])
  })

  it('insurance is missing off a plan, on a plan at $0, or after the plan ended; a cost on a current plan counts', () => {
    const base = { possessions: [held('off', 'u-mic'), held('zero', 'u-mic'), held('ended', 'u-mic'), held('ok', 'u-mic')], serviceVehicleIds: new Set(['off', 'zero', 'ended', 'ok']), holderNameByUserId: names, todayYmd: TODAY }
    const gaps = vehicleRecordGaps({
      ...base,
      vehicles: [vehicle('off'), vehicle('zero', { weekly_insurance_cost: 0 }), vehicle('ended'), vehicle('ok')],
      insurancePeriods: [onPlan('zero'), onPlan('ended', '2026-01-01', '2026-09-01'), onPlan('ok')],
    })
    expect(gaps.map((g) => [g.vehicleId, g.missing, g.insuranceOnPlan])).toEqual([
      ['ended', ['insurance'], false],
      ['off', ['insurance'], false],
      // On a plan at $0: insured, the cost is what is missing.
      ['zero', ['insurance'], true],
    ])
  })

  it('registration is missing at $0 or blank; service is missing only when none was ever entered', () => {
    const gaps = vehicleRecordGaps({
      vehicles: [vehicle('reg0', { weekly_registration_cost: 0 }), vehicle('regNull', { weekly_registration_cost: null }), vehicle('noService')],
      possessions: [held('reg0', 'u-mic'), held('regNull', 'u-mic'), held('noService', 'u-mic')],
      insurancePeriods: [onPlan('reg0'), onPlan('regNull'), onPlan('noService')],
      serviceVehicleIds: new Set(['reg0', 'regNull']),
      holderNameByUserId: names,
      todayYmd: TODAY,
    })
    expect(gaps.map((g) => [g.vehicleId, g.missing])).toEqual([
      ['noService', ['service']],
      ['reg0', ['registration']],
      ['regNull', ['registration']],
    ])
  })

  it('orders most missing first, then by name, and reads a missing name as null', () => {
    const gaps = vehicleRecordGaps({
      vehicles: [vehicle('one', { make: 'Chevy', model: 'Silverado' }), vehicle('two', { make: 'Ford', model: 'Transit', weekly_registration_cost: 0 }), vehicle('three', { make: 'Chevy', model: 'Express', weekly_insurance_cost: 0, weekly_registration_cost: 0 })],
      possessions: [held('one', 'u-mic'), held('two', 'u-gone'), held('three', 'u-mic')],
      insurancePeriods: [onPlan('one'), onPlan('two'), onPlan('three')],
      serviceVehicleIds: new Set(),
      holderNameByUserId: names,
      todayYmd: TODAY,
    })
    expect(gaps.map((g) => g.name)).toEqual(['2019 Chevy Express', '2019 Ford Transit', '2019 Chevy Silverado'])
    expect(gaps.find((g) => g.vehicleId === 'two')?.holderName).toBeNull()
  })
})

describe('vehicleRecordGapWords', () => {
  it('names the missing parts the way a sentence says them, the cost when the vehicle is on a plan', () => {
    const all = ['insurance', 'registration', 'service'] as const
    expect(vehicleRecordGapWords({ missing: ['service'], insuranceOnPlan: false })).toBe('service')
    expect(vehicleRecordGapWords({ missing: ['insurance', 'service'], insuranceOnPlan: false })).toBe('insurance and service')
    expect(vehicleRecordGapWords({ missing: [...all], insuranceOnPlan: false })).toBe('insurance, registration and service')
    expect(vehicleRecordGapWords({ missing: [...all], insuranceOnPlan: true })).toBe('insurance cost, registration and service')
    expect(vehicleRecordGapWords({ missing: [...all], insuranceOnPlan: true }, 'or')).toBe('insurance cost, registration or service')
    expect(vehicleRecordGapWords({ missing: ['registration'], insuranceOnPlan: true })).toBe('registration')
    expect(vehicleRecordGapWords({ missing: [], insuranceOnPlan: false })).toBe('')
  })
})
