/**
 * Split a trip in two (v2.7891): the days a second trip may start on, the day offered first, the two halves as the
 * database will make them, and every word the window and the toast say. Heron Point's made-up trip: Dana out three
 * days, home two, out two more; Luis on the first part alone.
 */
import { describe, expect, it } from 'vitest'
import { newTripRecord, tripSavePayload, type TripRecord } from './tripRecord'
import {
  canSplitTrip,
  parseTripSplitReply,
  splitTripAt,
  TRIP_SPLIT_CONFIRM_LABEL,
  TRIP_SPLIT_LABEL,
  tripSplitBillNote,
  tripSplitChoiceWords,
  tripSplitChoices,
  tripSplitDays,
  tripSplitDoneWords,
  tripSplitHalves,
  tripSplitSuggested,
  tripSplitTitle,
} from './tripSplit'

const TODAY = '2026-11-18'
const TRIP: TripRecord = {
  ...newTripRecord({ id: 't3', developmentId: 'd1' }),
  tripNumber: 3,
  purpose: 'Reset the riser the framers moved',
  askedBy: 'them',
  askedWho: 'Walt, the super',
  askedHow: 'by phone',
  outcome: 'Passed.',
  billing: 'extra',
  jobIds: ['j1'],
  createdAt: '2026-11-12T15:00:00.000Z',
  people: [
    { personId: null, userId: 'u-luis', name: 'Luis', days: { '2026-11-10': 'site', '2026-11-11': 'site' } },
    { personId: 'p-dana', userId: 'u-dana', name: 'Dana', days: { '2026-11-09': 'road', '2026-11-10': 'site', '2026-11-11': 'site', '2026-11-14': 'site', '2026-11-15': 'road' } },
  ],
}
const STRAIGHT: TripRecord = { ...TRIP, people: [{ personId: null, userId: null, name: 'Omar', days: { '2026-11-09': 'road', '2026-11-10': 'site', '2026-11-11': 'road' } }] }

describe('the days of a trip', () => {
  it('lists each day once, in order, with who was on it and the days since the day before', () => {
    expect(tripSplitDays(TRIP)).toEqual([
      { ymd: '2026-11-09', names: ['Dana'], gap: 0 },
      { ymd: '2026-11-10', names: ['Dana', 'Luis'], gap: 1 },
      { ymd: '2026-11-11', names: ['Dana', 'Luis'], gap: 1 },
      { ymd: '2026-11-14', names: ['Dana'], gap: 3 },
      { ymd: '2026-11-15', names: ['Dana'], gap: 1 },
    ])
  })
  it('a trip of one day cannot be split, and one of two can', () => {
    const one = { people: [{ personId: null, userId: null, name: 'Omar', days: { '2026-11-09': 'site' as const } }] }
    expect(canSplitTrip(one)).toBe(false)
    // Two people on the same one day is still one day.
    expect(canSplitTrip({ people: [...one.people, { personId: null, userId: null, name: 'Priya', days: { '2026-11-09': 'site' as const } }] })).toBe(false)
    expect(canSplitTrip({ people: [{ personId: null, userId: null, name: 'Omar', days: { '2026-11-09': 'site' as const, '2026-11-10': 'site' as const } }] })).toBe(true)
    expect(canSplitTrip({ people: [] })).toBe(false)
  })
  it('the second trip may start on any day but the first', () => {
    expect(tripSplitChoices(TRIP).map((d) => d.ymd)).toEqual(['2026-11-10', '2026-11-11', '2026-11-14', '2026-11-15'])
    expect(tripSplitChoices({ people: [] })).toEqual([])
  })
})

describe('the day offered first', () => {
  it('is the day after the longest stretch at home', () => {
    expect(tripSplitSuggested(TRIP)).toBe('2026-11-14')
  })
  it('is the earlier of two stretches of one length, and the longer of two that differ', () => {
    const two = { people: [{ personId: null, userId: null, name: 'Omar', days: { '2026-11-01': 'site' as const, '2026-11-04': 'site' as const, '2026-11-07': 'site' as const } }] }
    expect(tripSplitSuggested(two)).toBe('2026-11-04')
    const longer = { people: [{ personId: null, userId: null, name: 'Omar', days: { '2026-11-01': 'site' as const, '2026-11-03': 'site' as const, '2026-11-09': 'site' as const } }] }
    expect(tripSplitSuggested(longer)).toBe('2026-11-09')
  })
  it('is none on a trip with no day at home in the middle: the person says where it was two', () => {
    expect(tripSplitSuggested(STRAIGHT)).toBeNull()
  })
  it('counts a stretch at home across a month end', () => {
    const across = { people: [{ personId: null, userId: null, name: 'Omar', days: { '2026-10-30': 'site' as const, '2026-11-02': 'site' as const } }] }
    expect(tripSplitDays(across)[1]?.gap).toBe(3)
    expect(tripSplitSuggested(across)).toBe('2026-11-02')
  })
})

describe('splitTripAt', () => {
  it('the first keeps the id and the number, the second is new; each person goes where their days are', () => {
    const halves = splitTripAt(TRIP, '2026-11-14')
    if (!halves) throw new Error('no split')
    expect(halves.first).toMatchObject({ id: 't3', tripNumber: 3, billing: 'extra' })
    expect(halves.first.people.map((p) => `${p.name}:${Object.keys(p.days).join(',')}`)).toEqual(['Luis:2026-11-10,2026-11-11', 'Dana:2026-11-09,2026-11-10,2026-11-11'])
    expect(halves.second).toMatchObject({ id: '', tripNumber: null, via: 'app', createdAt: null, billing: 'extra', purpose: TRIP.purpose, askedBy: 'them', askedWho: 'Walt, the super', askedHow: 'by phone', outcome: 'Passed.', jobIds: ['j1'], developmentId: 'd1' })
    expect(halves.second.people).toEqual([{ personId: 'p-dana', userId: 'u-dana', name: 'Dana', days: { '2026-11-14': 'site', '2026-11-15': 'road' } }])
    // Nothing of the trip is lost or said twice.
    const all = (r: TripRecord) => r.people.flatMap((p) => Object.keys(p.days).map((d) => `${p.name}|${d}|${p.days[d]}`))
    expect([...all(halves.first), ...all(halves.second)].sort()).toEqual(all(TRIP).sort())
    // The first half is the trip its own save takes.
    expect(tripSavePayload(halves.first)).toMatchObject({ id: 't3', trip_number: 3 })
  })
  it('a person with days on both sides is on both trips', () => {
    const halves = splitTripAt(TRIP, '2026-11-11')
    expect(halves?.first.people.map((p) => p.name)).toEqual(['Luis', 'Dana'])
    expect(halves?.second.people.map((p) => p.name)).toEqual(['Luis', 'Dana'])
  })
  it('a trip on a bill keeps its line, so the new trip starts with no billing said', () => {
    expect(splitTripAt(TRIP, '2026-11-14', { onBill: true })?.second.billing).toBeNull()
    expect(splitTripAt(TRIP, '2026-11-14', { onBill: true })?.first.billing).toBe('extra')
  })
  it('is nothing at the first day or past the last, where a half would be empty', () => {
    expect(splitTripAt(TRIP, '2026-11-09')).toBeNull()
    expect(splitTripAt(TRIP, '2026-11-16')).toBeNull()
    // A day at home in the gap cuts the same way as the day the crew went back.
    expect(splitTripAt(TRIP, '2026-11-13')?.second.people[0]?.days).toEqual({ '2026-11-14': 'site', '2026-11-15': 'road' })
  })
  it('does not change the trip it was given', () => {
    const before = JSON.stringify(TRIP)
    splitTripAt(TRIP, '2026-11-14')
    expect(JSON.stringify(TRIP)).toBe(before)
  })
})

describe('the words', () => {
  it('names the press and the confirm by the act', () => {
    expect(TRIP_SPLIT_LABEL).toBe('Split in two')
    expect(TRIP_SPLIT_CONFIRM_LABEL).toBe('Split into two trips')
    expect(tripSplitTitle(TRIP)).toBe('Split Trip 3 in two')
    expect(tripSplitTitle({ tripNumber: null })).toBe('Split this trip in two')
  })
  it('says both halves: the trip by its number and days, the new one by its days', () => {
    expect(tripSplitHalves(TRIP, '2026-11-14', TODAY)).toEqual({
      first: { name: 'Trip 3 · Nov 9 to 11', who: 'Dana, Luis', days: '3 days' },
      second: { name: 'A new trip · Nov 14 to 15', who: 'Dana', days: '2 days' },
    })
    expect(tripSplitHalves(TRIP, '2026-11-09', TODAY)).toBeNull()
  })
  it('says a choice by its day, who was on it, and the days at home before it', () => {
    const [second, , fourth] = tripSplitChoices(TRIP)
    expect(tripSplitChoiceWords(second!)).toEqual({ day: 'Nov 10', who: 'Dana, Luis', home: null })
    expect(tripSplitChoiceWords(fourth!)).toEqual({ day: 'Nov 14', who: 'Dana', home: 'after 2 days at home' })
    expect(tripSplitChoiceWords({ ymd: '2026-11-04', names: ['Omar'], gap: 2 }).home).toBe('after 1 day at home')
  })
  it('says what a trip on a bill keeps', () => {
    expect(tripSplitBillNote(TRIP, false)).toBeNull()
    expect(tripSplitBillNote(TRIP, true)).toBe('Trip 3 is on a bill. Its line stays with Trip 3, and the new trip starts with no billing said.')
    expect(tripSplitBillNote({ tripNumber: null }, true)).toBe('This trip is on a bill. Its line stays with it, and the new trip starts with no billing said.')
  })
  it('says both trips by number and days after the split', () => {
    expect(tripSplitDoneWords(TRIP, '2026-11-14', { newTripNumber: 8 }, TODAY)).toBe('Split. Trip 3 is Nov 9 to 11, and Trip 8 is Nov 14 to 15.')
    expect(tripSplitDoneWords(TRIP, '2026-11-14', null, TODAY)).toBe('Split. Trip 3 is Nov 9 to 11, and the new trip is Nov 14 to 15.')
    expect(tripSplitDoneWords({ ...TRIP, tripNumber: null }, '2026-11-14', { newTripNumber: null }, TODAY)).toBe('Split. The first trip is Nov 9 to 11, and the new trip is Nov 14 to 15.')
  })
})

describe('parseTripSplitReply', () => {
  it('reads the trip kept and the trip made, with their numbers', () => {
    expect(parseTripSplitReply({ dry_run: false, did: 'split', trip_id: 't3', trip_number: 3, new_trip_id: 't8', new_trip_number: 8 })).toEqual({ tripId: 't3', tripNumber: 3, newTripId: 't8', newTripNumber: 8 })
    expect(parseTripSplitReply({ did: 'split', trip_id: 't3', new_trip_id: 't8' })).toEqual({ tripId: 't3', tripNumber: null, newTripId: 't8', newTripNumber: null })
  })
  it('reads nothing from a dry run or a reply that is not a split', () => {
    for (const raw of [null, undefined, 'split', [], {}, { dry_run: true, would: 'split', trip_id: 't3' }, { did: 'split', trip_id: 't3' }, { did: 'split', trip_id: '', new_trip_id: 't8' }, { did: 'changed', trip_id: 't3', new_trip_id: 't8' }]) expect(parseTripSplitReply(raw)).toBeNull()
  })
})
