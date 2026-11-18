import { describe, expect, it } from 'vitest'
import { addDays, type Trip, type TripDayKind, type TripDays } from './tripDays'
import { atSiteShare, splitTripHours, tripHourBucket, type TripHourRow } from './tripHours'
import type { TripPlace } from './tripPlace'

/** Days from a first day and one letter a day: g getting ready, r on the road, s at the site, x off. Every name and hour here is made up. */
function days(first: string, letters: string): TripDays {
  const kind: Record<string, TripDayKind> = { g: 'ready', r: 'road', s: 'site' }
  const out: Record<string, TripDayKind> = {}
  ;[...letters].forEach((c, i) => {
    const k = kind[c]
    if (k) out[addDays(first, i)] = k
  })
  return out
}
const person = (personKey: string, first: string, letters: string) => ({ personKey, name: personKey, days: days(first, letters) })
const row = (personKey: string, ymd: string, hours: number, place: TripPlace, jobId: string | null = 'j1'): TripHourRow => ({ personKey, ymd, hours, place, jobId })

// One trip across a month end, with a day off in the middle for Luis; Priya joins on the road.
const trip: Trip = { id: 't1', people: [person('luis', '2026-10-29', 'grssxsr'), person('priya', '2026-10-29', 'xrssssr')] }

describe('which figure an hour is', () => {
  it('is the day’s kind when the punch says where', () => {
    expect(tripHourBucket('site', 'site')).toBe('site')
    expect(tripHourBucket('road', 'elsewhere')).toBe('road')
    expect(tripHourBucket('ready', 'elsewhere')).toBe('ready')
  })

  it('is At the site only when the place is the site: a punch somewhere else on a site day is on the road', () => {
    expect(tripHourBucket('site', 'elsewhere')).toBe('road')
  })

  it('keeps the day’s kind on a road or a ready day even when the punch was at the site', () => {
    expect(tripHourBucket('road', 'site')).toBe('road')
    expect(tripHourBucket('ready', 'site')).toBe('ready')
  })

  it('is No place on the punch for a row with no place, whatever the day was painted', () => {
    expect(tripHourBucket('site', 'none')).toBe('noPlace')
    expect(tripHourBucket('road', 'none')).toBe('noPlace')
    expect(tripHourBucket('ready', 'none')).toBe('noPlace')
  })

  it('is At home for the site outside every trip, wherever the punch was', () => {
    expect(tripHourBucket(null, 'site')).toBe('home')
    expect(tripHourBucket(null, 'elsewhere')).toBe('home')
    expect(tripHourBucket(null, 'none')).toBe('home')
  })
})

describe('a site’s hours over its trips', () => {
  const rows: TripHourRow[] = [
    row('luis', '2026-10-29', 6, 'elsewhere'), // getting ready, loading the trailer
    row('luis', '2026-10-30', 9, 'elsewhere'), // on the road
    row('luis', '2026-10-31', 10, 'site'), // at the site, a punch at the site
    row('luis', '2026-11-01', 10, 'elsewhere'), // a site day, a punch at the supply house in town
    row('luis', '2026-11-02', 3, 'elsewhere'), // his day off in the middle: hours on the job, not on the trip
    row('luis', '2026-11-03', 10, 'none'), // a site day, a row placed from a schedule
    row('luis', '2026-11-04', 9, 'elsewhere'), // driving home
    row('priya', '2026-10-31', 10.5, 'site', 'j2'),
    row('priya', '2026-11-02', 10.5, 'site', 'j2'), // she worked the day he was off
    row('luis', '2026-10-12', 4, 'elsewhere'), // weeks before: ordering, at home for the site
    row('dana', '2026-10-31', 8, 'none'), // never on the trip: takeoffs, at home for the site
    row('luis', '2026-10-31', 0, 'site'), // no hours: skipped
  ]
  const split = splitTripHours({ trips: [trip], rows })

  it('gives each hour one figure, and the figures add up to every hour handed in', () => {
    expect(split.site).toEqual({ site: 31, road: 28, ready: 6, noPlace: 10, home: 15, all: 90, notAtSite: 59 })
    expect(split.site.site + split.site.road + split.site.ready + split.site.noPlace + split.site.home).toBe(split.site.all)
    expect(rows.reduce((s, r) => s + r.hours, 0)).toBe(split.site.all)
  })

  it('never adds a row with no place to At the site', () => {
    expect(split.byTrip.get('t1')?.noPlace).toBe(10)
    expect(split.byTrip.get('t1')?.site).toBe(31)
  })

  it('puts a day off in the middle, and hours outside the trip, At home for the site', () => {
    expect(split.home).toEqual([
      { personKey: 'dana', jobId: 'j1', hours: 8 },
      { personKey: 'luis', jobId: 'j1', hours: 7 },
    ])
  })

  it('totals the trip by person and by job, across the month end', () => {
    const t = split.byTrip.get('t1')
    expect(t).toMatchObject({ site: 31, road: 28, ready: 6, noPlace: 10, all: 75 })
    expect(t?.byPerson.get('luis')).toEqual({ site: 10, road: 28, ready: 6, noPlace: 10, all: 54 })
    expect(t?.byPerson.get('priya')).toEqual({ site: 21, road: 0, ready: 0, noPlace: 0, all: 21 })
    expect([...(t?.byJob ?? [])]).toEqual([
      ['j1', 54],
      ['j2', 21],
    ])
  })

  it('gives each job the same five figures, for the Job window', () => {
    expect(split.byJob.get('j1')).toEqual({ site: 10, road: 28, ready: 6, noPlace: 10, home: 15, all: 69, notAtSite: 59 })
    expect(split.byJob.get('j2')).toEqual({ site: 21, road: 0, ready: 0, noPlace: 0, home: 0, all: 21, notAtSite: 0 })
  })

  it('shares the hours at the site over all of them', () => {
    expect(atSiteShare(split.site)).toBeCloseTo(31 / 90)
    expect(atSiteShare({ site: 0, all: 0 })).toBeNull()
  })
})

describe('edges', () => {
  it('lists a planned trip with zeros, and a site with no trip has every hour at home', () => {
    const planned: Trip = { id: 'p', people: [person('dana', '2026-12-01', 'rsssr')] }
    const split = splitTripHours({ trips: [planned], rows: [row('dana', '2026-11-10', 5, 'none')] })
    expect(split.byTrip.get('p')).toMatchObject({ site: 0, road: 0, ready: 0, noPlace: 0, all: 0 })
    expect(split.site).toMatchObject({ home: 5, all: 5, site: 0 })
    expect(splitTripHours({ trips: [], rows: [row('dana', '2026-11-10', 5, 'site')] }).site).toMatchObject({ home: 5, site: 0, notAtSite: 5 })
  })

  it('counts a person-day two trips claim once, on the trip that went out first', () => {
    const first: Trip = { id: 'a', people: [person('dana', '2026-02-13', 'rss')] }
    const second: Trip = { id: 'b', people: [person('dana', '2026-02-15', 'ss')] }
    const split = splitTripHours({ trips: [second, first], rows: [row('dana', '2026-02-15', 10, 'site'), row('dana', '2026-02-16', 10, 'site')] })
    expect(split.byTrip.get('a')?.all).toBe(10)
    expect(split.byTrip.get('b')?.all).toBe(10)
    expect(split.site.all).toBe(20)
  })

  it('keeps hours with no job, under no job', () => {
    const split = splitTripHours({ trips: [trip], rows: [row('luis', '2026-10-31', 4, 'site', null)] })
    expect([...(split.byTrip.get('t1')?.byJob ?? [])]).toEqual([['', 4]])
    expect(split.byJob.size).toBe(0)
  })

  it('skips a row whose hours are not a number above zero', () => {
    const split = splitTripHours({ trips: [trip], rows: [row('luis', '2026-10-31', Number.NaN, 'site'), row('luis', '2026-10-31', -2, 'site')] })
    expect(split.site.all).toBe(0)
  })
})
