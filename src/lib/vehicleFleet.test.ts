import { describe, expect, it } from 'vitest'
import {
  buildVehicleLedger,
  currentPossession,
  daysBetweenYmd,
  fleetSummary,
  handOffWrites,
  latestReading,
  odometerAgeLabel,
  odometerFreshness,
  parseOdometerInput,
  vehicleDisplayName,
  vehicleMatchesSearch,
  vinTail,
  type FleetOdometerEntry,
  type FleetPossession,
  type FleetValueEntry,
} from './vehicleFleet'

const TODAY = '2026-08-14'

function poss(over: Partial<FleetPossession>): FleetPossession {
  return { id: 'p1', vehicle_id: 'v1', user_id: 'u1', start_date: '2026-01-03', end_date: null, created_at: null, ...over }
}

function reading(over: Partial<FleetOdometerEntry>): FleetOdometerEntry {
  return { id: 'r1', vehicle_id: 'v1', odometer_value: 100, read_date: '2026-07-04', created_at: null, ...over }
}

describe('vehicleDisplayName / vinTail', () => {
  it('joins the present parts and falls back sensibly', () => {
    expect(vehicleDisplayName({ year: 2019, make: 'Ram', model: 'ProMaster' })).toBe('2019 Ram ProMaster')
    expect(vehicleDisplayName({ year: null, make: '', model: 'Transit' })).toBe('Transit')
    expect(vehicleDisplayName({ year: null, make: '', model: '' })).toBe('Vehicle')
  })
  it('shows the last four VIN chars', () => {
    expect(vinTail('3C6TRVDG7KE503K92')).toBe('…3K92')
    expect(vinTail('AB12')).toBe('AB12')
    expect(vinTail('  ')).toBeNull()
    expect(vinTail(null)).toBeNull()
  })
})

describe('currentPossession', () => {
  it('finds the open possession and ignores ended/future ones', () => {
    const ended = poss({ id: 'a', end_date: '2026-06-01' })
    const open = poss({ id: 'b', start_date: '2026-06-02' })
    const future = poss({ id: 'c', start_date: '2026-12-01' })
    expect(currentPossession([ended, open, future], TODAY)?.id).toBe('b')
    expect(currentPossession([ended], TODAY)).toBeNull()
  })
  it('same-day hand-off resolves to the newer start / open-ended row', () => {
    const old = poss({ id: 'a', start_date: '2026-01-01', end_date: TODAY })
    const now = poss({ id: 'b', start_date: TODAY })
    expect(currentPossession([old, now], TODAY)?.id).toBe('b')
  })
})

describe('latestReading / freshness / age', () => {
  it('picks the newest read date, breaking same-day ties by created_at', () => {
    const older = reading({ id: 'a', read_date: '2026-05-01' })
    const newer = reading({ id: 'b', read_date: '2026-07-04', created_at: '2026-07-04T01:00:00Z' })
    const newest = reading({ id: 'c', read_date: '2026-07-04', created_at: '2026-07-04T02:00:00Z' })
    expect(latestReading([older, newer, newest])?.id).toBe('c')
    expect(latestReading([])).toBeNull()
  })
  it('grades freshness at the 30-day line', () => {
    expect(odometerFreshness(reading({ read_date: '2026-08-01' }), TODAY)).toBe('fresh')
    expect(odometerFreshness(reading({ read_date: '2026-07-04' }), TODAY)).toBe('stale')
    expect(odometerFreshness(null, TODAY)).toBe('none')
  })
  it('labels ages in days', () => {
    expect(odometerAgeLabel(reading({ read_date: TODAY }), TODAY)).toBe('today')
    expect(odometerAgeLabel(reading({ read_date: '2026-08-13' }), TODAY)).toBe('yesterday')
    expect(odometerAgeLabel(reading({ read_date: '2026-07-04' }), TODAY)).toBe('41d ago')
    expect(odometerAgeLabel(null, TODAY)).toBe('no reading yet')
  })
  it('daysBetweenYmd spans month boundaries', () => {
    expect(daysBetweenYmd('2026-07-31', '2026-08-01')).toBe(1)
    expect(daysBetweenYmd('2026-08-14', '2026-08-14')).toBe(0)
  })
})

describe('fleetSummary', () => {
  it('counts unassigned and stale-reading vehicles', () => {
    const vehicles = [
      { id: 'v1', year: 2019, make: 'Ram', model: 'ProMaster', vin: null },
      { id: 'v2', year: 2022, make: 'Ford', model: 'Transit', vin: null },
      { id: 'v3', year: 2024, make: 'Chevy', model: 'Silverado', vin: null },
    ]
    const holders = new Map([
      ['v1', poss({})],
      ['v2', poss({ id: 'p2', vehicle_id: 'v2' })],
    ])
    const latest = new Map([
      ['v1', reading({ read_date: '2026-07-04' })],
      ['v2', reading({ id: 'r2', vehicle_id: 'v2', read_date: '2026-08-10' })],
    ])
    expect(fleetSummary(vehicles, holders, latest, TODAY)).toEqual({ total: 3, unassigned: 1, staleReadings: 2 })
  })
})

describe('vehicleMatchesSearch / parseOdometerInput', () => {
  const v = { id: 'v1', year: 2019, make: 'Ram', model: 'ProMaster', vin: '3C6TRVDG7KE503K92' }
  it('matches name, VIN, and holder', () => {
    expect(vehicleMatchesSearch(v, 'Tristen', '')).toBe(true)
    expect(vehicleMatchesSearch(v, 'Tristen', 'promaster')).toBe(true)
    expect(vehicleMatchesSearch(v, 'Tristen', '3k92')).toBe(true)
    expect(vehicleMatchesSearch(v, 'Tristen', 'trist')).toBe(true)
    expect(vehicleMatchesSearch(v, null, 'ford')).toBe(false)
  })
  it('parses odometer input with commas, rejecting junk', () => {
    expect(parseOdometerInput('123,900')).toBe(123900)
    expect(parseOdometerInput(' 84120 ')).toBe(84120)
    expect(parseOdometerInput('')).toBeNull()
    expect(parseOdometerInput('-5')).toBeNull()
    expect(parseOdometerInput('12x9')).toBeNull()
  })
})

describe('buildVehicleLedger', () => {
  const users = new Map([
    ['u1', 'Malachi'],
    ['u2', 'Tristen'],
    ['u3', 'Danielle'],
  ])
  it('merges streams newest-first with hand-off chaining and returns', () => {
    const possessions = [
      poss({ id: 'p1', user_id: 'u1', start_date: '2025-06-02', end_date: '2026-01-03' }),
      poss({ id: 'p2', user_id: 'u2', start_date: '2026-01-03' }),
    ]
    const readings = [
      reading({ id: 'r1', read_date: '2026-07-04', created_by: 'u3' }),
      reading({ id: 'r2', read_date: '2026-01-03', odometer_value: 98410 }),
    ]
    const valueEntries: FleetValueEntry[] = [
      { id: 'e1', vehicle_id: 'v1', replacement_value: 28500, read_date: '2026-04-18', created_at: null },
    ]
    const rows = buildVehicleLedger({ readings, possessions, valueEntries, userNameById: users })
    expect(rows.map((r) => r.key)).toEqual(['reading-r1', 'value-e1', 'handoff-p2', 'reading-r2', 'handoff-p1'])
    expect(rows[0]?.label).toBe('Reading entered by Danielle')
    expect(rows[1]?.amount).toBe(28500)
    expect(rows[2]?.label).toBe('Malachi → Tristen')
    expect(rows[3]?.label).toBe('Reading entered')
    expect(rows[4]?.label).toBe('Assigned to Malachi')
  })
  it('emits a return row when a possession ends with no successor', () => {
    const rows = buildVehicleLedger({
      readings: [],
      possessions: [poss({ id: 'p1', user_id: 'u2', start_date: '2026-02-01', end_date: '2026-07-30' })],
      valueEntries: [],
      userNameById: users,
    })
    expect(rows.map((r) => [r.kind, r.label])).toEqual([
      ['return', 'Tristen returned the vehicle'],
      ['handoff', 'Assigned to Tristen'],
    ])
  })
  it('suppresses the return row when a successor starts on or after the end date', () => {
    const rows = buildVehicleLedger({
      readings: [],
      possessions: [
        poss({ id: 'p1', user_id: 'u1', start_date: '2026-02-01', end_date: '2026-07-30' }),
        poss({ id: 'p2', user_id: 'u2', start_date: '2026-07-30' }),
      ],
      valueEntries: [],
      userNameById: users,
    })
    expect(rows.filter((r) => r.kind === 'return')).toEqual([])
  })
})

describe('handOffWrites', () => {
  it('ends the open possession, starts the new one, and captures the reading', () => {
    const open = poss({ id: 'p1', user_id: 'u1' })
    expect(
      handOffWrites({ vehicleId: 'v1', openPossession: open, toUserId: 'u2', dateYmd: TODAY, odometer: 84300, byUserId: 'u3' }),
    ).toEqual({
      endPossession: { id: 'p1', end_date: TODAY },
      newPossession: { vehicle_id: 'v1', user_id: 'u2', start_date: TODAY },
      odometerEntry: { vehicle_id: 'v1', odometer_value: 84300, read_date: TODAY, created_by: 'u3' },
    })
  })
  it('handles the unassigned case and the no-odometer case', () => {
    expect(handOffWrites({ vehicleId: 'v1', openPossession: null, toUserId: 'u2', dateYmd: TODAY, odometer: null, byUserId: null })).toEqual({
      endPossession: null,
      newPossession: { vehicle_id: 'v1', user_id: 'u2', start_date: TODAY },
      odometerEntry: null,
    })
  })
})
