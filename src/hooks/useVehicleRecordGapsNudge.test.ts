import { describe, expect, it } from 'vitest'
import { loadVehicleRecordGaps, type VehicleRecordsClient } from './useVehicleRecordGapsNudge'

type Row = Record<string, unknown>
type Call = { table: string; select: string | null; filters: string[]; range: [number, number] | null }

/**
 * A recording stand-in for the few PostgREST calls the loader makes. `lte` and `in` filter;
 * `or` is recorded only (the kernel applies the dates itself); `range` slices after the filters.
 */
function fakeClient(tables: Record<string, Row[]>, opts: { failTable?: string } = {}) {
  const calls: Call[] = []
  const from = (table: string) => {
    const call: Call = { table, select: null, filters: [], range: null }
    let rows = tables[table] ?? []
    const b = {
      select: (columns: string) => ((call.select = columns), b),
      lte: (col: string, v: string) => (call.filters.push(`${col} <= ${v}`), (rows = rows.filter((r) => String(r[col]) <= v)), b),
      or: (expr: string) => (call.filters.push(`or(${expr})`), b),
      in: (col: string, vals: unknown[]) => (call.filters.push(`${col} in (${vals.length})`), (rows = rows.filter((r) => vals.includes(r[col]))), b),
      order: () => b,
      range: (fromRow: number, to: number) => ((call.range = [fromRow, to]), (rows = rows.slice(fromRow, to + 1)), b),
      then: (resolve: (r: { data: Row[] | null; error: { message: string } | null }) => unknown, reject?: (e: unknown) => unknown) => {
        calls.push(call)
        const r = opts.failTable === table ? { data: null, error: { message: 'boom' } } : { data: rows, error: null }
        return Promise.resolve(r).then(resolve, reject)
      },
    }
    return b
  }
  return { client: { from } as unknown as VehicleRecordsClient, calls }
}

const TODAY = '2026-10-06'
const vehicles = [
  { id: 'ram', year: 2016, make: 'Ford', model: 'F-250', weekly_insurance_cost: 0, weekly_registration_cost: 0 },
  { id: 'f150', year: 2019, make: 'Ford', model: 'F-150', weekly_insurance_cost: 48, weekly_registration_cost: 6 },
  { id: 'pool', year: 2015, make: 'Chevy', model: 'Express', weekly_insurance_cost: 0, weekly_registration_cost: 0 },
]
const possessions = [
  { id: 'p1', vehicle_id: 'ram', user_id: 'u-mal', start_date: '2026-01-01', end_date: null, created_at: null },
  { id: 'p2', vehicle_id: 'f150', user_id: 'u-mic', start_date: '2026-02-01', end_date: null, created_at: null },
  { id: 'p3', vehicle_id: 'pool', user_id: null, start_date: '2026-03-01', end_date: null, created_at: null },
  { id: 'p4', vehicle_id: 'f150', user_id: 'u-old', start_date: '2027-01-01', end_date: null, created_at: null },
]
const insurance = [{ id: 'i1', vehicle_id: 'f150', plan_id: 'plan', start_date: '2026-02-01', end_date: null, created_at: null }]
// 1,200 oil changes on the F-150: the read must page past PostgREST's 1,000-row cap to see it serviced.
const service = Array.from({ length: 1200 }, (_, i) => ({ vehicle_id: i < 1199 ? 'pool' : 'f150' }))
const users = [
  { id: 'u-mal', name: 'Sam P.' },
  { id: 'u-mic', name: 'Lee' },
]

describe('loadVehicleRecordGaps', () => {
  it('reads the fleet as of today and returns the active vehicles missing records', async () => {
    const { client, calls } = fakeClient({ vehicles, vehicle_possessions: possessions, vehicle_insurance_periods: insurance, vehicle_service_events: service, users })
    const gaps = await loadVehicleRecordGaps(TODAY, client)
    expect(gaps).toEqual([{ vehicleId: 'ram', name: '2016 Ford F-250', holderUserId: 'u-mal', holderName: 'Sam P.', missing: ['insurance', 'registration', 'service'], insuranceOnPlan: false }])
    const holds = calls.find((c) => c.table === 'vehicle_possessions')!
    expect(holds.filters).toEqual([`start_date <= ${TODAY}`, `or(end_date.is.null,end_date.gte.${TODAY})`])
    expect(calls.find((c) => c.table === 'vehicle_insurance_periods')!.filters).toEqual(holds.filters)
    // Service only for vehicles a person holds today (the motor pool's van is not asked about), paged.
    const serviceCalls = calls.filter((c) => c.table === 'vehicle_service_events')
    expect(serviceCalls.every((c) => c.filters[0] === 'vehicle_id in (2)')).toBe(true)
    expect(serviceCalls.map((c) => c.select)).toEqual(['vehicle_id'])
  })

  it('pages the service read: a serviced vehicle past the first 1,000 rows still counts', async () => {
    const heldAll = [...possessions, { id: 'p5', vehicle_id: 'pool', user_id: 'u-mic', start_date: '2026-03-02', end_date: null, created_at: null }]
    const { client, calls } = fakeClient({ vehicles, vehicle_possessions: heldAll, vehicle_insurance_periods: insurance, vehicle_service_events: service, users })
    const gaps = await loadVehicleRecordGaps(TODAY, client)
    expect(calls.filter((c) => c.table === 'vehicle_service_events').map((c) => c.range)).toEqual([[0, 999], [1000, 1999]])
    expect(gaps?.map((g) => [g.vehicleId, g.missing])).toEqual([
      ['ram', ['insurance', 'registration', 'service']],
      ['pool', ['insurance', 'registration']],
    ])
  })

  it('is null with nothing missing or no one holding a vehicle, and throws when a read fails', async () => {
    const complete = [{ ...vehicles[1]! }]
    const one = fakeClient({ vehicles: complete, vehicle_possessions: [possessions[1]!], vehicle_insurance_periods: insurance, vehicle_service_events: [{ vehicle_id: 'f150' }], users })
    expect(await loadVehicleRecordGaps(TODAY, one.client)).toBeNull()
    const nobody = fakeClient({ vehicles, vehicle_possessions: [possessions[2]!], vehicle_insurance_periods: [], vehicle_service_events: service, users })
    expect(await loadVehicleRecordGaps(TODAY, nobody.client)).toBeNull()
    expect(nobody.calls.some((c) => c.table === 'vehicle_service_events')).toBe(false)
    await expect(loadVehicleRecordGaps(TODAY, fakeClient({ vehicles, vehicle_possessions: possessions }, { failTable: 'vehicles' }).client)).rejects.toThrow()
  })
})
