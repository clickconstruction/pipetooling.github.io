import { describe, expect, it } from 'vitest'
import type { VehicleRecordGap } from '../vehicleRecordGaps'
import { emptyVehicleDecision, vehicleDecisionReady, vehicleFillInRows, vehicleKnows, vehicleTrailWords, vehicleWrites } from './fillInVehicles'

const PLANS = [{ id: 'plan-1', name: 'Progressive fleet' }]
const gap = (p: Partial<VehicleRecordGap> = {}): VehicleRecordGap => ({
  vehicleId: 'v-1',
  name: '2017 Ram 2500',
  holderUserId: 'u-luis',
  holderName: 'Luis',
  missing: ['service'],
  insuranceOnPlan: true,
  ...p,
})

describe('fillInVehicles · the rows (punch list #146)', () => {
  it('one row per vehicle, most missing first, asking only for the missing records', () => {
    const rows = vehicleFillInRows([gap(), gap({ vehicleId: 'v-2', name: '2019 Ford F-250', holderName: 'Marco', missing: ['insurance', 'registration'], insuranceOnPlan: false })], PLANS)
    expect(rows.map((r) => r.vehicleId)).toEqual(['v-2', 'v-1'])
    expect(rows[1]!.title).toBe('2017 Ram 2500 · Luis drives it · no service on file')
    expect(rows[0]!.title).toBe('2019 Ford F-250 · Marco drives it · no insurance or registration on file')
    expect(rows[0]!.key).toBe('vehicle:v-2')
    expect(rows[0]!.doorHref).toBe('/people?tab=vehicles')
  })

  it('says what the app knows', () => {
    expect(vehicleKnows(gap())).toEqual(['Registration is on file.'])
    expect(vehicleKnows(gap({ holderName: null, missing: ['insurance'], insuranceOnPlan: true }))).toEqual(['Someone holds it today, with no name on file.', 'It is on an insurance plan, with no weekly cost entered.', 'Registration is on file.', 'Service has been logged before.'])
    expect(vehicleKnows(gap({ missing: ['insurance', 'registration', 'service'], insuranceOnPlan: false }))).toEqual(['It is not on an insurance plan.'])
  })

  it('is ready only when every missing part has a usable answer', () => {
    const [service] = vehicleFillInRows([gap()], PLANS)
    const d = emptyVehicleDecision('2026-10-23')
    expect(vehicleDecisionReady(service!, d)).toBe(true)
    expect(vehicleDecisionReady(service!, { ...d, odometerRaw: 'lots' })).toBe(false)
    const [both] = vehicleFillInRows([gap({ missing: ['insurance', 'registration'], insuranceOnPlan: false })], PLANS)
    expect(vehicleDecisionReady(both!, d)).toBe(false)
    expect(vehicleDecisionReady(both!, { ...d, insuranceCostRaw: '225', registrationCostRaw: '80' })).toBe(false)
    expect(vehicleDecisionReady(both!, { ...d, insuranceCostRaw: '225', registrationCostRaw: '80', planId: 'plan-1' })).toBe(true)
    const [onPlan] = vehicleFillInRows([gap({ missing: ['insurance'], insuranceOnPlan: true })], PLANS)
    expect(vehicleDecisionReady(onPlan!, { ...d, insuranceCostRaw: '225' })).toBe(true)
    expect(vehicleDecisionReady(onPlan!, { ...d, insuranceCostRaw: '0' })).toBe(false)
  })

  it('writes the Vehicles tab’s own rows: weekly costs, a plan period, a service with its reading', () => {
    const [row] = vehicleFillInRows([gap({ missing: ['insurance', 'registration', 'service'], insuranceOnPlan: false })], PLANS)
    const d = { ...emptyVehicleDecision('2026-10-23'), planId: 'plan-1', insuranceCostRaw: '$225', insuranceUnit: 'mo' as const, registrationCostRaw: '80', registrationUnit: 'yr' as const, serviceType: 'oil_change', serviceDateYmd: '2026-10-09', odometerRaw: '147,600', serviceNote: 'Oil, filters, rear brakes' }
    const w = vehicleWrites(row!, d, { userId: 'u-1' })!
    expect(w.vehiclePatch).toEqual({ weekly_insurance_cost: 51.92, weekly_registration_cost: 1.54 })
    expect(w.insurancePeriod).toEqual({ vehicle_id: 'v-1', plan_id: 'plan-1', start_date: '2026-10-23', created_by: 'u-1' })
    expect(w.serviceEvent).toEqual({ vehicle_id: 'v-1', service_type: 'oil_change', service_date: '2026-10-09', odometer_value: 147_600, cost: null, note: 'Oil, filters, rear brakes', created_by: 'u-1' })
    expect(w.odometerEntry).toEqual({ vehicle_id: 'v-1', odometer_value: 147_600, read_date: '2026-10-09', created_by: 'u-1' })
    expect(vehicleTrailWords(row!, w)).toBe('insurance $51.92/wk on Progressive fleet · registration $1.54/wk · oil change Oct 9 · People → Vehicles has it')
    const [onPlan] = vehicleFillInRows([gap({ missing: ['insurance'], insuranceOnPlan: true })], PLANS)
    const w2 = vehicleWrites(onPlan!, { ...emptyVehicleDecision('2026-10-23'), insuranceCostRaw: '52', insuranceUnit: 'wk' }, { userId: 'u-1' })!
    expect(w2.insurancePeriod).toBeNull()
    expect(w2.vehiclePatch).toEqual({ weekly_insurance_cost: 52 })
    expect(vehicleTrailWords(onPlan!, w2)).toBe('insurance $52.00/wk · People → Vehicles has it')
    expect(vehicleWrites(onPlan!, emptyVehicleDecision('2026-10-23'), { userId: 'u-1' })).toBeNull()
  })
})
