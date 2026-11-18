import { describe, expect, it } from 'vitest'
import type { Trip } from './tripDays'
import type { TripSuggestion } from './tripFinder'
import { placeKey } from './tripHourRows'
import {
  buildTripOffers,
  dismissalRowsForOffer,
  moreTripOffersWords,
  notATripWords,
  tripDismissalOf,
  tripNameOfKey,
  tripOfferWords,
  tripOffersShown,
  tripPersonOfKey,
  tripRecordFromOffer,
  TRIP_NO_NAME,
  type TripDismissalRow,
} from './tripOffers'
import type { TripPlace } from './tripPlace'
import { newTripRecord, tripPeopleIndex, type TripRosterPerson } from './tripRecord'
import { sheetFromRecord } from './tripSheet'

// Every name, site and day here is made up.
const TODAY = '2026-11-17'
const roster: TripRosterPerson[] = [
  { id: 'p-omar', name: 'Omar', userId: 'u-omar' },
  { id: 'p-luis', name: 'Luis', userId: 'u-luis' },
  { id: 'p-dana', name: 'Dana', userId: null },
]
const index = tripPeopleIndex(roster)
const NO_NAMES = new Map<string, string>()
const at = (personKey: string, ...days: string[]): Array<[string, TripPlace]> => days.map((d) => [placeKey(personKey, `2026-09-${d}`), 'site'])
const omarDays = at('p:p-omar', '08', '09', '10', '11')
const offersOf = (places: Array<[string, TripPlace]>, over: { trips?: Trip[]; dismissals?: TripDismissalRow[]; names?: Map<string, string> } = {}) =>
  buildTripOffers({ places: new Map(places), trips: over.trips ?? [], dismissals: over.dismissals ?? [], index, roster, names: over.names ?? NO_NAMES })
const dismissal = (over: Partial<TripDismissalRow>): TripDismissalRow => ({ id: 'd1', development_id: 'dev1', job_id: null, person_id: null, user_id: null, person_name: 'Omar', first_day: '2026-09-08', last_day: '2026-09-11', ...over })
const only = (offers: TripSuggestion[]): TripSuggestion => {
  const [first] = offers
  if (!first || offers.length !== 1) throw new Error(`expected one offer, got ${offers.length}`)
  return first
}

describe('the offers on a site', () => {
  it('offers a run of days at the site that no trip covers, under the roster’s name', () => {
    const offer = only(offersOf([...omarDays, [placeKey('p:p-omar', '2026-09-12'), 'elsewhere'], [placeKey('p:p-omar', '2026-09-13'), 'none']]))
    expect(offer).toMatchObject({ first: '2026-09-08', last: '2026-09-11', punchDays: 4, people: [{ personKey: 'p:p-omar', name: 'Omar' }] })
  })

  it('offers nothing for days a kept trip covers under the same person key, whatever the day’s kind', () => {
    const trip: Trip = { id: 't', people: [{ personKey: 'p:p-omar', name: 'Omar', days: { '2026-09-08': 'road', '2026-09-09': 'site', '2026-09-10': 'site', '2026-09-11': 'road' } }] }
    expect(offersOf(omarDays, { trips: [trip] })).toEqual([])
  })

  it('passes over days somebody said were not a trip, whichever of the three names the row keeps', () => {
    expect(offersOf(omarDays, { dismissals: [dismissal({ person_id: 'p-omar' })] })).toEqual([])
    expect(offersOf(omarDays, { dismissals: [dismissal({ user_id: 'u-omar' })] })).toEqual([])
    expect(offersOf(omarDays, { dismissals: [dismissal({ person_name: 'omar' })] })).toEqual([])
    expect(offersOf(omarDays, { dismissals: [dismissal({ person_id: 'p-luis', person_name: 'Luis' })] })).toHaveLength(1)
  })

  it('names a login with no roster row from the names read, and Someone until then', () => {
    const days = at('u:u-walt', '08', '09')
    expect(only(offersOf(days)).people[0]?.name).toBe(TRIP_NO_NAME)
    expect(only(offersOf(days, { names: new Map([['u-walt', 'Walt']]) })).people[0]?.name).toBe('Walt')
  })

  it('offers oldest first', () => {
    expect(offersOf([...at('p:p-luis', '21', '22'), ...omarDays]).map((o) => o.first)).toEqual(['2026-09-08', '2026-09-21'])
  })

  it('reads a kept Not a trip under the person’s one key', () => {
    expect(tripDismissalOf(dismissal({ user_id: 'u-omar' }), index)).toEqual({ personKey: 'p:p-omar', first: '2026-09-08', last: '2026-09-11' })
    expect(tripDismissalOf(dismissal({ user_id: 'u-walt', person_name: 'Walt' }), index)).toEqual({ personKey: 'u:u-walt', first: '2026-09-08', last: '2026-09-11' })
  })

  it('finds the name a key goes by, or none', () => {
    expect(tripNameOfKey('p:p-luis', roster, NO_NAMES)).toBe('Luis')
    expect(tripNameOfKey('p:p-gone', roster, NO_NAMES)).toBeUndefined()
    expect(tripNameOfKey('u:u-walt', roster, new Map([['u-walt', ' Walt ']]))).toBe('Walt')
    expect(tripNameOfKey('u:u-walt', roster, NO_NAMES)).toBeUndefined()
    expect(tripNameOfKey('n:ray', roster, NO_NAMES)).toBe('ray')
  })
})

describe('an offer in words', () => {
  const omar = only(offersOf(omarDays))
  const crew = only(offersOf([...omarDays, ...at('p:p-luis', '10', '12')]))

  it('says who punched in, where, on how many days and when', () => {
    expect(tripOfferWords(omar, 'Heron Point', TODAY)).toBe('Omar punched in at Heron Point on 4 days, Sep 8 to 11. No trip covers those days.')
  })

  it('counts person-days for several people, the one with the most days first', () => {
    expect(tripOfferWords(crew, 'Heron Point', TODAY)).toBe('Omar and Luis punched in at Heron Point on 6 days, Sep 8 to 12. No trip covers those days.')
  })

  it('says one day as one day, and the year when it is not this one', () => {
    expect(tripOfferWords(only(offersOf(at('p:p-luis', '08'))), 'Heron Point', TODAY)).toBe('Luis punched in at Heron Point on 1 day, Sep 8. No trip covers that day.')
    expect(tripOfferWords(omar, 'Heron Point', '2027-01-05')).toBe('Omar punched in at Heron Point on 4 days, Sep 8 to 11, 2026. No trip covers those days.')
  })

  it('names two and counts the rest past three people', () => {
    const many = only(offersOf([...omarDays, ...at('p:p-luis', '08', '09', '10'), ...at('p:p-dana', '08', '09'), ...at('u:u-walt', '08')], { names: new Map([['u-walt', 'Walt']]) }))
    expect(tripOfferWords(many, 'Heron Point', TODAY)).toBe('Omar, Luis and 2 others punched in at Heron Point on 10 days, Sep 8 to 11. No trip covers those days.')
  })

  it('says what Not a trip remembered', () => {
    expect(notATripWords(crew, TODAY)).toBe('Not a trip: Omar and Luis, Sep 8 to 12. Those days are not offered again.')
    expect(notATripWords(only(offersOf(at('p:p-luis', '08'))), TODAY)).toBe('Not a trip: Luis, Sep 8. That day is not offered again.')
  })
})

describe('how many offers show', () => {
  it('shows three at most, oldest first, and counts the rest', () => {
    expect(tripOffersShown(['a', 'b'])).toEqual({ shown: ['a', 'b'], more: 0 })
    expect(tripOffersShown(['a', 'b', 'c', 'd', 'e'])).toEqual({ shown: ['a', 'b', 'c'], more: 2 })
    expect(tripOffersShown([])).toEqual({ shown: [], more: 0 })
  })

  it('says how many more wait in one quiet line', () => {
    expect(moreTripOffersWords(0)).toBeNull()
    expect(moreTripOffersWords(1)).toBe('1 more looks like a trip. It shows once one of these is settled.')
    expect(moreTripOffersWords(4)).toBe('4 more look like trips. They show as these are settled.')
  })
})

describe('Make it a trip', () => {
  const offer = only(offersOf([...at('p:p-omar', '08', '09', '11'), ...at('u:u-walt', '09'), ...at('p:p-dana', '08')], { names: new Map([['u-walt', 'Walt']]) }))
  const record = tripRecordFromOffer(offer, newTripRecord({ id: 'new', developmentId: 'dev1' }), roster)

  it('fills a new trip from the punches: each person as the record keeps them, each punch day At the site', () => {
    expect(record).toMatchObject({ id: 'new', developmentId: 'dev1', purpose: '', billing: null })
    expect(record.people).toEqual([
      { personId: 'p-omar', userId: 'u-omar', name: 'Omar', days: { '2026-09-08': 'site', '2026-09-09': 'site', '2026-09-11': 'site' } },
      { personId: 'p-dana', userId: null, name: 'Dana', days: { '2026-09-08': 'site' } },
      { personId: null, userId: 'u-walt', name: 'Walt', days: { '2026-09-09': 'site' } },
    ])
  })

  it('opens the sheet on those days, a day off in the middle left off', () => {
    const sheet = sheetFromRecord(record, TODAY)
    expect([sheet.first, sheet.last]).toEqual(['2026-09-08', '2026-09-11'])
    expect(sheet.people.map((p) => p.name)).toEqual(['Omar', 'Dana', 'Walt'])
  })

  it('maps a key back to a roster person, a login or a name alone', () => {
    expect(tripPersonOfKey('p:p-luis', 'whatever', roster)).toEqual({ personId: 'p-luis', userId: 'u-luis', name: 'Luis' })
    expect(tripPersonOfKey('p:p-gone', 'Priya', roster)).toEqual({ personId: 'p-gone', userId: null, name: 'Priya' })
    expect(tripPersonOfKey('u:u-walt', '', roster)).toEqual({ personId: null, userId: 'u-walt', name: TRIP_NO_NAME })
    expect(tripPersonOfKey('n:ray', 'Ray', roster)).toEqual({ personId: null, userId: null, name: 'Ray' })
  })
})

describe('Not a trip', () => {
  it('remembers one row a person, from their first punch day in the run to their last', () => {
    const offer = only(offersOf([...at('p:p-omar', '08', '09', '11'), ...at('u:u-walt', '09')], { names: new Map([['u-walt', 'Walt']]) }))
    const rows = dismissalRowsForOffer(offer, { developmentId: 'dev1', roster })
    expect(rows).toEqual([
      { development_id: 'dev1', job_id: null, person_id: 'p-omar', user_id: 'u-omar', person_name: 'Omar', first_day: '2026-09-08', last_day: '2026-09-11' },
      { development_id: 'dev1', job_id: null, person_id: null, user_id: 'u-walt', person_name: 'Walt', first_day: '2026-09-09', last_day: '2026-09-09' },
    ])
    // Kept, the same rows pass the offer over.
    expect(offersOf([...at('p:p-omar', '08', '09', '11'), ...at('u:u-walt', '09')], { dismissals: rows.map((r, i) => ({ ...r, id: `d${i}` })) })).toEqual([])
  })
})
