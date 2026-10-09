import { describe, expect, it } from 'vitest'
import {
  WHEELS_WEAR_LIFE_YEARS,
  buildWheelsRows,
  fieldHoursByUser,
  fleetTruckRate,
  truckWearForWindow,
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
  it('sums fuel as cost per attributed user: a purchase adds, a refund comes off; skips unattributed charges', () => {
    const m = sumFuelByUser([
      { amount: -60.1, userId: 'u1' },
      { amount: -40, userId: 'u1' },
      { amount: 5, userId: 'u1' },
      { amount: -80, userId: null },
      { amount: -12.5, userId: 'u2' },
    ])
    expect(m.get('u1')).toBe(95.1) // 60.10 + 40 − 5 refunded
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
    // All-in for the comparison; the fixed part (insurance + registration + service) is what Review charges besides fuel on no job.
    expect(c).toEqual({ fuel: 3018, insurance: 624, registration: 78, service: 412, wear: 0, hasReplacementValue: false, total: 4132, ratePerFieldHour: 8.32, fixedRatePerFieldHour: 2.24 })
    expect(truckRunningCost({ fuelUsd: 100, weeklyInsurance: 48, weeklyRegistration: 6, onPlan: false, days: 7, serviceUsd: 0, holderFieldHours: 0 })).toMatchObject({ insurance: 0, registration: 6, ratePerFieldHour: null, fixedRatePerFieldHour: null })
  })
  it('v2.5039 · wear is the replacement value over a five-year life, for the window, and is in the fixed rate', () => {
    expect(WHEELS_WEAR_LIFE_YEARS).toBe(5)
    // $36,500 over 5 × 365 days is $20 a day; 90 days is $1,800.
    expect(truckWearForWindow(36500, 90)).toBe(1800)
    expect(truckWearForWindow(null, 90)).toBe(0)
    expect(truckWearForWindow(0, 90)).toBe(0)
    const c = truckRunningCost({ fuelUsd: 3018, weeklyInsurance: 48, weeklyRegistration: 6, onPlan: true, days: 91, serviceUsd: 412, holderFieldHours: 496.5, replacementValueUsd: 36500 })
    expect(c).toMatchObject({ wear: 1820, hasReplacementValue: true, total: 5952 })
    // (624 + 78 + 412 + 1,820) ÷ 496.5 field h
    expect(c.fixedRatePerFieldHour).toBe(5.91)
  })
  it('v2.5039 · the fleet rate: every truck’s fixed costs and wear over the crew’s field hours, fuel left on the jobs', () => {
    const trucks = [
      { weeklyInsurance: 48, weeklyRegistration: 6, onPlan: true, serviceUsd: 412, replacementValueUsd: 36500 },
      { weeklyInsurance: 60, weeklyRegistration: 7, onPlan: false, serviceUsd: 0, replacementValueUsd: null },
    ]
    // Truck 1: 617.14 + 77.14 + 412 + 1,800 = 2,906.28. Truck 2 is off its plan: registration only, 90.
    expect(fleetTruckRate(trucks, 1200, 90)).toEqual({ fixedUsd: 2996.28, ratePerFieldHour: 2.5 })
    expect(fleetTruckRate(trucks, 0, 90).ratePerFieldHour).toBeNull()
    expect(fleetTruckRate([], 1200, 90)).toEqual({ fixedUsd: 0, ratePerFieldHour: 0 })
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
  it('builds one row per person with the fixed rate Review charges for their deal, company first', () => {
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
    expect(mal.allInRate).toBe(8.32)
    expect(mal.computedFixedRate).toBe(2.24)
    expect(mal.fixedRate).toBe(2.24)
    expect(mal.note).toBe('2019 Ford F-150 · $1,114 fixed ÷ 496.5 field h, no replacement value on file; fuel stays on the jobs')
    const wen = rows[1]!
    expect(wen.computedFixedRate).toBeNull()
    expect(wen.fixedRate).toBe(7.5) // the override is the fixed part only
    expect(wen.note).toBe('manual fixed rate; fuel stays on the jobs')
    const mic = rows[2]!
    expect(mic.allInRate).toBe(6.1)
    expect(mic.fuelPerFieldHour).toBe(6.1)
    expect(mic.fixedRate).toBe(0) // an own vehicle has no fixed costs; Review charges their fuel on no job
    expect(mic.note).toBe('fuel stays on the jobs; Review charges their fuel on no job')
    const ghost = rows[3]!
    expect(ghost.note).toBe('not linked to a login — fuel cannot be attributed')
    const tau = rows[4]!
    expect(tau.fixedRate).toBeNull()
    expect(tau.note).toBe('fuel stays on the job as parts')
  })
  it('v2.5039 · a truck with a replacement value names no gap, and its wear lifts the fixed rate', () => {
    const valued: WheelsTruck = { ...truck, cost: truckRunningCost({ fuelUsd: 3018, weeklyInsurance: 48, weeklyRegistration: 6, onPlan: true, days: 91, serviceUsd: 412, holderFieldHours: 496.5, replacementValueUsd: 36500 }) }
    const [row] = buildWheelsRows([{ name: 'Malachi', userId: 'u-mal', arrangement: 'company', override: null }], fuel, hours, [valued])
    expect(row).toMatchObject({ computedFixedRate: 5.91, fixedRate: 5.91 })
    expect(row!.note).toBe('2019 Ford F-150 · $2,934 fixed ÷ 496.5 field h; fuel stays on the jobs')
  })
  it('a company truck with no fixed costs on file charges only the fuel on no job', () => {
    const bare: WheelsTruck = { ...truck, cost: truckRunningCost({ fuelUsd: 3018, weeklyInsurance: null, weeklyRegistration: null, onPlan: false, days: 90, serviceUsd: 0, holderFieldHours: 496.5 }) }
    const [row] = buildWheelsRows([{ name: 'Malachi', userId: 'u-mal', arrangement: 'company', override: null }], fuel, hours, [bare])
    expect(row).toMatchObject({ allInRate: 6.08, computedFixedRate: 0, fixedRate: 0 })
    expect(row!.note).toBe('2019 Ford F-150 · no insurance, registration, service or replacement value on file; Review charges only their fuel on no job')
  })
  it('averages the two deals all-in for the comparison line', () => {
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

describe('fuel family split (card charges only)', () => {
  it('keeps card charges, a refund to the card included, and reports off-card rows by counterparty instead of counting them', () => {
    const rows = [
      { id: 'a', amount: -60, kind: 'debitCardTransaction', counterparty: 'QuikTrip', hasCard: true },
      { id: 'b', amount: -36737, kind: 'other', counterparty: 'HAJOCA CORPORATI', hasCard: false },
      { id: 'c', amount: -540, kind: 'debitCardTransaction', counterparty: 'Cash App', hasCard: false },
      { id: 'd', amount: -45, kind: 'debitCardTransaction', counterparty: 'Shell', hasCard: true },
      // Mercury files a refund to a card as kind 'other'; it carries the card, so it counts (and comes off).
      { id: 'r', amount: 12, kind: 'other', counterparty: 'Shell', hasCard: true },
    ]
    const s = splitFuelFamily(rows)
    expect(s.card.map((r) => r.id)).toEqual(['a', 'd', 'r'])
    expect(s.offCard).toEqual({ usd: 37277, n: 2, top: [{ counterparty: 'HAJOCA CORPORATI', usd: 36737 }, { counterparty: 'Cash App', usd: 540 }] })
    expect(s.companyCard).toEqual({ usd: 0, n: 0, byCard: [] })
  })
  it('sets company-card purchases aside as management tools, by card', () => {
    const s = splitFuelFamily(
      [
        { id: 'a', amount: -60, kind: 'debitCardTransaction', counterparty: 'QuikTrip', hasCard: true, cardId: 'card-mal' },
        { id: 'g', amount: -147.04, kind: 'debitCardTransaction', counterparty: 'One Step Gps', hasCard: true, cardId: 'card-gps' },
        { id: 't', amount: -107.17, kind: 'debitCardTransaction', counterparty: 'Tesla', hasCard: true, cardId: 'card-tesla' },
      ],
      new Set(['card-gps', 'card-tesla']),
    )
    expect(s.card.map((r) => r.id)).toEqual(['a'])
    expect(s.companyCard).toEqual({ usd: 254.21, n: 2, byCard: [{ cardId: 'card-gps', usd: 147.04 }, { cardId: 'card-tesla', usd: 107.17 }] })
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
