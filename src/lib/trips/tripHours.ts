/**
 * How a site's hours fall into its trips (v2.7653, punch list #379, PR 1). The owner's question on a site
 * away from home is not how many hours were put on its jobs. It is how many of them were at the site.
 *
 * The rules, in the card's words:
 * - A person's clock rows on a trip day take that day's kind.
 * - A punch that carries a place counts At the site only when the place is the site. On a day painted
 *   At the site, a punch somewhere else is out on the trip and not at the site: it counts On the road.
 * - A row with no place, an imported or scheduled one, is its own figure, **No place on the punch**. It
 *   says the day was paid, not where, and it is never added to At the site.
 * - Hours on the site's jobs outside every trip the person was on are **At home for the site**.
 *
 * The five figures always add up to the hours handed in: nothing is dropped and nothing counted twice.
 * Pure; the reads make the rows, and nothing here changes one.
 */
import { sortTrips, tripDayOfPerson, type Trip, type TripDayKind } from './tripDays'
import type { TripPlace } from './tripPlace'

/** One person's hours on one of the site's jobs on one day, with what that day's punches say about the site. */
export type TripHourRow = {
  personKey: string
  ymd: string
  hours: number
  place: TripPlace
  jobId?: string | null
}

export type TripHourBucket = 'site' | 'road' | 'ready' | 'noPlace' | 'home'

export const TRIP_HOUR_BUCKET_LABEL: Readonly<Record<TripHourBucket, string>> = {
  site: 'At the site',
  road: 'On the road',
  ready: 'Getting ready',
  noPlace: 'No place on the punch',
  home: 'At home for the site',
}

/** The four figures of hours inside a trip, and their sum. */
export type TripHours = { site: number; road: number; ready: number; noPlace: number; all: number }

/** A site's or a job's hours: the trip figures, the hours outside every trip, and what is not at the site. */
export type SiteTripHours = TripHours & { home: number; notAtSite: number }

export type TripHoursOfTrip = TripHours & {
  byPerson: Map<string, TripHours>
  /** Hours by the job they were put on; a row with no job is under the empty key. */
  byJob: Map<string, number>
}

export type TripHoursSplit = {
  site: SiteTripHours
  byTrip: Map<string, TripHoursOfTrip>
  /** The same five figures for each job, for the Job window's line. */
  byJob: Map<string, SiteTripHours>
  /** At home for the site, by person and job, most hours first. */
  home: Array<{ personKey: string; jobId: string | null; hours: number }>
}

/** Which figure a row's hours are: the day's kind for that person (null when no trip covers it), and the place. */
export function tripHourBucket(kind: TripDayKind | null, place: TripPlace): TripHourBucket {
  if (kind == null) return 'home'
  if (place === 'none') return 'noPlace'
  if (kind === 'site') return place === 'site' ? 'site' : 'road'
  return kind
}

const noHours = (): TripHours => ({ site: 0, road: 0, ready: 0, noPlace: 0, all: 0 })
const noSiteHours = (): SiteTripHours => ({ ...noHours(), home: 0, notAtSite: 0 })

function add(into: TripHours, bucket: Exclude<TripHourBucket, 'home'>, hours: number): void {
  into[bucket] += hours
  into.all += hours
}

function addSite(into: SiteTripHours, bucket: TripHourBucket, hours: number): void {
  if (bucket === 'home') {
    into.home += hours
    into.all += hours
  } else add(into, bucket, hours)
  if (bucket !== 'site') into.notAtSite += hours
}

/**
 * Split the site's hours over its trips. Every trip is in the answer, a planned one with zeros. Rows with
 * no hours are skipped. A person-day two trips both claim goes to the trip that went out first.
 */
export function splitTripHours(args: { trips: ReadonlyArray<Trip>; rows: ReadonlyArray<TripHourRow> }): TripHoursSplit {
  const trips = sortTrips(args.trips)
  const site = noSiteHours()
  const byTrip = new Map<string, TripHoursOfTrip>()
  for (const t of trips) byTrip.set(t.id, { ...noHours(), byPerson: new Map(), byJob: new Map() })
  const byJob = new Map<string, SiteTripHours>()
  const home = new Map<string, { personKey: string; jobId: string | null; hours: number }>()
  for (const r of args.rows) {
    const hours = Number(r.hours)
    if (!Number.isFinite(hours) || !(hours > 0)) continue
    const on = tripDayOfPerson(trips, r.personKey, r.ymd)
    const bucket = tripHourBucket(on?.kind ?? null, r.place)
    const jobId = r.jobId ?? null
    addSite(site, bucket, hours)
    if (jobId) {
      let j = byJob.get(jobId)
      if (!j) {
        j = noSiteHours()
        byJob.set(jobId, j)
      }
      addSite(j, bucket, hours)
    }
    if (bucket === 'home' || !on) {
      const key = `${r.personKey}\u0000${jobId ?? ''}`
      const h = home.get(key) ?? { personKey: r.personKey, jobId, hours: 0 }
      h.hours += hours
      home.set(key, h)
      continue
    }
    const t = byTrip.get(on.trip.id)
    if (!t) continue
    add(t, bucket, hours)
    let p = t.byPerson.get(r.personKey)
    if (!p) {
      p = noHours()
      t.byPerson.set(r.personKey, p)
    }
    add(p, bucket, hours)
    t.byJob.set(jobId ?? '', (t.byJob.get(jobId ?? '') ?? 0) + hours)
  }
  return {
    site,
    byTrip,
    byJob,
    home: [...home.values()].sort((a, b) => b.hours - a.hours || a.personKey.localeCompare(b.personKey) || (a.jobId ?? '').localeCompare(b.jobId ?? '')),
  }
}

/** The share of a site's hours that were at the site, 0 to 1; null when there are no hours to share. */
export function atSiteShare(h: Pick<SiteTripHours, 'site' | 'all'>): number | null {
  return h.all > 0 ? h.site / h.all : null
}
