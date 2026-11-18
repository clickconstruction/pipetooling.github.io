import { describe, expect, it } from 'vitest'
import type { SiteLabor } from '../developments/siteLabor'
import { placeKey, placesByPersonDay, pointsOfPunch, tripHourRowsFromLabor, type PunchRow } from './tripHourRows'
import { tripPeopleIndex } from './tripRecord'

// Made-up points and people: a site, a motel about eleven miles off, a shop far away.
const site = { lat: 35.0, lng: -76.6 }
const index = tripPeopleIndex([{ id: 'p-luis', name: 'Luis Ortega', userId: 'u-luis' }])
const punch = (over: Partial<PunchRow>): PunchRow => ({ user_id: 'u-luis', work_date: '2026-10-31', clock_in_lat: null, clock_in_lng: null, clock_in_location_source: null, arrived_lat: null, arrived_lng: null, arrived_location_source: null, clock_out_lat: null, clock_out_lng: null, clock_out_location_source: null, ...over })

describe('the places a punch carries', () => {
  it('reads clock in, arrival and clock out, a network guess marked rough', () => {
    expect(pointsOfPunch(punch({ clock_in_lat: 35.11, clock_in_lng: -76.75, clock_in_location_source: 'ip', arrived_lat: 35.004, arrived_lng: -76.603, arrived_location_source: 'gps' }))).toEqual([
      { lat: 35.11, lng: -76.75, rough: true },
      { lat: 35.004, lng: -76.603, rough: false },
      null,
    ])
  })
})

describe('a person’s day against the site', () => {
  const places = placesByPersonDay(
    [
      punch({ work_date: '2026-10-31', clock_in_lat: 35.11, clock_in_lng: -76.75, clock_in_location_source: 'gps' }),
      punch({ work_date: '2026-10-31', arrived_lat: 35.004, arrived_lng: -76.603, arrived_location_source: 'gps' }),
      punch({ work_date: '2026-11-01', clock_in_lat: 35.11, clock_in_lng: -76.75, clock_in_location_source: 'gps' }),
      punch({ work_date: '2026-11-02' }),
      punch({ user_id: 'u-other', work_date: '2026-10-31', clock_in_lat: 35.0, clock_in_lng: -76.6, clock_in_location_source: 'gps' }),
    ],
    site,
    index,
  )

  it('is At the site when any punch that day was, under the roster person the login belongs to', () => {
    expect(places.get(placeKey('p:p-luis', '2026-10-31'))).toBe('site')
  })

  it('is Elsewhere on a day of punches away from it, and no place on a day of punches with none', () => {
    expect(places.get(placeKey('p:p-luis', '2026-11-01'))).toBe('elsewhere')
    expect(places.get(placeKey('p:p-luis', '2026-11-02'))).toBe('none')
  })

  it('keeps a login with no roster person under the login', () => {
    expect(places.get(placeKey('u:u-other', '2026-10-31'))).toBe('site')
  })

  it('checks nothing when the site has no point', () => {
    expect([...placesByPersonDay([punch({ clock_in_lat: 35.0, clock_in_lng: -76.6, clock_in_location_source: 'gps' })], null, index).values()]).toEqual(['none'])
  })
})

describe('the site’s hours as rows', () => {
  const labor: SiteLabor = {
    byJobId: new Map([
      ['j1', { jobId: 'j1', hours: 20, costUsd: 0, days: 2, people: [{ personName: 'Luis Ortega', personId: 'p-luis', userId: 'u-luis', hours: 20, costUsd: 0, days: 2, leadDays: 0, byWorkDate: [{ ymd: '2026-10-31', hours: 10, costUsd: 0 }, { ymd: '2026-11-03', hours: 10, costUsd: 0 }, { ymd: '2026-11-04', hours: 0, costUsd: 0 }] }] }],
      ['j2', { jobId: 'j2', hours: 4, costUsd: 0, days: 1, people: [{ personName: 'Walt (sub)', personId: null, userId: null, hours: 4, costUsd: 0, days: 1, leadDays: 0, byWorkDate: [{ ymd: '2026-10-31', hours: 4, costUsd: 0 }] }] }],
    ]),
    siteDays: 2,
    people: 2,
    daysKnown: true,
  }
  const places = new Map([[placeKey('p:p-luis', '2026-10-31'), 'site' as const]])

  it('makes one row for each person, job and day, with the day’s place', () => {
    expect(tripHourRowsFromLabor(labor, index, places)).toEqual([
      { personKey: 'p:p-luis', ymd: '2026-10-31', hours: 10, jobId: 'j1', place: 'site' },
      { personKey: 'p:p-luis', ymd: '2026-11-03', hours: 10, jobId: 'j1', place: 'none' },
      { personKey: 'n:walt (sub)', ymd: '2026-10-31', hours: 4, jobId: 'j2', place: 'none' },
    ])
  })

  it('reads a day with hours and no punch behind them as no place', () => {
    expect(tripHourRowsFromLabor(labor, index, new Map())?.every((r) => r.place === 'none')).toBe(true)
  })

  it('gives nothing when the days are not known', () => {
    expect(tripHourRowsFromLabor({ ...labor, daysKnown: false }, index, places)).toBeNull()
  })
})
