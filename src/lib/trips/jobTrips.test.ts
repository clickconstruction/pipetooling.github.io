import { describe, expect, it } from 'vitest'
import type { SiteLabor } from '../developments/siteLabor'
import { clockSessionsToActivityItems } from '../jobThreadClockActivity'
import { asksForTripsLook, clockLineKey, clockTripTag, CLOCK_TRIP_TAG_WORDS, jobClockTags, jobTripHours, jobTripsLine, TRIP_GONE_WORDS, tripHref, tripIdAsked, tripRowAnchor, tripRowAsked, tripsLookHref, tripsOnJob, type JobPunchRow } from './jobTrips'
import { addDays, sortTrips, type TripDayKind } from './tripDays'
import { newTripRecord, tripOfRecord, tripPeopleIndex, type TripRecord } from './tripRecord'

// Every name, site, job, day and hour here is made up: Heron Point, job J2101.
const TODAY = '2026-11-17'
const JOB = 'j2101'
const OTHER_JOB = 'j2140'
const site = { lat: 35.0, lng: -76.6 }

function days(first: string, letters: string): Record<string, TripDayKind> {
  const kind: Record<string, TripDayKind> = { g: 'ready', r: 'road', s: 'site' }
  const out: Record<string, TripDayKind> = {}
  ;[...letters].forEach((c, i) => {
    const k = kind[c]
    if (k) out[addDays(first, i)] = k
  })
  return out
}
type Who = [name: string, letters: string, personId?: string, userId?: string]
const trip = (id: string, first: string, people: Who[], jobIds: string[]): TripRecord => ({
  ...newTripRecord({ id, developmentId: 'd-heron' }),
  people: people.map(([name, letters, personId, userId]) => ({ personId: personId ?? null, userId: userId ?? null, name, days: days(first, letters) })),
  jobIds,
})

const roughIn = trip('t2', '2026-03-06', [['Dana', 'ggrsssr'], ['Luis', 'xxrsssr', 'p-luis', 'u-luis']], [JOB])
const meeting = trip('t4', '2026-06-22', [['Dana', 'rssr']], [])
const lifts = trip('t5', '2026-10-23', [['Luis', 'gxxrssssssssr', 'p-luis', 'u-luis'], ['Priya', 'xxxrssssssssr', 'p-priya', 'u-priya']], [JOB, OTHER_JOB])
const trim = trip('t6', '2026-12-01', [['Dana', 'rsssr'], ['Luis', 'rsssr', 'p-luis', 'u-luis']], [JOB])
const later = trip('t7', '2027-01-11', [['Dana', 'rsr']], [JOB])
const records = [trim, lifts, meeting, roughIn, later]

describe('the trips whose work goes on a job', () => {
  it('are the ones that name it', () => {
    expect(tripsOnJob(records, JOB).map((r) => r.id).sort()).toEqual(['t2', 't5', 't6', 't7'])
    expect(tripsOnJob(records, OTHER_JOB).map((r) => r.id)).toEqual(['t5'])
    expect(tripsOnJob(records, 'j-none')).toEqual([])
  })
})

describe('the line a job says about its trips', () => {
  it('counts the trips that went out, names the newest with who went, and the first planned one', () => {
    const line = jobTripsLine({ records, jobId: JOB, todayYmd: TODAY })
    expect(line?.words).toBe('2 trips · last Oct 23 to Nov 4, Luis, Priya · next Dec 1 to 5')
    expect(line).toMatchObject({ gone: 2, count: '2 trips', last: 'last Oct 23 to Nov 4, Luis, Priya', next: 'next Dec 1 to 5' })
  })

  it('names the newest and the next by their numbers, and hands over each one’s trip for its door', () => {
    const numbered = [{ ...trim, tripNumber: 6 }, { ...lifts, tripNumber: 5 }, meeting, { ...roughIn, tripNumber: 2 }, { ...later, tripNumber: 7 }]
    const line = jobTripsLine({ records: numbered, jobId: JOB, todayYmd: TODAY })
    expect(line?.words).toBe('2 trips · last Trip 5, Oct 23 to Nov 4, Luis, Priya · next Trip 6, Dec 1 to 5')
    expect(line).toMatchObject({ last: 'last Trip 5, Oct 23 to Nov 4, Luis, Priya', lastTripId: 't5', lastDoor: 'Open Trip 5', next: 'next Trip 6, Dec 1 to 5', nextTripId: 't6', nextDoor: 'Open Trip 6' })
  })

  it('hands over the trips of a line made before numbers too, by their days', () => {
    expect(jobTripsLine({ records, jobId: JOB, todayYmd: TODAY })).toMatchObject({ lastTripId: 't5', lastDoor: 'Open this trip', nextTripId: 't6', nextDoor: 'Open this trip' })
    expect(jobTripsLine({ records: [trim], jobId: JOB, todayYmd: TODAY })).toMatchObject({ lastTripId: null, lastDoor: null, nextTripId: 't6' })
    expect(jobTripsLine({ records: [roughIn], jobId: JOB, todayYmd: TODAY })).toMatchObject({ lastTripId: 't2', nextTripId: null, nextDoor: null })
  })

  it('says one trip in the singular', () => {
    expect(jobTripsLine({ records: [lifts], jobId: OTHER_JOB, todayYmd: TODAY })?.words).toBe('1 trip · last Oct 23 to Nov 4, Luis, Priya')
  })

  it('leaves out a part that does not exist', () => {
    expect(jobTripsLine({ records: [trim], jobId: JOB, todayYmd: TODAY })).toMatchObject({ gone: 0, count: null, last: null, words: 'next Dec 1 to 5' })
    expect(jobTripsLine({ records: [roughIn], jobId: JOB, todayYmd: TODAY })).toMatchObject({ next: null, words: '1 trip · last Mar 6 to 12, Dana, Luis' })
  })

  it('says a trip that is out today is out now', () => {
    expect(jobTripsLine({ records: [lifts], jobId: JOB, todayYmd: '2026-10-30' })?.words).toBe('1 trip · out now Oct 23 to Nov 4, Luis, Priya')
  })

  it('is nothing on a job no trip names, whatever the site holds', () => {
    expect(jobTripsLine({ records, jobId: 'j-none', todayYmd: TODAY })).toBeNull()
    expect(jobTripsLine({ records: [meeting], jobId: JOB, todayYmd: TODAY })).toBeNull()
    expect(jobTripsLine({ records: [], jobId: JOB, todayYmd: TODAY })).toBeNull()
  })
})

describe('the tag on a clock line', () => {
  const index = tripPeopleIndex([
    { id: 'p-luis', name: 'Luis', userId: 'u-luis' },
    { id: 'p-priya', name: 'Priya', userId: 'u-priya' },
    { id: 'p-dana', name: 'Dana', userId: 'u-dana' },
  ])
  const tripsInOrder = sortTrips([lifts, trim].map((r) => tripOfRecord(r, index)))
  const tag = (personKey: string, ymd: string, place: 'site' | 'elsewhere' | 'none') => clockTripTag({ tripsInOrder, personKey, ymd, place })

  it('is the figure the hours split gives that person’s day', () => {
    // Luis: Oct 23 getting ready, Oct 26 on the road, Oct 27 at the site.
    expect(tag('p:p-luis', '2026-10-27', 'site')).toEqual({ bucket: 'site', words: 'TRIP · AT THE SITE', quiet: false })
    expect(tag('p:p-luis', '2026-10-26', 'elsewhere')).toEqual({ bucket: 'road', words: 'TRIP · ON THE ROAD', quiet: false })
    expect(tag('p:p-luis', '2026-10-23', 'elsewhere')).toEqual({ bucket: 'ready', words: 'TRIP · GETTING READY', quiet: false })
  })

  it('reads On the road for a punch away from the site on a day painted At the site', () => {
    expect(tag('p:p-luis', '2026-10-27', 'elsewhere')?.words).toBe('TRIP · ON THE ROAD')
  })

  it('says a day with no place has none, whatever the day was painted', () => {
    expect(tag('p:p-luis', '2026-10-27', 'none')).toEqual({ bucket: 'noPlace', words: 'TRIP · NO PLACE ON THE PUNCH', quiet: false })
    expect(tag('p:p-luis', '2026-10-26', 'none')?.bucket).toBe('noPlace')
  })

  it('is the quiet chip for a person on no trip that day', () => {
    expect(tag('p:p-dana', '2026-10-12', 'elsewhere')).toEqual({ bucket: 'home', words: 'at home for the site', quiet: true })
    // Luis was off the trip on Oct 24, a day in its middle.
    expect(tag('p:p-luis', '2026-10-24', 'none')?.words).toBe('at home for the site')
  })

  it('is nothing on a site with no trip, so a local job’s lines never change', () => {
    expect(clockTripTag({ tripsInOrder: [], personKey: 'p:p-luis', ymd: '2026-10-27', place: 'site' })).toBeNull()
  })

  it('has words for every figure', () => {
    expect(Object.keys(CLOCK_TRIP_TAG_WORDS).sort()).toEqual(['home', 'noPlace', 'ready', 'road', 'site'])
  })

  const punch = (over: Partial<JobPunchRow>): JobPunchRow => ({ id: 'cs-1', user_id: 'u-luis', work_date: '2026-10-27', clock_in_lat: null, clock_in_lng: null, clock_in_location_source: null, arrived_lat: null, arrived_lng: null, arrived_location_source: null, clock_out_lat: null, clock_out_lng: null, clock_out_location_source: null, travel_started_at: null, arrived_at: null, ...over })

  it('tags each clock row from its person’s whole day, under the key the feed gives the row', () => {
    const tags = jobClockTags({
      records: [lifts, trim],
      index,
      site,
      punches: [
        punch({ id: 'cs-site', clock_in_lat: 35.004, clock_in_lng: -76.603, clock_in_location_source: 'gps' }),
        // The same person and day, a second row at the motel eleven miles off, and a third with no place: one day, one tag.
        punch({ id: 'cs-motel', clock_in_lat: 35.11, clock_in_lng: -76.75, clock_in_location_source: 'gps' }),
        punch({ id: 'cs-paid' }),
        // The next day, painted At the site, with one punch at the motel: out on the trip and not at the site.
        punch({ id: 'cs-away', work_date: '2026-10-28', clock_in_lat: 35.11, clock_in_lng: -76.75, clock_in_location_source: 'gps' }),
        // A day with no place on any punch.
        punch({ id: 'cs-none', work_date: '2026-10-29' }),
        punch({ id: 'cs-dana', user_id: 'u-dana', work_date: '2026-10-12' }),
      ],
    })
    expect(tags.get('cs:cs-site')?.words).toBe('TRIP · AT THE SITE')
    expect(tags.get('cs:cs-motel')?.words).toBe('TRIP · AT THE SITE')
    expect(tags.get('cs:cs-paid')?.words).toBe('TRIP · AT THE SITE')
    expect(tags.get('cs:cs-away')?.words).toBe('TRIP · ON THE ROAD')
    expect(tags.get('cs:cs-none')?.words).toBe('TRIP · NO PLACE ON THE PUNCH')
    expect(tags.get('cs:cs-dana')?.words).toBe('at home for the site')
  })

  it('tags nothing on a site with no trip', () => {
    expect(jobClockTags({ records: [], index, site, punches: [punch({})] }).size).toBe(0)
  })

  it('names a clock row the way the feed does', () => {
    const [item] = clockSessionsToActivityItems([{ id: 'cs-1', user_id: 'u-luis', clocked_in_at: '2026-10-27T12:00:00Z', clocked_out_at: null, work_date: '2026-10-27', notes: null, approved_at: null, rejected_at: null, users: { name: 'Luis' } }])
    expect(item?.clock.dedupeKey).toBe(clockLineKey('cs-1'))
  })
})

describe('a job’s hours in the five figures', () => {
  const index = tripPeopleIndex([
    { id: 'p-luis', name: 'Luis', userId: 'u-luis' },
    { id: 'p-dana', name: 'Dana', userId: 'u-dana' },
  ])
  const person = (personName: string, personId: string, userId: string, byWorkDate: Array<[string, number]>) => ({ personName, personId, userId, hours: byWorkDate.reduce((s, d) => s + d[1], 0), costUsd: 0, days: byWorkDate.length, leadDays: 0, byWorkDate: byWorkDate.map(([ymd, hours]) => ({ ymd, hours, costUsd: 0 })) })
  const labor = (daysKnown = true): SiteLabor => ({
    daysKnown,
    siteDays: 5,
    people: 2,
    byJobId: new Map([
      [JOB, { jobId: JOB, hours: 39.5, costUsd: 0, days: 5, people: [person('Luis', 'p-luis', 'u-luis', [['2026-10-23', 6], ['2026-10-26', 9], ['2026-10-27', 10.5], ['2026-10-28', 10]]), person('Dana', 'p-dana', 'u-dana', [['2026-10-12', 4]])] }],
    ]),
  })
  const punch = (work_date: string, lat: number | null, lng: number | null): JobPunchRow => ({ id: `cs-${work_date}`, user_id: 'u-luis', work_date, clock_in_lat: lat, clock_in_lng: lng, clock_in_location_source: lat == null ? null : 'gps', arrived_lat: null, arrived_lng: null, arrived_location_source: null, clock_out_lat: null, clock_out_lng: null, clock_out_location_source: null, travel_started_at: null, arrived_at: null })
  const punches = [punch('2026-10-23', 35.9, -78.9), punch('2026-10-26', 35.4, -77.6), punch('2026-10-27', 35.004, -76.603)]

  it('lays the job’s hours over the site’s trips, and they add up to the hours handed in', () => {
    const h = jobTripHours({ records: [lifts], index, labor: labor(), punches, site, jobId: JOB })
    // Oct 28 is painted At the site with no punch behind it: no place, never added to At the site.
    expect(h).toEqual({ site: 10.5, road: 9, ready: 6, noPlace: 10, home: 4, all: 39.5, notAtSite: 29 })
  })

  it('is zeros for a job with no hours yet', () => {
    expect(jobTripHours({ records: [lifts], index, labor: labor(), punches, site, jobId: 'j-none' })).toMatchObject({ all: 0, site: 0, home: 0 })
  })

  it('a tag never disagrees with the bar: each punch wears the figure its day’s hours are counted under', () => {
    // Two punches on Oct 27, one at the site and one far off, and a day with a punch that carries no place.
    const all = [...punches, punch('2026-10-27', 35.4, -77.6), punch('2026-10-28', null, null)].map((p, i) => ({ ...p, id: `cs-${i}` }))
    const h = jobTripHours({ records: [lifts], index, labor: labor(), punches: all, site, jobId: JOB })
    const tags = jobClockTags({ records: [lifts], index, punches: all, site })
    const hoursOn: Record<string, number> = { '2026-10-23': 6, '2026-10-26': 9, '2026-10-27': 10.5, '2026-10-28': 10 }
    const byBucket: Record<string, number> = {}
    const seen = new Set<string>()
    for (const p of all) {
      const bucket = tags.get(clockLineKey(p.id))?.bucket ?? 'missing'
      // Every row of one day wears one tag, so the day's hours are added once.
      if (seen.has(p.work_date)) continue
      seen.add(p.work_date)
      byBucket[bucket] = (byBucket[bucket] ?? 0) + (hoursOn[p.work_date] ?? 0)
    }
    expect(new Set(all.filter((p) => p.work_date === '2026-10-27').map((p) => tags.get(clockLineKey(p.id))?.bucket))).toEqual(new Set(['site']))
    expect(byBucket).toEqual({ site: h?.site, road: h?.road, ready: h?.ready, noPlace: h?.noPlace })
  })

  it('is not known when the clock’s days are closed to the reader', () => {
    expect(jobTripHours({ records: [lifts], index, labor: labor(false), punches, site, jobId: JOB })).toBeNull()
  })
})

describe('the door to the site’s trips', () => {
  it('lands the Development page on its Trips look', () => {
    expect(tripsLookHref('d-heron')).toBe('/developments/d-heron?look=trips')
    expect(asksForTripsLook(new URLSearchParams('look=trips'))).toBe(true)
    expect(asksForTripsLook(new URLSearchParams('look=plans'))).toBe(false)
    expect(asksForTripsLook(new URLSearchParams(''))).toBe(false)
  })

  it('opens one trip on the Development page, which is the Trips look too', () => {
    expect(tripHref('d-heron', 't5')).toBe('/developments/d-heron?trip=t5')
    expect(tripHref('d heron', 't/5')).toBe('/developments/d%20heron?trip=t%2F5')
    expect(tripIdAsked(new URLSearchParams('trip=t5'))).toBe('t5')
    expect(tripIdAsked(new URLSearchParams(tripHref('d-heron', 't/5').split('?')[1]))).toBe('t/5')
    expect(tripIdAsked(new URLSearchParams('trip='))).toBeNull()
    expect(tripIdAsked(new URLSearchParams('look=trips'))).toBeNull()
    expect(asksForTripsLook(new URLSearchParams('trip=t5'))).toBe(true)
    expect(asksForTripsLook(new URLSearchParams('trip='))).toBe(false)
    expect(TRIP_GONE_WORDS).toBe('That trip is no longer here.')
  })

  it('names the row a link lands on', () => {
    expect(tripRowAnchor('t5')).toBe('development-trip-t5')
    expect(tripRowAsked(new URLSearchParams('trip=t5'))).toBe('development-trip-t5')
    expect(tripRowAsked(new URLSearchParams('look=trips'))).toBeNull()
  })
})
