// @vitest-environment jsdom
/**
 * A job's trips in the Job window (punch list #379, PR 6): what the hook reads and when. A job with no
 * development, and a reader outside the office door, read nothing. A job on a site with no trip costs the one
 * small read. The clock's rows are read once the site has a trip, and the job's hours only once a trip names
 * the job. The site's point is read from the address the site's jobs and bids share, as the Trips look reads it,
 * and from the job's own address only when that gives nothing. The io is the hook's own seam, and the point of
 * an address is stood in. Every name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { SiteLabor } from '../lib/developments/siteLabor'
import type { JobPunchRow } from '../lib/trips/jobTrips'
import { newTripRecord, type TripRecord } from '../lib/trips/tripRecord'
import { useJobTrips, type JobTripsIo } from './useJobTrips'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const geo: { asked: boolean[]; placed: string[]; point: { lat: number; lng: number } | null } = { asked: [], placed: [], point: { lat: 35.0, lng: -76.6 } }
vi.mock('./useAddressGeocodeCoords', () => ({
  useAddressGeocodeCoords: (addresses: ReadonlyArray<{ key: string; display: string }>, enabled: boolean) => {
    geo.asked.push(enabled)
    if (enabled && addresses[0] && !geo.placed.includes(addresses[0].display)) geo.placed.push(addresses[0].display)
    const coords = new Map<string, { lat: number; lng: number }>()
    if (enabled && geo.point && addresses[0]) coords.set(addresses[0].key, geo.point)
    return { coords, resolving: false }
  },
}))

beforeEach(() => {
  geo.asked.length = 0
  geo.placed.length = 0
  geo.point = { lat: 35.0, lng: -76.6 }
})
afterEach(cleanup)

const TODAY = '2026-11-17'
const JOB = 'j2101'
const person = { personId: 'p-luis', userId: 'u-luis', name: 'Luis' }
// On this job: Luis, Oct 26 on the road, Oct 27 and 28 at the site.
const lifts: TripRecord = { ...newTripRecord({ id: 't5', developmentId: 'd-heron' }), people: [{ ...person, days: { '2026-10-26': 'road', '2026-10-27': 'site', '2026-10-28': 'site' } }], jobIds: [JOB] }
// On the site, with its work on no job.
const meeting: TripRecord = { ...newTripRecord({ id: 't4', developmentId: 'd-heron' }), people: [{ ...person, days: { '2026-06-22': 'site' } }] }
const punch = (id: string, work_date: string, lat: number | null, lng: number | null): JobPunchRow => ({ id, user_id: 'u-luis', work_date, clock_in_lat: lat, clock_in_lng: lng, clock_in_location_source: lat == null ? null : 'gps', arrived_lat: null, arrived_lng: null, arrived_location_source: null, clock_out_lat: null, clock_out_lng: null, clock_out_location_source: null, travel_started_at: null, arrived_at: null })
const labor = (daysKnown = true): SiteLabor => ({
  daysKnown,
  siteDays: 3,
  people: 1,
  byJobId: new Map([[JOB, { jobId: JOB, hours: 24, costUsd: 0, days: 3, people: [{ personName: 'Luis', personId: 'p-luis', userId: 'u-luis', hours: 24, costUsd: 0, days: 3, leadDays: 0, byWorkDate: [{ ymd: '2026-10-12', hours: 4, costUsd: 0 }, { ymd: '2026-10-27', hours: 10, costUsd: 0 }, { ymd: '2026-10-28', hours: 10, costUsd: 0 }] }] }]]),
})

function makeIo(over: Partial<JobTripsIo> = {}): JobTripsIo {
  return {
    readTrips: vi.fn(async () => [lifts]),
    readRoster: vi.fn(async () => [{ id: 'p-luis', name: 'Luis', userId: 'u-luis' }]),
    readPunches: vi.fn(async () => [punch('cs-site', '2026-10-27', 35.004, -76.603), punch('cs-paid', '2026-10-28', null, null), punch('cs-home', '2026-10-12', 35.9, -78.9)]),
    // Two jobs and a bid at the site's road, and this job typed at the shop's own street.
    readSiteAddresses: vi.fn(async () => ({ jobs: [{ job_address: '12 Marsh Road, Tidewater, NC' }, { job_address: '12 Marsh Road, Tidewater, NC' }, { job_address: '4 Shop Street, Garner, NC' }], bids: [{ address: '12 Marsh Road, Tidewater, NC' }] })),
    readLabor: vi.fn(async () => labor()),
    save: vi.fn(async () => undefined),
    ...over,
  }
}
const draw = (io: JobTripsIo, over: Partial<Parameters<typeof useJobTrips>[0]> = {}) => renderHook(() => useJobTrips({ jobId: JOB, developmentId: 'd-heron', address: '4 Shop Street, Garner, NC', enabled: true, todayYmd: TODAY, io, ...over }))

describe('useJobTrips', () => {
  it('reads nothing for a job with no development, and nothing for a reader outside the office door', async () => {
    const io = makeIo()
    const none = draw(io, { developmentId: null })
    const closed = draw(io, { enabled: false })
    await act(async () => {})
    for (const fn of [io.readTrips, io.readRoster, io.readPunches, io.readSiteAddresses, io.readLabor]) expect(fn).not.toHaveBeenCalled()
    expect(geo.asked.every((asked) => !asked)).toBe(true)
    expect(none.result.current).toMatchObject({ records: null, line: null, hours: null })
    expect(closed.result.current.clockTags.size).toBe(0)
  })

  it('costs one small read on a job whose site has no trip', async () => {
    const io = makeIo({ readTrips: vi.fn(async () => []) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.records).toEqual([]))
    expect(io.readTrips).toHaveBeenCalledWith('d-heron', [JOB])
    expect(io.readRoster).not.toHaveBeenCalled()
    expect(io.readPunches).not.toHaveBeenCalled()
    expect(io.readSiteAddresses).not.toHaveBeenCalled()
    expect(io.readLabor).not.toHaveBeenCalled()
    expect(geo.asked.every((asked) => !asked)).toBe(true)
    expect(result.current.line).toBeNull()
    expect(result.current.clockTags.size).toBe(0)
  })

  it('tags the clock lines on a site with a trip that names another job, and reads no hours, since no line shows', async () => {
    const io = makeIo({ readTrips: vi.fn(async () => [meeting]) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.clockTags.size).toBe(3))
    expect(result.current.line).toBeNull()
    // Luis was on no trip on any of these days: each line is at home for the site.
    expect([...result.current.clockTags.values()].map((t) => t.words)).toEqual(['at home for the site', 'at home for the site', 'at home for the site'])
    expect(io.readPunches).toHaveBeenCalledWith([JOB])
    expect(io.readLabor).not.toHaveBeenCalled()
  })

  it('says the line, tags each clock line from its person’s day, and lays the job’s hours over the trips', async () => {
    const io = makeIo()
    const { result } = draw(io)
    await waitFor(() => expect(result.current.hoursState).toBe('read'))
    expect(result.current.line?.words).toBe('1 trip · last Oct 26 to 28, Luis')
    expect(result.current.clockTags.get('cs:cs-site')?.words).toBe('TRIP · AT THE SITE')
    expect(result.current.clockTags.get('cs:cs-paid')?.words).toBe('TRIP · NO PLACE ON THE PUNCH')
    expect(result.current.clockTags.get('cs:cs-home')?.words).toBe('at home for the site')
    expect(io.readLabor).toHaveBeenCalledWith([JOB])
    expect(result.current.hours).toEqual({ site: 10, road: 0, ready: 0, noPlace: 10, home: 4, all: 24, notAtSite: 14 })
    expect(result.current.noSitePoint).toBe(false)
    expect(result.current.roster).toEqual([{ id: 'p-luis', name: 'Luis', userId: 'u-luis' }])
  })

  it('says so when the clock’s days are closed to the reader, and when a read fails', async () => {
    const closed = draw(makeIo({ readLabor: vi.fn(async () => labor(false)) }))
    await waitFor(() => expect(closed.result.current.hoursState).toBe('closed'))
    expect(closed.result.current.hours).toBeNull()
    const failed = draw(
      makeIo({
        readLabor: vi.fn(async () => {
          throw new Error('offline')
        }),
      }),
    )
    await waitFor(() => expect(failed.result.current.hoursState).toBe('failed'))
    expect(failed.result.current.line).not.toBeNull()
  })

  it('reads the site’s point from the address the site’s jobs and bids share, never this job’s own first', async () => {
    const io = makeIo()
    const { result } = draw(io)
    await waitFor(() => expect(result.current.hoursState).toBe('read'))
    expect(io.readSiteAddresses).toHaveBeenCalledWith('d-heron')
    // The job is typed at another street; the point asked for is the site's, and only the site's.
    expect(geo.placed).toEqual(['12 Marsh Road, Tidewater, NC'])
  })

  it('falls back to the job’s own address only when the shared read gives nothing, or fails', async () => {
    const empty = draw(makeIo({ readSiteAddresses: vi.fn(async () => ({ jobs: [{ job_address: null }], bids: [] })) }))
    await waitFor(() => expect(empty.result.current.hoursState).toBe('read'))
    expect(geo.placed).toEqual(['4 Shop Street, Garner, NC'])
    geo.placed.length = 0
    const failed = draw(
      makeIo({
        readSiteAddresses: vi.fn(async () => {
          throw new Error('offline')
        }),
      }),
    )
    await waitFor(() => expect(failed.result.current.hoursState).toBe('read'))
    expect(geo.placed).toEqual(['4 Shop Street, Garner, NC'])
    expect(failed.result.current.clockTags.size).toBe(3)
  })

  it('wears one tag on every punch of a person’s day, the figure the bar counts that day under', async () => {
    const io = makeIo({ readPunches: vi.fn(async () => [punch('cs-site', '2026-10-27', 35.004, -76.603), punch('cs-motel', '2026-10-27', 35.11, -76.75), punch('cs-paid', '2026-10-28', null, null)]) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.hoursState).toBe('read'))
    expect(result.current.clockTags.get('cs:cs-site')?.words).toBe('TRIP · AT THE SITE')
    expect(result.current.clockTags.get('cs:cs-motel')?.words).toBe('TRIP · AT THE SITE')
    expect(result.current.hours).toMatchObject({ site: 10, noPlace: 10 })
  })

  it('checks no punch against a site whose address has no point', async () => {
    geo.point = null
    const { result } = draw(makeIo())
    await waitFor(() => expect(result.current.hoursState).toBe('read'))
    expect(result.current.noSitePoint).toBe(true)
    expect(result.current.hours).toMatchObject({ site: 0, noPlace: 20, home: 4 })
    expect(result.current.clockTags.get('cs:cs-site')?.words).toBe('TRIP · NO PLACE ON THE PUNCH')
  })

  it('leaves the Job window as it was when the trips do not read', async () => {
    const io = makeIo({
      readTrips: vi.fn(async () => {
        throw new Error('offline')
      }),
    })
    const { result } = draw(io)
    await act(async () => {})
    expect(result.current).toMatchObject({ records: null, line: null })
    expect(io.readPunches).not.toHaveBeenCalled()
  })

  it('saves a trip through the one door and says it on the line at once', async () => {
    // What is kept, so the read after the save gives the saved trip back.
    const kept: TripRecord[] = [lifts]
    const io = makeIo({ readTrips: vi.fn(async () => [...kept]), save: vi.fn(async (r: TripRecord) => void kept.push(r)) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.line?.gone).toBe(1))
    const next: TripRecord = { ...newTripRecord({ id: 't6', developmentId: 'd-heron' }), people: [{ ...person, days: { '2026-12-01': 'road', '2026-12-02': 'site' } }], jobIds: [JOB] }
    await act(async () => {
      await result.current.save(next)
    })
    expect(io.save).toHaveBeenCalledWith(next)
    await waitFor(() => expect(io.readTrips).toHaveBeenCalledTimes(2))
    expect(result.current.line?.words).toBe('1 trip · last Oct 26 to 28, Luis · next Dec 1 to 2')
  })
})
