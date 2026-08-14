import { describe, expect, it } from 'vitest'
import {
  buildVehicleLedger,
  isMotorPoolPossession,
  currentInsurancePeriod,
  currentPossession,
  lastEndedInsurancePeriod,
  type FleetInsurancePeriod,
  daysBetweenYmd,
  fleetOilCounts,
  fleetSummary,
  handOffWrites,
  lastOilChange,
  latestReading,
  odometerAgeLabel,
  odometerFreshness,
  oilChipLabel,
  oilStatus,
  parseOdometerInput,
  vehicleDisplayName,
  vehicleMatchesSearch,
  vinTail,
  type FleetOdometerEntry,
  type FleetPossession,
  openProblemCounts,
  openProblems,
  type FleetProblemReport,
  type FleetServiceEvent,
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
    expect(fleetSummary(vehicles, holders, latest, TODAY)).toEqual({ total: 3, unassigned: 1, motorPool: 0, staleReadings: 2 })
  })
  it('counts motor-pool vehicles separately from unassigned', () => {
    const vehicles = [
      { id: 'v1', year: 2019, make: 'Ram', model: 'ProMaster', vin: null },
      { id: 'v2', year: 2022, make: 'Ford', model: 'Transit', vin: null },
      { id: 'v3', year: 2024, make: 'Chevy', model: 'Silverado', vin: null },
    ]
    const holders = new Map([
      ['v1', poss({})],
      ['v2', poss({ id: 'p2', vehicle_id: 'v2', user_id: null })],
    ])
    const s = fleetSummary(vehicles, holders, new Map(), TODAY)
    expect(s.unassigned).toBe(1)
    expect(s.motorPool).toBe(1)
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

function svc(over: Partial<FleetServiceEvent>): FleetServiceEvent {
  return { id: 's1', vehicle_id: 'v1', service_type: 'oil_change', service_date: '2026-05-02', odometer_value: 115000, cost: 89, note: null, created_at: null, ...over }
}

describe('oil status (v2.1645)', () => {
  it('finds the newest odometer-bearing oil change', () => {
    const older = svc({ id: 'a', service_date: '2025-12-19', odometer_value: 104850 })
    const tires = svc({ id: 'b', service_type: 'tires', service_date: '2026-06-01' })
    const noOdo = svc({ id: 'c', service_date: '2026-07-01', odometer_value: null })
    const newest = svc({ id: 'd' })
    expect(lastOilChange([older, tires, noOdo, newest])?.id).toBe('d')
    expect(lastOilChange([tires, noOdo])).toBeNull()
  })
  it('grades ok / due soon / overdue / unknown', () => {
    const oil = svc({})
    const at = (miles: number): FleetOdometerEntry => reading({ read_date: '2026-07-04', odometer_value: miles })
    expect(oilStatus(oil, 5000, at(118000))).toEqual({ state: 'ok', nextDueAt: 120000, milesRemaining: 2000 })
    expect(oilStatus(oil, 5000, at(119200))).toEqual({ state: 'due_soon', nextDueAt: 120000, milesRemaining: 800 })
    expect(oilStatus(oil, 5000, at(121480))).toEqual({ state: 'overdue', nextDueAt: 120000, milesOver: 1480 })
    expect(oilStatus(null, 5000, at(118000))).toEqual({ state: 'unknown' })
    expect(oilStatus(oil, 5000, null)).toEqual({ state: 'unknown' })
    expect(oilStatus(oil, null, at(119500))).toEqual({ state: 'due_soon', nextDueAt: 120000, milesRemaining: 500 })
  })
  it('labels each state', () => {
    expect(oilChipLabel({ state: 'unknown' })).toBe('Oil unknown')
    expect(oilChipLabel({ state: 'ok', nextDueAt: 120000, milesRemaining: 2000 })).toBe('Oil OK · next 120,000')
    expect(oilChipLabel({ state: 'due_soon', nextDueAt: 120000, milesRemaining: 800 })).toBe('Oil due in 800 mi')
    expect(oilChipLabel({ state: 'overdue', nextDueAt: 120000, milesOver: 1480 })).toBe('Oil overdue 1,480 mi')
  })
  it('counts due-soon and overdue across the fleet', () => {
    const vehicles = [
      { id: 'v1', year: null, make: 'A', model: 'A', vin: null, oil_change_interval_miles: 5000 },
      { id: 'v2', year: null, make: 'B', model: 'B', vin: null, oil_change_interval_miles: 5000 },
      { id: 'v3', year: null, make: 'C', model: 'C', vin: null, oil_change_interval_miles: 5000 },
    ]
    const lastOil = new Map([
      ['v1', svc({})],
      ['v2', svc({ id: 's2', vehicle_id: 'v2' })],
    ])
    const latest = new Map([
      ['v1', reading({ odometer_value: 121480 })],
      ['v2', reading({ id: 'r2', vehicle_id: 'v2', odometer_value: 119500 })],
    ])
    expect(fleetOilCounts(vehicles, lastOil, latest)).toEqual({ dueSoon: 1, overdue: 1 })
  })
})

describe('buildVehicleLedger service rows (v2.1645)', () => {
  it('labels service events with note and cost, ordering above same-day readings', () => {
    const rows = buildVehicleLedger({
      readings: [reading({ id: 'r1', read_date: '2026-05-02', odometer_value: 115000 })],
      possessions: [],
      valueEntries: [],
      serviceEvents: [
        svc({ note: 'Take 5, Bandera Rd' }),
        svc({ id: 's2', service_type: 'tires', service_date: '2026-03-14', odometer_value: 109300, cost: 612, note: '2 front + alignment' }),
      ],
      userNameById: new Map(),
    })
    expect(rows.map((r) => r.key)).toEqual(['service-s1', 'reading-r1', 'service-s2'])
    expect(rows[0]?.label).toBe('Oil change · Take 5, Bandera Rd · $89.00')
    expect(rows[0]?.odometer).toBe(115000)
    expect(rows[2]?.label).toBe('Tires · 2 front + alignment · $612.00')
  })
})

function prob(over: Partial<FleetProblemReport>): FleetProblemReport {
  return {
    id: 'q1',
    vehicle_id: 'v1',
    description: 'Brakes grinding front left',
    severity: 'needs_service',
    report_date: '2026-08-09',
    reported_by: 'u2',
    resolved_at: null,
    resolved_by: null,
    resolution_note: null,
    created_at: null,
    ...over,
  }
}

describe('problem reports (v2.1647)', () => {
  it('counts open problems per vehicle, ignoring resolved ones', () => {
    const counts = openProblemCounts([
      prob({}),
      prob({ id: 'q2', description: 'Slow leak rear right' }),
      prob({ id: 'q3', vehicle_id: 'v2', resolved_at: '2026-08-01T10:00:00Z' }),
    ])
    expect(counts.get('v1')).toBe(2)
    expect(counts.get('v2')).toBeUndefined()
    expect(openProblems([prob({}), prob({ id: 'q9', resolved_at: '2026-08-01T10:00:00Z' })]).map((p) => p.id)).toEqual(['q1'])
  })
  it('ledgers the report and its resolution as separate dated rows', () => {
    const rows = buildVehicleLedger({
      readings: [],
      possessions: [],
      valueEntries: [],
      problemReports: [
        prob({ resolved_at: '2026-08-12T15:00:00Z', resolution_note: 'new pads' }),
        prob({ id: 'q2', description: 'Wiper motor weak', report_date: '2026-08-10' }),
      ],
      userNameById: new Map([['u2', 'Tristen']]),
    })
    expect(rows.map((r) => [r.kind, r.dateYmd])).toEqual([
      ['problem_resolved', '2026-08-12'],
      ['problem', '2026-08-10'],
      ['problem', '2026-08-09'],
    ])
    expect(rows[0]?.label).toBe('Resolved · Brakes grinding front left — new pads')
    expect(rows[2]?.label).toBe('Brakes grinding front left — reported by Tristen')
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

function insPeriod(over: Partial<FleetInsurancePeriod>): FleetInsurancePeriod {
  return { id: 'i1', vehicle_id: 'v1', plan_id: 'plan1', start_date: '2026-01-09', end_date: null, created_at: null, ...over }
}

describe('insurance periods', () => {
  it('finds the current coverage and ignores ended/future ones', () => {
    const ended = insPeriod({ id: 'a', end_date: '2026-05-30' })
    const open = insPeriod({ id: 'b', start_date: '2026-06-12' })
    const future = insPeriod({ id: 'c', start_date: '2026-12-01' })
    expect(currentInsurancePeriod([ended, open, future], TODAY)?.id).toBe('b')
    expect(currentInsurancePeriod([ended], TODAY)).toBeNull()
    expect(currentInsurancePeriod([], TODAY)).toBeNull()
  })
  it('same-day plan change resolves to the open-ended row', () => {
    const old = insPeriod({ id: 'a', start_date: '2026-01-01', end_date: TODAY })
    const now = insPeriod({ id: 'b', start_date: TODAY })
    expect(currentInsurancePeriod([old, now], TODAY)?.id).toBe('b')
  })
  it('lastEndedInsurancePeriod picks the latest end date for "off since"', () => {
    const first = insPeriod({ id: 'a', start_date: '2025-02-01', end_date: '2025-11-15' })
    const second = insPeriod({ id: 'b', start_date: '2026-01-09', end_date: '2026-05-30' })
    expect(lastEndedInsurancePeriod([first, second])?.id).toBe('b')
    expect(lastEndedInsurancePeriod([insPeriod({ id: 'c' })])).toBeNull()
    expect(lastEndedInsurancePeriod([])).toBeNull()
  })
})

describe('buildVehicleLedger insurance rows', () => {
  it('adds on/off rows with plan names, ordered with hand-offs above readings', () => {
    const rows = buildVehicleLedger({
      readings: [reading({ id: 'r1', read_date: '2026-06-12', odometer_value: 120000 })],
      possessions: [],
      valueEntries: [],
      userNameById: new Map(),
      insurancePeriods: [
        insPeriod({ id: 'a', start_date: '2026-01-09', end_date: '2026-05-30' }),
        insPeriod({ id: 'b', start_date: '2026-06-12', plan_id: 'plan2' }),
      ],
      planNameById: new Map([
        ['plan1', 'Progressive Commercial'],
        ['plan2', 'Hartford fleet'],
      ]),
    })
    expect(rows.map((r) => [r.kind, r.dateYmd])).toEqual([
      ['insurance_on', '2026-06-12'],
      ['reading', '2026-06-12'],
      ['insurance_off', '2026-05-30'],
      ['insurance_on', '2026-01-09'],
    ])
    expect(rows[0]?.label).toBe('Added to Hartford fleet')
    expect(rows[2]?.label).toBe('Taken off Progressive Commercial')
  })
})

describe('motor pool possessions', () => {
  it('a pool possession is the current holder and resolves same-day parking', () => {
    const driver = poss({ id: 'a', user_id: 'u1', start_date: '2026-01-01', end_date: TODAY })
    const pool = poss({ id: 'b', user_id: null, start_date: TODAY })
    const cur = currentPossession([driver, pool], TODAY)
    expect(cur?.id).toBe('b')
    expect(cur && isMotorPoolPossession(cur)).toBe(true)
  })
  it('ledger labels park/unpark moves with the Motor pool name and skips pool return rows', () => {
    const rows = buildVehicleLedger({
      readings: [],
      possessions: [
        poss({ id: 'p1', user_id: 'u2', start_date: '2026-02-01', end_date: '2026-05-01' }),
        poss({ id: 'p2', user_id: null, start_date: '2026-05-01', end_date: '2026-08-01' }),
        poss({ id: 'p3', user_id: 'u1', start_date: '2026-08-01' }),
      ],
      valueEntries: [],
      userNameById: new Map([
        ['u1', 'Malachi'],
        ['u2', 'Tristen'],
      ]),
    })
    expect(rows.map((r) => [r.kind, r.label])).toEqual([
      ['handoff', 'Motor pool → Malachi'],
      ['handoff', 'Tristen → Motor pool'],
      ['handoff', 'Assigned to Tristen'],
    ])
  })
  it('a first possession that parks the vehicle reads "Parked in the motor pool"', () => {
    const rows = buildVehicleLedger({
      readings: [],
      possessions: [poss({ id: 'p1', user_id: null, start_date: '2026-03-01' })],
      valueEntries: [],
      userNameById: new Map(),
    })
    expect(rows.map((r) => r.label)).toEqual(['Parked in the motor pool'])
  })
  it('handOffWrites carries a null user for parking', () => {
    const open = poss({ id: 'p1', user_id: 'u1' })
    expect(handOffWrites({ vehicleId: 'v1', openPossession: open, toUserId: null, dateYmd: TODAY, odometer: null, byUserId: null })).toEqual({
      endPossession: { id: 'p1', end_date: TODAY },
      newPossession: { vehicle_id: 'v1', user_id: null, start_date: TODAY },
      odometerEntry: null,
    })
  })
})
