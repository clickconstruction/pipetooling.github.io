/**
 * Join a trip with the next (v2.7963): which trip is the next one, the one trip the two become as the database will
 * make it, what stops a join, the days both trips give one person, and every word the window and the toast say.
 * Heron Point's made-up trips: Dana and Luis out three days, then Dana back for two with Walt.
 */
import { describe, expect, it } from 'vitest'
import { newTripRecord, tripSavePayload, type TripRecord } from './tripRecord'
import { splitTripAt } from './tripSplit'
import {
  joinTrips,
  nextTripOf,
  parseTripJoinReply,
  TRIP_JOIN_BACK_NOTE,
  TRIP_JOIN_CONFIRM_LABEL,
  TRIP_JOIN_LABEL,
  tripJoinDoneWords,
  tripJoinNotes,
  tripJoinParts,
  tripJoinProblem,
  tripJoinSharedCap,
  tripJoinSharedDayWords,
  tripJoinSharedDays,
  tripJoinTitle,
} from './tripJoin'

const TODAY = '2026-11-18'
const FIRST: TripRecord = {
  ...newTripRecord({ id: 't7', developmentId: 'd1' }),
  tripNumber: 7,
  purpose: 'Reset the riser the framers moved',
  askedBy: null,
  outcome: '',
  billing: 'extra',
  via: 'phone',
  jobIds: ['j1'],
  createdAt: '2026-11-08T15:00:00.000Z',
  people: [
    { personId: 'p-dana', userId: null, name: 'Dana', days: { '2026-11-09': 'road', '2026-11-10': 'site', '2026-11-11': 'site' } },
    { personId: null, userId: 'u-luis', name: 'Luis', days: { '2026-11-10': 'site', '2026-11-11': 'site' } },
  ],
}
const SECOND: TripRecord = {
  ...newTripRecord({ id: 't8', developmentId: 'd1' }),
  tripNumber: 8,
  purpose: 'Second words',
  askedBy: 'them',
  askedWho: 'Walt, the super',
  askedHow: 'by phone',
  outcome: 'Passed.',
  billing: null,
  jobIds: ['j2', 'j1'],
  createdAt: '2026-11-13T15:00:00.000Z',
  people: [
    { personId: null, userId: 'u-dana', name: 'DANA ', days: { '2026-11-11': 'road', '2026-11-14': 'site', '2026-11-15': 'road' } },
    { personId: null, userId: null, name: 'Walt', days: { '2026-11-14': 'site' } },
  ],
}
const THIRD: TripRecord = { ...newTripRecord({ id: 't9', developmentId: 'd1' }), tripNumber: 9, people: [{ personId: null, userId: null, name: 'Dana', days: { '2026-11-17': 'site' } }] }

describe('the next trip', () => {
  it('is the one that went out next on the same site, whatever order the trips are handed in', () => {
    expect(nextTripOf(FIRST, [THIRD, SECOND, FIRST])?.id).toBe('t8')
    expect(nextTripOf(SECOND, [THIRD, SECOND, FIRST])?.id).toBe('t9')
  })

  it('is none for the last trip, and none for a trip that is not among them', () => {
    expect(nextTripOf(THIRD, [FIRST, SECOND, THIRD])).toBeNull()
    expect(nextTripOf(FIRST, [SECOND, THIRD])).toBeNull()
    expect(nextTripOf({ ...FIRST, id: 'gone' }, [])).toBeNull()
  })

  it('orders by first day, then last day, then id, as the look does', () => {
    const a: TripRecord = { ...THIRD, id: 'a', people: [{ personId: null, userId: null, name: 'Dana', days: { '2026-11-01': 'site', '2026-11-04': 'site' } }] }
    const b: TripRecord = { ...THIRD, id: 'b', people: [{ personId: null, userId: null, name: 'Luis', days: { '2026-11-01': 'site', '2026-11-02': 'site' } }] }
    const c: TripRecord = { ...THIRD, id: 'c', people: [{ personId: null, userId: null, name: 'Omar', days: { '2026-11-01': 'site', '2026-11-02': 'site' } }] }
    expect(nextTripOf(b, [a, b, c])?.id).toBe('c')
    expect(nextTripOf(c, [a, b, c])?.id).toBe('a')
    expect(nextTripOf(a, [a, b, c])).toBeNull()
  })

  it('keeps to one home: another site’s trip is never the next, and a job on no site is a home of its own', () => {
    const other: TripRecord = { ...SECOND, id: 'x1', developmentId: 'd2' }
    expect(nextTripOf(FIRST, [FIRST, other])).toBeNull()
    const held1: TripRecord = { ...FIRST, id: 'h1', developmentId: null, jobId: 'j9' }
    const held2: TripRecord = { ...SECOND, id: 'h2', developmentId: null, jobId: 'j9' }
    const held3: TripRecord = { ...THIRD, id: 'h3', developmentId: null, jobId: 'j8' }
    expect(nextTripOf(held1, [held1, held2, held3, THIRD])?.id).toBe('h2')
    expect(nextTripOf(held2, [held1, held2, held3, THIRD])).toBeNull()
    // A trip on the development is not joined with one a job holds by itself.
    expect(nextTripOf(FIRST, [FIRST, held2])).toBeNull()
  })
})

describe('the one trip two become', () => {
  const joined = joinTrips(FIRST, SECOND)

  it('keeps the open trip’s id, number, words and where it came from', () => {
    expect(joined).toMatchObject({ id: 't7', tripNumber: 7, developmentId: 'd1', purpose: 'Reset the riser the framers moved', via: 'phone', createdAt: '2026-11-08T15:00:00.000Z' })
  })

  it('takes the next trip’s words where its own are empty, and who asked whole', () => {
    expect(joined).toMatchObject({ askedBy: 'them', askedWho: 'Walt, the super', askedHow: 'by phone', outcome: 'Passed.' })
    const said = joinTrips({ ...FIRST, askedBy: 'us', outcome: 'Went fine.' }, SECOND)
    expect(said).toMatchObject({ askedBy: 'us', askedWho: '', askedHow: '', outcome: 'Went fine.' })
    expect(joinTrips({ ...FIRST, purpose: '  ' }, SECOND).purpose).toBe('Second words')
  })

  it('tells people apart by name, and each keeps every day from both', () => {
    expect(joined.people.map((p) => `${p.name}:${Object.keys(p.days).sort().join(',')}`)).toEqual(['Dana:2026-11-09,2026-11-10,2026-11-11,2026-11-14,2026-11-15', 'Luis:2026-11-10,2026-11-11', 'Walt:2026-11-14'])
  })

  it('keeps the open trip’s kind on a day both give one person, and its name for them', () => {
    const dana = joined.people.find((p) => p.name === 'Dana')
    expect(dana?.days['2026-11-11']).toBe('site')
    // The roster row is the open trip's, the login the next trip's, since the open trip named none.
    expect(dana).toMatchObject({ personId: 'p-dana', userId: 'u-dana' })
  })

  it('names both trips’ jobs once each, and an empty billing takes the other’s', () => {
    expect(joined.jobIds).toEqual(['j1', 'j2'])
    expect(joined.billing).toBe('extra')
    expect(joinTrips({ ...FIRST, billing: null }, { ...SECOND, billing: 'ours' }).billing).toBe('ours')
    expect(joinTrips({ ...FIRST, billing: null }, SECOND).billing).toBeNull()
  })

  it('is a trip the save takes: nobody on it twice', () => {
    const names = (tripSavePayload(joined).people as Array<{ name: string }>).map((p) => p.name.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })

  it('gives back a split trip as it was', () => {
    const whole: TripRecord = { ...FIRST, askedBy: 'them', askedWho: 'Walt', askedHow: 'by text', outcome: 'Passed.', people: [{ personId: null, userId: 'u-dana', name: 'Dana', days: { '2026-11-09': 'road', '2026-11-10': 'site', '2026-11-14': 'site', '2026-11-15': 'road' } }, FIRST.people[1]!] }
    const halves = splitTripAt(whole, '2026-11-14')
    expect(halves).not.toBeNull()
    const back = joinTrips(halves!.first, { ...halves!.second, id: 't8', tripNumber: 8 })
    expect(back).toEqual(whole)
  })
})

describe('what stops a join', () => {
  it('two different billings, in the database’s words', () => {
    expect(tripJoinProblem({ billing: 'extra' }, { billing: 'ours' }, { here: false, next: false })).toBe('These trips say two different billings: Extra and Ours. Make them match with Change, then join.')
    expect(tripJoinProblem({ billing: 'inside' }, { billing: 'extra' }, { here: false, next: false })).toContain('Inside the price and Extra')
  })

  it('a line on each trip', () => {
    expect(tripJoinProblem({ billing: 'extra' }, { billing: 'extra' }, { here: true, next: true })).toBe('Both trips are on a bill, each with its own line. A trip holds one line. Take one line off its job, then join.')
  })

  it('nothing else: one billing said, the same billing, one line', () => {
    expect(tripJoinProblem({ billing: 'extra' }, { billing: null }, { here: false, next: false })).toBeNull()
    expect(tripJoinProblem({ billing: null }, { billing: 'ours' }, { here: false, next: true })).toBeNull()
    expect(tripJoinProblem({ billing: 'extra' }, { billing: 'extra' }, { here: true, next: false })).toBeNull()
    expect(tripJoinProblem({ billing: null }, { billing: null }, { here: false, next: false })).toBeNull()
  })
})

describe('the days both trips give one person', () => {
  it('names each, with the kind that stays and the kind that goes', () => {
    expect(tripJoinSharedDays(FIRST, SECOND)).toEqual([{ name: 'Dana', ymd: '2026-11-11', kept: 'site', dropped: 'road' }])
    expect(tripJoinSharedDays(FIRST, THIRD)).toEqual([])
  })

  it('says a day in words, and what the next trip said only when it said another kind', () => {
    expect(tripJoinSharedDayWords({ name: 'Dana', ymd: '2026-11-11', kept: 'site', dropped: 'road' })).toEqual({ day: 'Nov 11', who: 'Dana', stays: 'stays At the site', was: 'the next trip said On the road' })
    expect(tripJoinSharedDayWords({ name: 'Dana', ymd: '2026-11-11', kept: 'site', dropped: 'site' }).was).toBeNull()
    expect(tripJoinSharedCap(FIRST)).toBe('On both trips. Trip 7’s kind stays')
    expect(tripJoinSharedCap({ tripNumber: null })).toBe('On both trips. This trip’s kind stays')
  })
})

describe('the window’s words', () => {
  it('names the press and the act', () => {
    expect(TRIP_JOIN_LABEL).toBe('Join with the next')
    expect(TRIP_JOIN_CONFIRM_LABEL).toBe('Join into one trip')
    expect(TRIP_JOIN_BACK_NOTE).toContain('Split in two')
  })

  it('titles the window by both numbers', () => {
    expect(tripJoinTitle(FIRST, SECOND)).toBe('Join Trip 7 with Trip 8')
    expect(tripJoinTitle({ tripNumber: null }, SECOND)).toBe('Join this trip with the next')
  })

  it('draws both trips and the one they become', () => {
    expect(tripJoinParts(FIRST, SECOND, TODAY)).toEqual({
      first: { name: 'Trip 7 · Nov 9 to 11', who: 'Dana, Luis', days: '3 days' },
      second: { name: 'Trip 8 · Nov 11 to 15', who: 'DANA , Walt', days: '3 days' },
      joined: { name: 'Trip 7 · Nov 9 to 15', who: 'Dana, Luis, Walt', days: '5 days' },
    })
  })

  it('says what the joined trip takes and where the next trip goes', () => {
    expect(tripJoinNotes(FIRST, SECOND, { here: false, next: false })).toEqual([
      'Trip 7 keeps its number and its words. It takes who asked and how it went from Trip 8.',
      'Trip 8 goes, and its number is not used again. It waits under Deleted trips, marked as joined.',
    ])
  })

  it('says a billing taken from the next trip, and where a line ends up', () => {
    const notes = tripJoinNotes({ ...FIRST, billing: null, askedBy: 'us', outcome: 'Fine.' }, { ...SECOND, billing: 'extra' }, { here: false, next: true })
    expect(notes).toEqual([
      'Trip 7 keeps its number and its words.',
      'The joined trip takes the billing Trip 8 said: Extra.',
      'Trip 8 is on a bill. Its line moves to the joined trip.',
      'Trip 8 goes, and its number is not used again. It waits under Deleted trips, marked as joined.',
    ])
    expect(tripJoinNotes(FIRST, SECOND, { here: true, next: false })).toContain('Trip 7 is on a bill. Its line stays with it.')
  })

  it('reads well for trips made before numbers', () => {
    const notes = tripJoinNotes({ ...FIRST, tripNumber: null, purpose: '' }, { ...SECOND, tripNumber: null, billing: 'ours' }, { here: false, next: false })
    expect(notes[0]).toBe('This trip keeps its number and its words. It takes what it was for, who asked and how it went from the next trip.')
    expect(notes[notes.length - 1]).toBe('The next trip goes, and its number is not used again. It waits under Deleted trips, marked as joined.')
  })
})

describe('after the join', () => {
  it('reads the function’s reply, and nothing that is not a join', () => {
    expect(parseTripJoinReply({ dry_run: false, did: 'join', trip_id: 't7', trip_number: 7, gone_trip_id: 't8', gone_trip_number: 8, line: 'moves' })).toEqual({ tripId: 't7', tripNumber: 7, goneTripId: 't8', goneTripNumber: 8, line: 'moves' })
    expect(parseTripJoinReply({ did: 'join', trip_id: 't7', gone_trip_id: 't8' })).toEqual({ tripId: 't7', tripNumber: null, goneTripId: 't8', goneTripNumber: null, line: 'none' })
    expect(parseTripJoinReply({ dry_run: true, would: 'join', trip_id: 't7', next_trip_id: 't8' })).toBeNull()
    expect(parseTripJoinReply({ did: 'join', trip_id: 't7' })).toBeNull()
    expect(parseTripJoinReply(null)).toBeNull()
    expect(parseTripJoinReply([])).toBeNull()
  })

  it('says the joined trip by its number and its days', () => {
    expect(tripJoinDoneWords(FIRST, SECOND, TODAY)).toBe('Joined. Trip 7 is now Nov 9 to 15, 5 days.')
    expect(tripJoinDoneWords({ ...FIRST, tripNumber: null }, SECOND, TODAY)).toBe('Joined. The trip is now Nov 9 to 15, 5 days.')
  })
})
