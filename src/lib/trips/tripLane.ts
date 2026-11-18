/**
 * A site's trips as the Plans look's By date view draws them (punch list #379, PR 6): each kept trip with
 * its days in order, the trip's kind on each (`tripDayKind`: At the site when anyone was, else On the road,
 * else Getting ready), whether it is still ahead, and the words its card says, its name with its number first. The lane itself, its bars
 * and its place on the view's own time axis are `lib/plans/plansByDate.ts`; this file only hands it trips.
 *
 * Pure. A trip with no day yet has nowhere to stand on a chart of dates and is left out.
 */
import type { PlansByDateTrip } from '../plans/plansByDate'
import { sortTrips, tripDayCounts, tripDayList, tripSpan, tripStanding, TRIP_STANDING_LABEL } from './tripDays'
import { NO_TRIP_PEOPLE, tripOfRecord, type TripRecord } from './tripRecord'
import { daysWords, TRIP_NO_DAY_WORDS, tripName } from './tripsLook'

export function plansByDateTrips(records: ReadonlyArray<TripRecord>, todayYmd: string): PlansByDateTrip[] {
  const recordById = new Map(records.map((r) => [r.id, r]))
  const out: PlansByDateTrip[] = []
  // A day's kind is over everyone on the trip, so how each person is keyed does not matter here.
  for (const trip of sortTrips(records.map((r) => tripOfRecord(r, NO_TRIP_PEOPLE)))) {
    const span = tripSpan(trip)
    const record = recordById.get(trip.id)
    if (!span || !record) continue
    const standing = tripStanding(trip, todayYmd)
    const name = tripName({ tripNumber: record.tripNumber, span, todayYmd })
    out.push({
      id: trip.id,
      days: tripDayList(trip),
      planned: standing === 'planned',
      when: name.days ?? TRIP_NO_DAY_WORDS,
      title: name.titled,
      number: name.number,
      door: name.door,
      standing: standing === 'planned' ? TRIP_STANDING_LABEL.planned : `${TRIP_STANDING_LABEL[standing]} · ${daysWords(tripDayCounts(trip).site)} at the site`,
      who: record.people.map((p) => p.name.trim()).filter(Boolean).join(', '),
      why: record.purpose.trim(),
    })
  }
  return out
}
