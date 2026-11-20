// @vitest-environment jsdom
/**
 * A site's trips hook (punch list #379), the part PR 5 added: once the look shows it reads the days somebody
 * said were Not a trip and the names of the logins on the punches that have no roster row, and Not a trip
 * and its undo keep what the hook holds in step. The io is the hook's own seam. Every name here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { DeletedTrip } from '../lib/trips/tripDeleted'
import type { PunchRow } from '../lib/trips/tripHourRows'
import type { TripDismissalInsert, TripDismissalRow } from '../lib/trips/tripOffers'
import { newTripRecord, type TripRecord } from '../lib/trips/tripRecord'
import { useSiteTrips, type SiteTripsIo } from './useSiteTrips'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

/** The site's point, stood in for: none unless a case sets one, as before this file asked for any. */
const geo: { point: { lat: number; lng: number } | null } = { point: null }
vi.mock('./useAddressGeocodeCoords', () => ({
  useAddressGeocodeCoords: (addresses: Array<{ key: string }>, enabled: boolean) => {
    const coords = new Map<string, { lat: number; lng: number }>()
    if (enabled && geo.point && addresses[0]) coords.set(addresses[0].key, geo.point)
    return { coords, resolving: false }
  },
}))

afterEach(() => {
  cleanup()
  geo.point = null
})

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

describe('useSiteTrips: the site’s deleted trips', () => {
  const gone = (id: string, tripNumber: number): DeletedTrip => ({
    record: { ...newTripRecord({ id, developmentId: 'd1' }), tripNumber, people: [{ personId: null, userId: null, name: 'Priya', days: { '2026-11-09': 'site' } }] },
    deletedAt: '2026-11-18T16:20:00.000Z',
    deletedByName: 'Dana Office',
    jobsGone: 0,
    joinedInto: null,
  })

  it('reads them beside the trips, and a site whose only trip was deleted still shows its look', async () => {
    const io = makeIo({ readTrips: vi.fn(async () => []), readDeleted: vi.fn(async () => [gone('t3', 3)]) })
    const { result } = draw(io)
    expect(result.current.deletedKnown).toBe(false)
    await waitFor(() => expect(result.current.deleted.map((d) => d.record.id)).toEqual(['t3']))
    expect(io.readDeleted).toHaveBeenCalledWith('d1')
    expect(result.current.deletedKnown).toBe(true)
    expect(result.current.deletedFailed).toBe(false)
    await waitFor(() => expect(result.current.shows).toBe(true))
  })

  it('a near site with no trip, kept or deleted, shows no look', async () => {
    const io = makeIo({ readTrips: vi.fn(async () => []), readDeleted: vi.fn(async () => []) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.deletedKnown).toBe(true))
    await waitFor(() => expect(result.current.records).toEqual([]))
    expect(result.current.shows).toBe(false)
  })

  it('reads none for a reader outside the door, and knows it at once when no read is handed in', async () => {
    const closed = makeIo({ readDeleted: vi.fn(async () => [gone('t3', 3)]) })
    const { result } = draw(closed, false)
    expect(closed.readDeleted).not.toHaveBeenCalled()
    expect(result.current.deleted).toEqual([])
    expect(result.current.deletedKnown).toBe(true)
    const { result: bare } = draw(makeIo())
    expect(bare.current.deletedKnown).toBe(true)
    expect(bare.current.deleted).toEqual([])
  })

  it('says so when they will not read, and the trips still stand', async () => {
    const io = makeIo({ readDeleted: vi.fn(async () => Promise.reject(new Error('lost signal'))) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.deletedFailed).toBe(true))
    expect(result.current.deletedKnown).toBe(true)
    expect(result.current.deleted).toEqual([])
    await waitFor(() => expect(result.current.records).toHaveLength(1))
    expect(result.current.failure).toBeNull()
  })

  it('does not list a trip the site holds again, as after an Undo', async () => {
    const io = makeIo({ readDeleted: vi.fn(async () => [gone('t5', 5), gone('t3', 3)]) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.records).toHaveLength(1))
    await waitFor(() => expect(result.current.deleted.map((d) => d.record.id)).toEqual(['t3']))
  })

  it('reads them again after a delete, and a put back leaves the list at once', async () => {
    const readDeleted = vi.fn<NonNullable<SiteTripsIo['readDeleted']>>().mockResolvedValueOnce([]).mockResolvedValueOnce([gone('t5', 5)]).mockImplementation(() => new Promise<DeletedTrip[]>(() => undefined))
    // The trips read answers with the trip, then without it once it is deleted, then not at all, so what the hook
    // holds after the put back is what the save gave it.
    const readTrips = vi.fn<SiteTripsIo['readTrips']>().mockResolvedValueOnce([lifts]).mockResolvedValueOnce([]).mockImplementation(() => new Promise<TripRecord[]>(() => undefined))
    const io = makeIo({ readTrips, readDeleted })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.deletedKnown).toBe(true))
    await waitFor(() => expect(result.current.records).toHaveLength(1))
    await act(async () => {
      await result.current.remove('t5')
    })
    expect(io.remove).toHaveBeenCalledWith('t5')
    await waitFor(() => expect(result.current.deleted.map((d) => d.record.id)).toEqual(['t5']))
    expect(readDeleted).toHaveBeenCalledTimes(2)
    // Put back is the trip's own save: the trip is held again, so it is not listed, before the next read answers.
    const back = result.current.deleted[0]?.record
    if (!back) throw new Error('no deleted trip')
    await act(async () => {
      await result.current.save(back)
    })
    expect(io.save).toHaveBeenCalledWith(back)
    expect(result.current.deleted).toEqual([])
    expect(result.current.records?.map((r) => r.id)).toContain('t5')
  })
})

describe('useSiteTrips: how far is far (v2.7888, the one setting)', () => {
  // The shop and a site about 104 miles off, both made up: far at 90 miles, near at the default 150.
  const SHOP = { lat: 30, lng: -97 }
  const SITE = { lat: 31.5, lng: -97 }
  const noTrips = (over: Partial<SiteTripsIo> = {}) => makeIo({ readTrips: vi.fn(async () => []), readDeleted: vi.fn(async () => []), readShop: vi.fn(async () => SHOP), ...over })
  const drawAt = (io: SiteTripsIo) => renderHook(() => useSiteTrips({ developmentId: 'd1', jobIds: JOBS, address: '1 Heron Point Rd', enabled: true, io }))

  it('a site with no trip shows its look once it is as far as the setting says', async () => {
    geo.point = SITE
    const io = noTrips({ readFarMiles: vi.fn(async () => 90) })
    const { result } = drawAt(io)
    await waitFor(() => expect(result.current.shows).toBe(true))
    expect(io.readFarMiles).toHaveBeenCalledTimes(1)
    expect(Math.round(result.current.miles ?? 0)).toBe(104)
  })

  it('the same site shows no look at the default, when no setting is read or the read fails', async () => {
    geo.point = SITE
    const plain = noTrips()
    const a = drawAt(plain)
    await waitFor(() => expect(Math.round(a.result.current.miles ?? 0)).toBe(104))
    expect(a.result.current.shows).toBe(false)
    a.unmount()

    const failing = noTrips({
      readFarMiles: vi.fn(async () => {
        throw new Error('no signal')
      }),
    })
    const b = drawAt(failing)
    await waitFor(() => expect(Math.round(b.result.current.miles ?? 0)).toBe(104))
    expect(b.result.current.shows).toBe(false)
  })

  it('the miles stay unknown until the setting is in, so the default never calls a site far first', async () => {
    geo.point = { lat: 32.5, lng: -97 } // about 173 miles: far at the default, near at 300
    let settle: (miles: number) => void = () => undefined
    const io = noTrips({ readFarMiles: vi.fn(() => new Promise<number>((res) => (settle = res))) })
    const { result } = drawAt(io)
    await waitFor(() => expect(result.current.records).toEqual([]))
    await act(async () => undefined)
    expect(result.current.miles).toBeNull()
    expect(result.current.shows).toBe(false)
    await act(async () => settle(300))
    await waitFor(() => expect(Math.round(result.current.miles ?? 0)).toBe(173))
    expect(result.current.shows).toBe(false)
  })
})

describe('useSiteTrips: Split in two (v2.7891)', () => {
  it('splits through the io, hands back the trip kept and the trip made, and reads the trips again', async () => {
    const io = makeIo({ split: vi.fn(async () => ({ dry_run: false, did: 'split', trip_id: 't5', trip_number: 5, new_trip_id: 't9', new_trip_number: 9 })) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.records).toEqual([lifts]))
    expect(io.readTrips).toHaveBeenCalledTimes(1)
    let reply: unknown
    await act(async () => {
      reply = await result.current.split('t5', '2026-11-03')
    })
    expect(io.split).toHaveBeenCalledWith('t5', '2026-11-03')
    expect(reply).toEqual({ tripId: 't5', tripNumber: 5, newTripId: 't9', newTripNumber: 9 })
    await waitFor(() => expect(io.readTrips).toHaveBeenCalledTimes(2))
  })

  it('passes a refusal on with its words, and reads nothing again', async () => {
    const io = makeIo({ split: vi.fn(async () => Promise.reject(new Error('Pick a later day. No day of this trip is before 2026-10-30.'))) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.records).toEqual([lifts]))
    await expect(result.current.split('t5', '2026-10-30')).rejects.toThrow('Pick a later day.')
    expect(io.readTrips).toHaveBeenCalledTimes(1)
  })

  it('says so on a screen that was handed no split', async () => {
    const { result } = draw(makeIo())
    await waitFor(() => expect(result.current.records).toEqual([lifts]))
    await expect(result.current.split('t5', '2026-11-03')).rejects.toThrow('This screen cannot split a trip.')
  })
})

describe('useSiteTrips: Join with the next (v2.7963)', () => {
  it('joins through the io with both ids, hands back the trip kept and the trip that went, and reads the trips again', async () => {
    const io = makeIo({ join: vi.fn(async () => ({ dry_run: false, did: 'join', trip_id: 't5', trip_number: 5, gone_trip_id: 't9', gone_trip_number: 9, line: 'none' })) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.records).toEqual([lifts]))
    expect(io.readTrips).toHaveBeenCalledTimes(1)
    let reply: unknown
    await act(async () => {
      reply = await result.current.join('t5', 't9')
    })
    expect(io.join).toHaveBeenCalledWith('t5', 't9')
    expect(reply).toEqual({ tripId: 't5', tripNumber: 5, goneTripId: 't9', goneTripNumber: 9, line: 'none' })
    await waitFor(() => expect(io.readTrips).toHaveBeenCalledTimes(2))
  })

  it('passes a refusal on with its words, and reads nothing again', async () => {
    const io = makeIo({ join: vi.fn(async () => Promise.reject(new Error('That is not the next trip on this site any more. Close this and look again.'))) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.records).toEqual([lifts]))
    await expect(result.current.join('t5', 't9')).rejects.toThrow('That is not the next trip on this site any more.')
    expect(io.readTrips).toHaveBeenCalledTimes(1)
  })

  it('says so on a screen that was handed no join', async () => {
    const { result } = draw(makeIo())
    await waitFor(() => expect(result.current.records).toEqual([lifts]))
    await expect(result.current.join('t5', 't9')).rejects.toThrow('This screen cannot join trips.')
  })
})
