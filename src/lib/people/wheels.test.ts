import { describe, expect, it } from 'vitest'
import {
  buildWheelsRows,
  fieldHoursByUser,
  ownVehicleFuelRate,
  parseVehicleArrangement,
  sumFuelByUser,
  truckRunningCost,
  wheelsComparison,
  wheelsWindow,
  type WheelsTruck,
  splitFuelFamily,
  unattributedFuelByCard,
} from './wheels'

describe('wheels window + arrangement parsing', () => {
  it('covers 90 days ending today and tolerates unknown values', () => {
    expect(wheelsWindow('2026-09-03')).toEqual({ start: '2026-06-06', end: '2026-09-03', days: 90 })
    expect(parseVehicleArrangement('company')).toBe('company')
    expect(parseVehicleArrangement('own_fuel_paid')).toBe('own_fuel_paid')
    expect(parseVehicleArrangement('garbage')).toBe('none')
    expect(parseVehicleArrangement(null)).toBe('none')
  })
})

describe('fuel + hours per user', () => {
  it('sums |amount| per attributed user and skips unattributed charges', () => {
    const m = sumFuelByUser([
      { amount: -60.1, userId: 'u1' },
      { amount: -40, userId: 'u1' },
      { amount: 5, userId: 'u1' },
      { amount: -80, userId: null },
      { amount: -12.5, userId: 'u2' },
    ])
    expect(m.get('u1')).toBe(105.1)
    expect(m.get('u2')).toBe(12.5)
    expect(m.size).toBe(2)
  })
  it('counts approved closed job sessions only', () => {
    const base = { user_id: 'u1', job_ledger_id: 'j', bid_id: null, approved_at: 'x', rejected_at: null, revoked_at: null }
    const h = fieldHoursByUser([
      { ...base, clocked_in_at: '2026-09-01T08:00:00Z', clocked_out_at: '2026-09-01T12:00:00Z' },
      { ...base, clocked_in_at: '2026-09-02T08:00:00Z', clocked_out_at: '2026-09-02T10:30:00Z' },
      { ...base, bid_id: 'b', clocked_in_at: '2026-09-02T12:00:00Z', clocked_out_at: '2026-09-02T14:00:00Z' },
      { ...base, job_ledger_id: null, clocked_in_at: '2026-09-02T12:00:00Z', clocked_out_at: '2026-09-02T14:00:00Z' },
      { ...base, approved_at: null, clocked_in_at: '2026-09-03T08:00:00Z', clocked_out_at: '2026-09-03T12:00:00Z' },
      { ...base, clocked_in_at: '2026-09-03T08:00:00Z', clocked_out_at: null },
    ])
    expect(h.get('u1')).toBe(6.5)
  })
})

describe('rates', () => {
  it('prices a company truck all-in per holder field hour, pro-rating weekly costs by the window', () => {
    const c = truckRunningCost({ fuelUsd: 3018, weeklyInsurance: 48, weeklyRegistration: 6, onPlan: true, days: 91, serviceUsd: 412, holderFieldHours: 496.5 })
    expect(c).toEqual({ fuel: 3018, insurance: 624, registration: 78, service: 412, total: 4132, ratePerFieldHour: 8.32 })
    expect(truckRunningCost({ fuelUsd: 100, weeklyInsurance: 48, weeklyRegistration: 6, onPlan: false, days: 7, serviceUsd: 0, holderFieldHours: 0 })).toMatchObject({ insurance: 0, registration: 6, ratePerFieldHour: null })
  })
  it('prices an own vehicle as fuel per field hour', () => {
    expect(ownVehicleFuelRate(1006, 165.5)).toBe(6.08)
    expect(ownVehicleFuelRate(1006, 0)).toBeNull()
  })
})

describe('buildWheelsRows', () => {
  const truck: WheelsTruck = {
    vehicleId: 'v1',
    name: '2019 Ford F-150',
    holderUserId: 'u-mal',
    holderName: 'Malachi',
    cost: truckRunningCost({ fuelUsd: 3018, weeklyInsurance: 48, weeklyRegistration: 6, onPlan: true, days: 91, serviceUsd: 412, holderFieldHours: 496.5 }),
    holderFieldHours: 496.5,
  }
  const fuel = new Map([
    ['u-mal', 3018],
    ['u-mic', 903],
    ['u-tau', 40],
  ])
  const hours = new Map([
    ['u-mal', 496.5],
    ['u-mic', 148],
  ])
  it('builds one row per person with the rate for their arrangement, company first', () => {
    const rows = buildWheelsRows(
      [
        { name: 'Taunya', userId: 'u-tau', arrangement: 'none', override: null },
        { name: 'Micah', userId: 'u-mic', arrangement: 'own_fuel_paid', override: null },
        { name: 'Malachi', userId: 'u-mal', arrangement: 'company', override: null },
        { name: 'Ghost', userId: null, arrangement: 'own_fuel_paid', override: null },
        { name: 'Wendi', userId: 'u-wen', arrangement: 'company', override: 7.5 },
      ],
      fuel,
      hours,
      [truck],
    )
    expect(rows.map((r) => r.name)).toEqual(['Malachi', 'Wendi', 'Micah', 'Ghost', 'Taunya'])
    const mal = rows[0]!
    expect(mal.truck?.name).toBe('2019 Ford F-150')
    expect(mal.computedRate).toBe(8.32)
    expect(mal.effectiveRate).toBe(8.32)
    expect(mal.note).toBe('2019 Ford F-150 · $4,132 ÷ 496.5 field h')
    const wen = rows[1]!
    expect(wen.computedRate).toBeNull()
    expect(wen.effectiveRate).toBe(7.5)
    expect(wen.note).toBe('manual override')
    const mic = rows[2]!
    expect(mic.computedRate).toBe(6.1)
    expect(mic.fuelPerFieldHour).toBe(6.1)
    expect(mic.note).toBe('fuel ÷ 148.0 field h')
    const ghost = rows[3]!
    expect(ghost.effectiveRate).toBeNull()
    expect(ghost.note).toBe('not linked to a login — fuel cannot be attributed')
    const tau = rows[4]!
    expect(tau.effectiveRate).toBeNull()
    expect(tau.note).toBe('fuel stays on the job as parts')
  })
  it('averages the two deals for the comparison line', () => {
    const rows = buildWheelsRows(
      [
        { name: 'A', userId: 'u-mal', arrangement: 'company', override: null },
        { name: 'B', userId: 'u-mic', arrangement: 'own_fuel_paid', override: null },
      ],
      fuel,
      hours,
      [truck],
    )
    expect(wheelsComparison(rows)).toEqual({ ownAvg: 6.1, companyAvg: 8.32 })
    expect(wheelsComparison([])).toEqual({ ownAvg: null, companyAvg: null })
  })
})

describe('fuel family split (card purchases only)', () => {
  it('keeps card purchases and reports off-card rows by counterparty instead of counting them', () => {
    const rows = [
      { id: 'a', amount: -60, kind: 'debitCardTransaction', counterparty: 'QuikTrip', hasCard: true },
      { id: 'b', amount: -36737, kind: 'other', counterparty: 'HAJOCA CORPORATI', hasCard: false },
      { id: 'c', amount: -540, kind: 'debitCardTransaction', counterparty: 'Cash App', hasCard: false },
      { id: 'd', amount: -45, kind: 'debitCardTransaction', counterparty: 'Shell', hasCard: true },
    ]
    const s = splitFuelFamily(rows)
    expect(s.card.map((r) => r.id)).toEqual(['a', 'd'])
    expect(s.offCard).toEqual({ usd: 37277, n: 2, top: [{ counterparty: 'HAJOCA CORPORATI', usd: 36737 }, { counterparty: 'Cash App', usd: 540 }] })
  })
  it('lists unattributed card fuel by card with the nickname when there is one', () => {
    const out = unattributedFuelByCard(
      [
        { amount: -50, cardId: 'bb2cfabe-74ac-11f0-bf2b-cf8ecc6de40f', userId: null },
        { amount: -45.31, cardId: 'bb2cfabe-74ac-11f0-bf2b-cf8ecc6de40f', userId: null },
        { amount: -30.03, cardId: '11e42d2c-8f7e-11f1-aa2d-7fe8c2f61158', userId: null },
        { amount: -80, cardId: 'cc31655c-0000-0000-0000-000000000000', userId: 'u1' },
      ],
      new Map([['bb2cfabe-74ac-11f0-bf2b-cf8ecc6de40f', 'Jonathan 4692']]),
    )
    expect(out).toEqual([
      { cardId: 'bb2cfabe-74ac-11f0-bf2b-cf8ecc6de40f', label: 'Jonathan 4692', usd: 95.31, n: 2 },
      { cardId: '11e42d2c-8f7e-11f1-aa2d-7fe8c2f61158', label: 'card …1158', usd: 30.03, n: 1 },
    ])
  })
})
