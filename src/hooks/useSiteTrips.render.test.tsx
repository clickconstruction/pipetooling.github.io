// @vitest-environment jsdom
/**
 * A site's trips hook (punch list #379), the part PR 5 added: once the look shows it reads the days somebody
 * said were Not a trip and the names of the logins on the punches that have no roster row, and Not a trip
 * and its undo keep what the hook holds in step. The io is the hook's own seam. Every name here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { PunchRow } from '../lib/trips/tripHourRows'
import type { TripDismissalInsert, TripDismissalRow } from '../lib/trips/tripOffers'
import { newTripRecord, type TripRecord } from '../lib/trips/tripRecord'
import { useSiteTrips, type SiteTripsIo } from './useSiteTrips'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const lifts: TripRecord = { ...newTripRecord({ id: 't5', developmentId: 'd1' }), people: [{ personId: 'p-luis', userId: 'u-luis', name: 'Luis', days: { '2026-10-31': 'site' } }] }
const punch = (user_id: string, work_date: string): PunchRow => ({ user_id, work_date, clock_in_lat: null, clock_in_lng: null, clock_in_location_source: null, arrived_lat: null, arrived_lng: null, arrived_location_source: null, clock_out_lat: null, clock_out_lng: null, clock_out_location_source: null, travel_started_at: null, arrived_at: null })
const kept: TripDismissalRow = { id: 'x0', development_id: 'd1', job_id: null, person_id: 'p-luis', user_id: 'u-luis', person_name: 'Luis', first_day: '2026-08-03', last_day: '2026-08-04' }
const asked: TripDismissalInsert = { development_id: 'd1', job_id: null, person_id: null, user_id: 'u-omar', person_name: 'Omar', first_day: '2026-09-08', last_day: '2026-09-11' }
const JOBS = ['j1']

function makeIo(over: Partial<SiteTripsIo> = {}): SiteTripsIo {
  return {
    readTrips: vi.fn(async () => [lifts]),
    readRoster: vi.fn(async () => [{ id: 'p-luis', name: 'Luis', userId: 'u-luis' }]),
    readPunches: vi.fn(async () => [punch('u-luis', '2026-10-31'), punch('u-omar', '2026-09-08'), punch('u-omar', '2026-09-09')]),
    readShop: vi.fn(async () => null),
    readDismissals: vi.fn(async () => [kept]),
    readNames: vi.fn(async () => new Map([['u-omar', 'Omar']])),
    save: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    dismiss: vi.fn(async (rows: ReadonlyArray<TripDismissalInsert>) => rows.map((r, i) => ({ id: `x${i + 1}`, ...r }))),
    undismiss: vi.fn(async () => undefined),
    ...over,
  }
}
const draw = (io: SiteTripsIo, enabled = true) => renderHook(() => useSiteTrips({ developmentId: 'd1', jobIds: JOBS, address: null, enabled, io }))

describe('useSiteTrips: Not a trip, and the names behind an offer', () => {
  it('reads the site’s Not a trip days once the look shows, and the names of the logins with no roster row', async () => {
    const io = makeIo()
    const { result } = draw(io)
    expect(result.current.dismissals).toBeNull()
    await waitFor(() => expect(result.current.dismissals).toEqual([kept]))
    expect(io.readDismissals).toHaveBeenCalledWith('d1')
    await waitFor(() => expect(result.current.names.get('u-omar')).toBe('Omar'))
    // Luis is on the roster, so only Omar's login is asked for.
    expect(io.readNames).toHaveBeenCalledWith(['u-omar'])
  })

  it('reads neither on a site whose look does not show, or for a reader outside the door', async () => {
    const io = makeIo({ readTrips: vi.fn(async () => []) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.records).toEqual([]))
    expect(io.readDismissals).not.toHaveBeenCalled()
    expect(io.readNames).not.toHaveBeenCalled()
    const closed = makeIo()
    draw(closed, false)
    expect(closed.readTrips).not.toHaveBeenCalled()
    expect(closed.readDismissals).not.toHaveBeenCalled()
  })

  it('asks for no name when every login on the punches is on the roster', async () => {
    const io = makeIo({ readPunches: vi.fn(async () => [punch('u-luis', '2026-10-31')]) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.punches).toHaveLength(1))
    await waitFor(() => expect(result.current.roster).toHaveLength(1))
    expect(io.readNames).not.toHaveBeenCalled()
    expect(result.current.names.size).toBe(0)
  })

  it('leaves Not a trip unknown when it will not read, so nothing is offered twice', async () => {
    const io = makeIo({ readDismissals: vi.fn(async () => Promise.reject(new Error('no'))) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.punches).toHaveLength(3))
    expect(result.current.dismissals).toBeNull()
  })

  it('keeps Not a trip and hands back the rows made, and the undo takes those rows out again', async () => {
    const io = makeIo()
    const { result } = draw(io)
    await waitFor(() => expect(result.current.dismissals).toEqual([kept]))
    let made: TripDismissalRow[] = []
    await act(async () => {
      made = await result.current.dismiss([asked])
    })
    expect(io.dismiss).toHaveBeenCalledWith([asked])
    expect(made).toEqual([{ id: 'x1', ...asked }])
    expect(result.current.dismissals).toEqual([kept, { id: 'x1', ...asked }])
    await act(async () => {
      await result.current.undismiss(made.map((r) => r.id))
    })
    expect(io.undismiss).toHaveBeenCalledWith(['x1'])
    expect(result.current.dismissals).toEqual([kept])
  })

  it('gives a saved trip the number the database handed out, at once, before the read that follows', async () => {
    // The second read never answers here, so what the hook holds is what the save's reply gave it.
    const readTrips = vi.fn<SiteTripsIo['readTrips']>().mockResolvedValueOnce([lifts]).mockImplementation(() => new Promise<TripRecord[]>(() => undefined))
    const io = makeIo({ readTrips, save: vi.fn(async () => 6) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.records).toHaveLength(1))
    const next: TripRecord = { ...newTripRecord({ id: 't6', developmentId: 'd1' }), people: [{ personId: null, userId: null, name: 'Dana', days: { '2026-12-01': 'road' } }] }
    await act(async () => {
      await result.current.save(next)
    })
    expect(io.save).toHaveBeenCalledWith(next)
    expect(result.current.records?.map((r) => [r.id, r.tripNumber])).toEqual([['t5', null], ['t6', 6]])
    expect(readTrips).toHaveBeenCalledTimes(2)
  })

  it('keeps a saved trip as it was sent when the reply names no number', async () => {
    const readTrips = vi.fn<SiteTripsIo['readTrips']>().mockResolvedValueOnce([lifts]).mockImplementation(() => new Promise<TripRecord[]>(() => undefined))
    const io = makeIo({ readTrips })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.records).toHaveLength(1))
    await act(async () => {
      await result.current.save({ ...lifts, tripNumber: 5, purpose: 'Lift stations' })
    })
    expect(result.current.records).toEqual([{ ...lifts, tripNumber: 5, purpose: 'Lift stations' }])
  })

  it('keeps what it holds when Not a trip fails, and passes the reason on', async () => {
    const io = makeIo({ dismiss: vi.fn(async () => Promise.reject(new Error('Not a trip is said by the office or a leader.'))) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.dismissals).toEqual([kept]))
    await expect(result.current.dismiss([asked])).rejects.toThrow('Not a trip is said by the office or a leader.')
    expect(result.current.dismissals).toEqual([kept])
  })
})
