/**
 * A job says its trips (punch list #379, PR 6). The owner's own example is why this exists: a trip that was
 * part of one job had been given a job of its own, only so it could be seen alone. With a trip kept on the
 * site and its work named on a job, the Job window reads the trip back: one line under the address, the
 * job's hours in the five figures, and a tag on each clock line in the feed.
 *
 * Three readings, all pure:
 * - `jobTripsLine`: *3 trips · last Oct 23 to Nov 4, Luis, Priya · next Dec 1 to 5*, from the trips whose
 *   work goes on the job.
 * - `clockTripTag`: what one clock line wears. It is the figure the bar and the Trips look give that
 *   day's hours, `tripHourBucket(the day's kind for that person, the place of that person's day on the
 *   job)`, so two punches by one person on one day wear one tag, and a tag never disagrees with the bar.
 * - `jobTripHours`: the job's hours laid over the site's trips, as the Trips look lays the site's.
 *
 * Nothing here writes, and nothing a trip holds changes a clock row, a bill or a cost.
 */
import type { LatLng } from '../jobTravelEstimate'
import type { SiteLabor } from '../developments/siteLabor'
import { sortTrips, tripDayOfPerson, tripSpan, tripStanding, type Trip } from './tripDays'
import { placeKey, placesByPersonDay, tripHourRowsFromLabor, type PunchRow } from './tripHourRows'
import { splitTripHours, tripHourBucket, type SiteTripHours, type TripHourBucket } from './tripHours'
import type { TripPlace } from './tripPlace'
import { NO_TRIP_PEOPLE, tripOfRecord, tripPersonKey, type TripPeopleIndex, type TripRecord } from './tripRecord'
import { tripSpanWords } from './tripsLook'

/** The trips whose work goes on a job: the ones that name it under *Work goes on*. */
export function tripsOnJob(records: ReadonlyArray<TripRecord>, jobId: string): TripRecord[] {
  return records.filter((r) => r.jobIds.includes(jobId))
}

export type JobTripsLine = {
  /** Trips on the job that have gone out: out now or back. */
  gone: number
  /** *3 trips*; null when none has gone out yet. */
  count: string | null
  /** *last Oct 23 to Nov 4, Luis, Priya*, or *out now …* for a trip that is out today; null when none has gone out. */
  last: string | null
  /** *next Dec 1 to 5*: the first planned trip; null when none is planned. */
  next: string | null
  /** The parts that exist, joined: *3 trips · last Oct 23 to Nov 4, Luis, Priya · next Dec 1 to 5*. */
  words: string
}

/**
 * The line a job says about its trips; null for a job no trip names, so every other Job window is unchanged.
 * It counts the trips that have gone out, names the newest of those with who went, and names the first
 * planned one. A part that does not exist is left out.
 */
export function jobTripsLine(args: { records: ReadonlyArray<TripRecord>; jobId: string; todayYmd: string }): JobTripsLine | null {
  const mine = tripsOnJob(args.records, args.jobId)
  if (mine.length === 0) return null
  const recordById = new Map(mine.map((r) => [r.id, r]))
  const inOrder = sortTrips(mine.map((r) => tripOfRecord(r, NO_TRIP_PEOPLE)))
  const gone = inOrder.filter((t) => tripStanding(t, args.todayYmd) !== 'planned')
  const planned = inOrder.filter((t) => tripStanding(t, args.todayYmd) === 'planned' && tripSpan(t))
  const when = (t: Trip): string => {
    const span = tripSpan(t)
    return span ? tripSpanWords(span.first, span.last, args.todayYmd) : ''
  }
  const newest = gone[gone.length - 1]
  const first = planned[0]
  const count = gone.length ? `${gone.length} ${gone.length === 1 ? 'trip' : 'trips'}` : null
  const names = newest ? (recordById.get(newest.id)?.people ?? []).map((p) => p.name.trim()).filter(Boolean).join(', ') : ''
  const last = newest ? [`${tripStanding(newest, args.todayYmd) === 'out' ? 'out now' : 'last'} ${when(newest)}`, names].filter(Boolean).join(', ') : null
  const next = first ? `next ${when(first)}` : null
  return { gone: gone.length, count, last, next, words: [count, last, next].filter(Boolean).join(' · ') }
}

// ---- the tag on a clock line --------------------------------------------------------------------

/** What a clock line wears: the figure its hours are, and the words. */
export type ClockTripTag = {
  bucket: TripHourBucket
  words: string
  /** True for *at home for the site*, which is a quiet chip and not a trip's tag. */
  quiet: boolean
}

export const CLOCK_TRIP_TAG_WORDS: Readonly<Record<TripHourBucket, string>> = {
  site: 'TRIP · AT THE SITE',
  road: 'TRIP · ON THE ROAD',
  ready: 'TRIP · GETTING READY',
  noPlace: 'TRIP · NO PLACE ON THE PUNCH',
  home: 'at home for the site',
}

/**
 * The tag for one clock line: the site's trips in the order they went out (`sortTrips`), the person, the
 * day and what that person's whole day of punches says about the site (`placesByPersonDay`, the place the
 * hours split reads). A person on a trip that day wears the trip's tag. A person on no trip that day wears
 * *at home for the site*. A site with no trip gives nothing, so a local job's lines never change.
 */
export function clockTripTag(args: { tripsInOrder: ReadonlyArray<Trip>; personKey: string; ymd: string; place: TripPlace }): ClockTripTag | null {
  if (args.tripsInOrder.length === 0) return null
  const on = tripDayOfPerson(args.tripsInOrder, args.personKey, args.ymd)
  const bucket = tripHourBucket(on?.kind ?? null, args.place)
  return { bucket, words: CLOCK_TRIP_TAG_WORDS[bucket], quiet: bucket === 'home' }
}

/** A clock row on the job with its id, which is how the feed names the same row. */
export type JobPunchRow = PunchRow & { id: string }

/** The key the Job window's feed gives a clock line (`jobThreadClockActivity.ts`): `cs:<clock_sessions.id>`. */
export const clockLineKey = (sessionId: string): string => `cs:${sessionId}`

/**
 * A tag for every clock row on the job, by the feed's key. Each row takes the place of its person's whole
 * day on the job, so every row of one person on one day wears the same tag, the one the bar counts that
 * day's hours under. Empty for a site with no trip.
 */
export function jobClockTags(args: { records: ReadonlyArray<TripRecord>; index: TripPeopleIndex; punches: ReadonlyArray<JobPunchRow>; site: LatLng | null }): Map<string, ClockTripTag> {
  const out = new Map<string, ClockTripTag>()
  if (args.records.length === 0) return out
  const tripsInOrder = sortTrips(args.records.map((r) => tripOfRecord(r, args.index)))
  const places = placesByPersonDay(args.punches, args.site, args.index)
  for (const p of args.punches) {
    if (!p.id || !p.work_date) continue
    const personKey = tripPersonKey(args.index, { userId: p.user_id })
    const tag = clockTripTag({ tripsInOrder, personKey, ymd: p.work_date, place: places.get(placeKey(personKey, p.work_date)) ?? 'none' })
    if (tag) out.set(clockLineKey(p.id), tag)
  }
  return out
}

// ---- the job's hours in the five figures ---------------------------------------------------------

const NO_HOURS: SiteTripHours = { site: 0, road: 0, ready: 0, noPlace: 0, all: 0, home: 0, notAtSite: 0 }

/**
 * One job's hours laid over the site's trips: At the site, On the road, Getting ready, No place on the
 * punch and At home for the site. `labor` is the read for this job alone. Null when the days are not
 * known (a reader the clock's rows are closed to), since an hour with no day cannot be laid over a trip.
 */
export function jobTripHours(args: { records: ReadonlyArray<TripRecord>; index: TripPeopleIndex; labor: SiteLabor; punches: ReadonlyArray<PunchRow>; site: LatLng | null; jobId: string }): SiteTripHours | null {
  const places = placesByPersonDay(args.punches, args.site, args.index)
  const rows = tripHourRowsFromLabor(args.labor, args.index, places)
  if (!rows) return null
  const split = splitTripHours({ trips: args.records.map((r) => tripOfRecord(r, args.index)), rows })
  return split.byJob.get(args.jobId) ?? { ...NO_HOURS }
}

/** How the job's hours stand: being read, read, closed to this reader, or unread. */
export type JobTripsHoursState = 'reading' | 'read' | 'closed' | 'failed'

/** What stands in for the bar while the job's hours cannot be laid over the trips. */
export const JOB_TRIPS_HOURS_WORDS: Readonly<Record<Exclude<JobTripsHoursState, 'read'>, string>> = {
  reading: 'Reading this job’s hours…',
  closed: 'The clock’s days are closed to you, so this job’s hours are not laid over the trips.',
  failed: 'The clock would not read, so this job’s hours are not laid over the trips. Open the job again to try.',
}

/** What the line says when the site's address has no point, so no punch can be checked against the site: the Trips look's own words. */
export const JOB_TRIPS_NO_POINT_WORDS = 'This site’s address has no point on the map yet. No punch can be checked against it, so no hour reads At the site.'

// ---- the door to the site's trips ----------------------------------------------------------------

/** The query that lands the Development page on a look: `?look=trips`. */
export const DEVELOPMENT_LOOK_PARAM = 'look'

/** The Development page at its Trips look. */
export function tripsLookHref(developmentId: string): string {
  return `/developments/${encodeURIComponent(developmentId)}?${DEVELOPMENT_LOOK_PARAM}=trips`
}

/** Whether a link asked for the Trips look. */
export function asksForTripsLook(search: URLSearchParams): boolean {
  return search.get(DEVELOPMENT_LOOK_PARAM) === 'trips'
}
