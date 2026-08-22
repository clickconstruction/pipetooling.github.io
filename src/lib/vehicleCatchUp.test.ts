import { describe, expect, it } from 'vitest'
import { readingCatchUpRows } from './vehicleCatchUp'
import type { FleetOdometerEntry, FleetPossession, FleetVehicle } from './vehicleFleet'

const TODAY = '2026-08-22'
const v = (id: string, model: string, vin: string | null = null): FleetVehicle => ({ id, year: 2019, make: 'Ford', model, vin })
const poss = (vehicle_id: string, user_id: string | null): FleetPossession => ({ id: `p-${vehicle_id}`, vehicle_id, user_id, start_date: '2026-01-01', end_date: null, created_at: null })
const read = (vehicle_id: string, read_date: string, odometer_value = 1000): FleetOdometerEntry => ({ id: `r-${vehicle_id}`, vehicle_id, odometer_value, read_date, created_at: null })

describe('readingCatchUpRows', () => {
  it('mirrors the chip: non-fresh only, pool and unassigned included', () => {
    const vehicles = [v('fresh', 'Fresh'), v('stale', 'Stale'), v('never', 'Never'), v('pool', 'Pooled'), v('un', 'Unowned')]
    const holders = new Map([
      ['fresh', poss('fresh', 'u1')],
      ['stale', poss('stale', 'u1')],
      ['never', poss('never', 'u2')],
      ['pool', poss('pool', null)],
    ])
    const latest = new Map([
      ['fresh', read('fresh', '2026-08-20')],
      ['stale', read('stale', '2026-06-01', 56184)],
    ])
    const rows = readingCatchUpRows(vehicles, holders, latest, TODAY)
    expect(rows.map((r) => r.vehicleId)).toEqual(['never', 'pool', 'un', 'stale'])
    expect(rows.find((r) => r.vehicleId === 'stale')!.lastLabel).toBe('56,184 mi · 82d ago')
    expect(rows.find((r) => r.vehicleId === 'never')!.lastLabel).toBe('no reading yet')
    expect(rows.map((r) => r.holderKind)).toEqual(['person', 'pool', 'none', 'person'])
  })

  it('orders never-read first, then stalest, then name', () => {
    const vehicles = [v('a', 'Alpha'), v('b', 'Bravo'), v('c', 'Charlie')]
    const latest = new Map([
      ['a', read('a', '2026-07-01')],
      ['b', read('b', '2026-05-01')],
    ])
    const rows = readingCatchUpRows(vehicles, new Map(), latest, TODAY)
    expect(rows.map((r) => r.vehicleId)).toEqual(['c', 'b', 'a'])
  })
})
