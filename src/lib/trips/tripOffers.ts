/**
 * **Looks like a trip** on the Trips look (punch list #379, PR 5): the finder (`tripFinder.ts`) laid over
 * what the look already reads. The punches on the site's jobs say which days each person was at the site,
 * the kept trips say which of those days are covered, and the days somebody said were **Not a trip** are
 * passed over. What is left is offered, and a person makes the trip or says Not a trip once.
 *
 * The app never makes a trip. Nothing here writes: this file builds the offers, their words, the trip the
 * sheet opens on and the rows Not a trip remembers. Pure; `tripsIo.ts` reads and writes the rows.
 */
import type { Trip } from './tripDays'
import { dismissalsForSuggestion, findTripsNotMade, tripPeopleFromSuggestion, type TripDismissal, type TripSuggestion } from './tripFinder'
import { sitePunchDays } from './tripHourRows'
import type { TripPlace } from './tripPlace'
import { tripPersonKey, TRIP_NAME_MAX, type TripPeopleIndex, type TripRecord, type TripRecordPerson, type TripRosterPerson } from './tripRecord'
import { daysWords, namesWords, tripSpanWords } from './tripsLook'

/** A person's days somebody said were not a trip, as the table keeps them (`trip_dismissals`). */
export type TripDismissalRow = {
  id: string
  development_id: string | null
  job_id: string | null
  person_id: string | null
  user_id: string | null
  person_name: string
  first_day: string
  last_day: string
}

/** What Not a trip writes, one row a person. The write stamps who said it: the signed-in user. */
export type TripDismissalInsert = Omit<TripDismissalRow, 'id'>

export const TRIP_DISMISSAL_SELECT = 'id, development_id, job_id, person_id, user_id, person_name, first_day, last_day'

/** What a login is called until its name is read. */
export const TRIP_NO_NAME = 'Someone'

/** How many offers the look shows at once; the rest wait behind one quiet line. */
export const TRIP_OFFERS_SHOWN = 3

/** A kept Not a trip as the finder reads it: the person under their one key. */
export function tripDismissalOf(row: Pick<TripDismissalRow, 'person_id' | 'user_id' | 'person_name' | 'first_day' | 'last_day'>, index: TripPeopleIndex): TripDismissal {
  return { personKey: tripPersonKey(index, { personId: row.person_id, userId: row.user_id, name: row.person_name }), first: row.first_day, last: row.last_day }
}

/**
 * The name a person key goes by: a roster person's from the roster, a login's from the names read for the
 * logins with no roster row, a name alone as written. Undefined while it is not known.
 */
export function tripNameOfKey(personKey: string, roster: ReadonlyArray<TripRosterPerson>, names: ReadonlyMap<string, string>): string | undefined {
  const id = personKey.slice(2)
  if (personKey.startsWith('p:')) return roster.find((r) => r.id === id)?.name.trim() || undefined
  if (personKey.startsWith('u:')) return names.get(id)?.trim() || undefined
  if (personKey.startsWith('n:')) return id.trim() || undefined
  return undefined
}

/**
 * The offers on a site: the runs of punches at the site that no kept trip covers and nobody said were not
 * a trip, oldest first. `places` is each person's day against the site's point (`placesByPersonDay`), and
 * `trips` are the kept trips under the same person keys, as the look's model builds them.
 */
export function buildTripOffers(args: {
  places: ReadonlyMap<string, TripPlace>
  trips: ReadonlyArray<Trip>
  dismissals: ReadonlyArray<TripDismissalRow>
  index: TripPeopleIndex
  roster: ReadonlyArray<TripRosterPerson>
  /** The names of the logins with no roster row, by user id. */
  names: ReadonlyMap<string, string>
}): TripSuggestion[] {
  return findTripsNotMade({
    punchDays: sitePunchDays(args.places, (key) => tripNameOfKey(key, args.roster, args.names) ?? TRIP_NO_NAME),
    trips: args.trips,
    dismissed: args.dismissals.map((d) => tripDismissalOf(d, args.index)),
  })
}

/** *Omar*, *Omar and Luis*, and past three people *Omar, Luis and 3 others*. */
function offerNames(s: TripSuggestion): string {
  const names = s.people.map((p) => p.name)
  return names.length > 3 ? namesWords([...names.slice(0, 2), `${names.length - 2} others`]) : namesWords(names)
}

/**
 * An offer in one sentence and its close: *Omar punched in at Heron Point on 4 days, Sep 8 to 11. No trip
 * covers those days.* The days are person-days: two people on the same day are two.
 */
export function tripOfferWords(s: TripSuggestion, siteName: string, todayYmd: string): string {
  return `${offerNames(s)} punched in at ${siteName} on ${daysWords(s.punchDays)}, ${tripSpanWords(s.first, s.last, todayYmd)}. ${s.punchDays === 1 ? 'No trip covers that day.' : 'No trip covers those days.'}`
}

/** What the toast says once Not a trip is remembered: *Not a trip: Omar, Sep 8 to 11. Those days are not offered again.* */
export function notATripWords(s: TripSuggestion, todayYmd: string): string {
  return `Not a trip: ${offerNames(s)}, ${tripSpanWords(s.first, s.last, todayYmd)}. ${s.punchDays === 1 ? 'That day is' : 'Those days are'} not offered again.`
}

/** The offers the look shows, oldest first, and how many wait behind them. */
export function tripOffersShown<T>(offers: ReadonlyArray<T>, max: number = TRIP_OFFERS_SHOWN): { shown: T[]; more: number } {
  const shown = offers.slice(0, Math.max(0, max))
  return { shown, more: offers.length - shown.length }
}

/** The quiet line under the offers shown; null when none wait. */
export function moreTripOffersWords(more: number): string | null {
  if (more <= 0) return null
  return more === 1 ? '1 more looks like a trip. It shows once one of these is settled.' : `${more} more look like trips. They show as these are settled.`
}

/**
 * A person key back to what a kept row needs: a roster person with the name and login the roster holds, a
 * login with no roster row under its user id, or a name alone.
 */
export function tripPersonOfKey(personKey: string, name: string, roster: ReadonlyArray<TripRosterPerson>): Pick<TripRecordPerson, 'personId' | 'userId' | 'name'> {
  const id = personKey.slice(2)
  const said = name.trim().slice(0, TRIP_NAME_MAX) || TRIP_NO_NAME
  if (personKey.startsWith('p:')) {
    const person = roster.find((r) => r.id === id)
    return { personId: id, userId: person?.userId ?? null, name: person?.name.trim() || said }
  }
  if (personKey.startsWith('u:')) return { personId: null, userId: id, name: said }
  return { personId: null, userId: null, name: said }
}

/**
 * **Make it a trip**: the new trip the sheet opens on, filled from the punches. Each person comes with the
 * days they punched at the site, painted At the site. Nothing is saved until the person presses Save.
 */
export function tripRecordFromOffer(s: TripSuggestion, base: TripRecord, roster: ReadonlyArray<TripRosterPerson>): TripRecord {
  return { ...base, people: tripPeopleFromSuggestion(s).map((p) => ({ ...tripPersonOfKey(p.personKey, p.name, roster), days: p.days })) }
}

/** **Not a trip**: the rows to remember, one a person, from their first punch day in the run to their last. */
export function dismissalRowsForOffer(s: TripSuggestion, args: { developmentId: string; roster: ReadonlyArray<TripRosterPerson> }): TripDismissalInsert[] {
  const nameOf = new Map(s.people.map((p) => [p.personKey, p.name]))
  return dismissalsForSuggestion(s).map((d) => {
    const who = tripPersonOfKey(d.personKey, nameOf.get(d.personKey) ?? '', args.roster)
    return { development_id: args.developmentId, job_id: null, person_id: who.personId, user_id: who.userId, person_name: who.name, first_day: d.first, last_day: d.last }
  })
}
