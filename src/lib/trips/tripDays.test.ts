import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  daysInRange,
  isYmd,
  nextDayKind,
  overlappingTripDays,
  paintDays,
  parseTripDays,
  personDayCounts,
  sortTrips,
  tripCanSave,
  tripDayCounts,
  tripDayKind,
  tripDayList,
  tripDayOfPerson,
  tripSpan,
  tripStanding,
  withDay,
  type Trip,
  type TripDayKind,
  type TripDays,
} from './tripDays'

/** Days from a first day and one letter a day: g getting ready, r on the road, s at the site, x off. Every name here is made up. */
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

const roughIn: Trip = { id: 't1', people: [person('dana', '2026-02-13', 'grrssrr'), person('luis', '2026-02-13', 'xrrssrr')] }
const monthEnd: Trip = { id: 't2', people: [person('luis', '2026-10-29', 'grssxsr')] }

describe('days', () => {
  it('adds days across a month end, a year end and a leap day', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('does not lose a day where the clocks change', () => {
    expect(daysInRange('2026-03-07', '2026-03-09')).toEqual(['2026-03-07', '2026-03-08', '2026-03-09'])
    expect(daysInRange('2026-10-31', '2026-11-02')).toEqual(['2026-10-31', '2026-11-01', '2026-11-02'])
    expect(daysBetween('2026-10-29', '2026-11-04')).toBe(6)
    expect(daysBetween('2026-11-04', '2026-10-29')).toBe(-6)
  })

  it('gives nothing for a range that ends before it starts', () => {
    expect(daysInRange('2026-11-02', '2026-11-01')).toEqual([])
  })

  it('knows a real day from a string that looks like one', () => {
    expect(isYmd('2026-02-28')).toBe(true)
    expect(isYmd('2026-02-30')).toBe(false)
    expect(isYmd('2026-2-3')).toBe(false)
    expect(isYmd(20260203)).toBe(false)
  })

  it('reads stored days back, dropping what is not a day with a kind', () => {
    expect(parseTripDays({ '2026-11-01': 'site', '2026-11-02': 'road', '2026-13-01': 'site', '2026-11-03': 'home', bad: 'site' })).toEqual({ '2026-11-01': 'site', '2026-11-02': 'road' })
    expect(parseTripDays(null)).toEqual({})
    expect(parseTripDays(['2026-11-01'])).toEqual({})
    expect(parseTripDays('2026-11-01')).toEqual({})
  })
})

describe('painting', () => {
  it('starts every picked day as At the site', () => {
    expect(paintDays('2026-12-01', '2026-12-03')).toEqual({ '2026-12-01': 'site', '2026-12-02': 'site', '2026-12-03': 'site' })
  })

  it('turns a day one tap at a time: the site, the road, getting ready, off, and round', () => {
    expect(nextDayKind('site')).toBe('road')
    expect(nextDayKind('road')).toBe('ready')
    expect(nextDayKind('ready')).toBe(null)
    expect(nextDayKind(null)).toBe('site')
  })

  it('changes one day and leaves the days it was given alone', () => {
    const before = paintDays('2026-12-01', '2026-12-03')
    const after = withDay(withDay(before, '2026-12-01', 'road'), '2026-12-02', null)
    expect(after).toEqual({ '2026-12-01': 'road', '2026-12-03': 'site' })
    expect(before['2026-12-01']).toBe('site')
  })
})

describe('a trip over everyone on it', () => {
  it('reads a day as At the site when anyone was, else the road, else getting ready', () => {
    expect(tripDayKind(roughIn, '2026-02-13')).toBe('ready')
    expect(tripDayKind(roughIn, '2026-02-14')).toBe('road')
    expect(tripDayKind(roughIn, '2026-02-16')).toBe('site')
    expect(tripDayKind(roughIn, '2026-02-20')).toBe(null)
    const mixed: Trip = { id: 'm', people: [person('a', '2026-05-01', 'r'), person('b', '2026-05-01', 's'), person('c', '2026-05-01', 'g')] }
    expect(tripDayKind(mixed, '2026-05-01')).toBe('site')
  })

  it('spans its first day to its last, across a month end', () => {
    expect(tripSpan(roughIn)).toEqual({ first: '2026-02-13', last: '2026-02-19' })
    expect(tripSpan(monthEnd)).toEqual({ first: '2026-10-29', last: '2026-11-04' })
    expect(tripSpan({ id: 'e', people: [] })).toBe(null)
  })

  it('lists every day of the span, with a day off in the middle as no kind', () => {
    expect(tripDayList(monthEnd).map((d) => `${d.ymd.slice(5)} ${d.kind ?? 'off'}`)).toEqual(['10-29 ready', '10-30 road', '10-31 site', '11-01 site', '11-02 off', '11-03 site', '11-04 road'])
  })

  it('counts each day once however many people were on it', () => {
    expect(tripDayCounts(roughIn)).toEqual({ site: 2, road: 4, ready: 1, days: 7 })
    expect(tripDayCounts(monthEnd)).toEqual({ site: 3, road: 2, ready: 1, days: 6 })
    expect(personDayCounts(days('2026-02-13', 'xrrssrr'))).toEqual({ site: 2, road: 4, ready: 0, days: 6 })
  })

  it('needs one person with one day, and nothing else', () => {
    expect(tripCanSave({ people: [] })).toBe(false)
    expect(tripCanSave({ people: [{ personKey: 'a', name: 'A', days: {} }] })).toBe(false)
    expect(tripCanSave({ people: [person('a', '2026-05-01', 's')] })).toBe(true)
  })
})

describe('where a trip stands', () => {
  it('is Planned before its first day, Out now through its last, Back after', () => {
    expect(tripStanding(roughIn, '2026-02-12')).toBe('planned')
    expect(tripStanding(roughIn, '2026-02-13')).toBe('out')
    expect(tripStanding(roughIn, '2026-02-19')).toBe('out')
    expect(tripStanding(roughIn, '2026-02-20')).toBe('back')
  })

  it('is Out now on a day off in the middle', () => {
    expect(tripStanding(monthEnd, '2026-11-02')).toBe('out')
  })

  it('is Planned with no day yet', () => {
    expect(tripStanding({ id: 'e', people: [] }, '2026-02-20')).toBe('planned')
  })
})

describe('order, and whose day it is', () => {
  const later: Trip = { id: 't9', people: [person('dana', '2026-02-18', 'sss')] }

  it('orders trips by the day they went out, a trip with no day last', () => {
    expect(sortTrips([{ id: 'e', people: [] }, later, monthEnd, roughIn]).map((t) => t.id)).toEqual(['t1', 't9', 't2', 'e'])
  })

  it('finds the trip a person was on that day, and nothing for a person who was not on it', () => {
    const trips = sortTrips([monthEnd, roughIn])
    expect(tripDayOfPerson(trips, 'luis', '2026-11-01')).toMatchObject({ trip: { id: 't2' }, kind: 'site' })
    expect(tripDayOfPerson(trips, 'luis', '2026-11-02')).toBe(null)
    expect(tripDayOfPerson(trips, 'luis', '2026-02-13')).toBe(null)
    expect(tripDayOfPerson(trips, 'omar', '2026-02-16')).toBe(null)
  })

  it('gives a day two trips claim to the one that went out first, and says which days clash', () => {
    const trips = sortTrips([later, roughIn])
    expect(tripDayOfPerson(trips, 'dana', '2026-02-18')).toMatchObject({ trip: { id: 't1' }, kind: 'road' })
    expect(tripDayOfPerson(trips, 'dana', '2026-02-20')).toMatchObject({ trip: { id: 't9' }, kind: 'site' })
    expect(overlappingTripDays([later, roughIn])).toEqual([
      { personKey: 'dana', ymd: '2026-02-18', tripIds: ['t1', 't9'] },
      { personKey: 'dana', ymd: '2026-02-19', tripIds: ['t1', 't9'] },
    ])
    expect(overlappingTripDays([roughIn, monthEnd])).toEqual([])
  })
})
