import { describe, expect, it } from 'vitest'
import { tripHistoryLines, tripLeftDay } from './tripHistory'
import { newTripRecord, NO_TRIP_PEOPLE, tripOfRecord, type TripRecord } from './tripRecord'

// Every name here is made up.
const record = (id: string, people: Array<[string, Record<string, 'ready' | 'road' | 'site'>]>, over: Partial<TripRecord> = {}): TripRecord => ({ ...newTripRecord({ id, developmentId: 'd1' }), people: people.map(([name, days]) => ({ personId: null, userId: null, name, days })), ...over })
const pair = (r: TripRecord) => ({ record: r, trip: tripOfRecord(r, NO_TRIP_PEOPLE) })
const lifts = record('t1', [['Luis', { '2026-10-23': 'ready', '2026-10-26': 'road', '2026-10-27': 'site', '2026-10-28': 'road' }], ['Priya', { '2026-10-26': 'road', '2026-10-27': 'site', '2026-10-28': 'road' }]], { purpose: 'Lift stations before the pour', outcome: 'Did the work.' })

describe('the day a trip leaves', () => {
  it('is its first day on the road or at the site, not a day getting ready', () => {
    expect(tripLeftDay(pair(lifts).trip)).toBe('2026-10-26')
  })

  it('is its first day when every day is getting ready', () => {
    expect(tripLeftDay(pair(record('r', [['Luis', { '2026-10-23': 'ready' }]])).trip)).toBe('2026-10-23')
  })
})

describe('a trip’s lines in History', () => {
  it('writes one line the day it left and one the day it was back', () => {
    const lines = tripHistoryLines({ trips: [pair(lifts)], siteName: 'Heron Point', todayYmd: '2026-11-17' })
    expect(lines.map((l) => [l.id, l.at.slice(0, 10), l.kind, l.verb, l.detail, l.dayOnly])).toEqual([
      ['trip-out:t1', '2026-10-26', 'trip', 'Trip out', 'Luis and Priya left for Heron Point · Lift stations before the pour', true],
      ['trip-back:t1', '2026-10-28', 'trip', 'Trip back', 'Luis and Priya are back · 1 day at the site · Did the work.', true],
    ])
    expect(lines[0]?.about).toEqual({ kind: 'site', id: null, label: 'Heron Point' })
  })

  it('leads each line with the trip’s number, and names the trip so the feed can open it', () => {
    const lines = tripHistoryLines({ trips: [pair({ ...lifts, tripNumber: 5 })], siteName: 'Heron Point', todayYmd: '2026-11-17' })
    expect(lines.map((l) => [l.verb, l.trip, l.detail])).toEqual([
      ['Trip 5 out', { id: 't1', door: 'Open Trip 5' }, 'Luis and Priya left for Heron Point · Lift stations before the pour'],
      ['Trip 5 back', { id: 't1', door: 'Open Trip 5' }, 'Luis and Priya are back · 1 day at the site · Did the work.'],
    ])
  })

  it('names the trip on a line made before numbers too, with a door that says no number', () => {
    expect(tripHistoryLines({ trips: [pair(lifts)], siteName: 'Heron Point', todayYmd: '2026-11-17' }).map((l) => l.trip)).toEqual([
      { id: 't1', door: 'Open this trip' },
      { id: 't1', door: 'Open this trip' },
    ])
  })

  it('writes only the first line while the trip is out, its last day included', () => {
    expect(tripHistoryLines({ trips: [pair(lifts)], siteName: 'Heron Point', todayYmd: '2026-10-28' }).map((l) => l.verb)).toEqual(['Trip out'])
  })

  it('writes nothing for a planned trip, or before the trip has left home', () => {
    expect(tripHistoryLines({ trips: [pair(lifts)], siteName: 'Heron Point', todayYmd: '2026-10-22' })).toEqual([])
    expect(tripHistoryLines({ trips: [pair(lifts)], siteName: 'Heron Point', todayYmd: '2026-10-24' })).toEqual([])
  })

  it('says is for one person, and leaves out what nobody wrote', () => {
    const one = record('t2', [['Dana', { '2026-06-22': 'road', '2026-06-23': 'site', '2026-06-24': 'site' }]])
    expect(tripHistoryLines({ trips: [pair(one)], siteName: 'Heron Point', todayYmd: '2026-11-17' }).map((l) => l.detail)).toEqual(['Dana left for Heron Point', 'Dana is back · 2 days at the site'])
  })

  it('writes nothing for a trip with no day', () => {
    expect(tripHistoryLines({ trips: [pair(record('e', []))], siteName: 'Heron Point', todayYmd: '2026-11-17' })).toEqual([])
  })
})
