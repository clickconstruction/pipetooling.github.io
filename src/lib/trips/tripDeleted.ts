/**
 * Deleted trips, kept (v2.7800 the ground, migration 20261118100000; the fold after it). A deleted trip used to be
 * gone for good a minute after the press. It is now kept in the deleted-records archive for 90 days, and the trips
 * office reads a site's own through `trip_deleted_list`: each trip whole, with who deleted it and when.
 *
 * This file reads that reply and says each deleted trip in words for the **Deleted trips** fold on the Trips look.
 * Putting one back is the trip's own save under its own id, the door the Undo of a delete already uses, so nothing
 * here writes. A trip that went because it was joined into another (v2.7963, `trip_join`) says so and offers no
 * Put back: its days are on the joined trip, and a join is taken back with Split in two. Pure: days are `YYYY-MM-DD` strings in the company's calendar, and the caller hands in how an
 * instant becomes one.
 */
import { addDays } from './tripDays'
import { tripFromRow, tripNumberOf, type TripRecord, type TripRow } from './tripRecord'
import { monthDay, tripNameOfRecord, tripNumberWords } from './tripsLook'

/** How long the archive keeps a deleted row before its daily purge takes it. */
export const TRIP_DELETED_KEEP_DAYS = 90

/** The fold's name. */
export const TRIP_DELETED_FOLD_LABEL = 'Deleted trips'

/** The press that saves a deleted trip again. */
export const TRIP_PUT_BACK_LABEL = 'Put back'

/** What the open fold says first: how long, and what a put back does and does not do. */
export const TRIP_DELETED_NOTE = `A deleted trip is kept for ${TRIP_DELETED_KEEP_DAYS} days. Put back saves it again with its number. No clock row, bill or cost changes.`

/** What stands in the fold's place when the read failed. */
export const TRIP_DELETED_FAILED_WORDS = 'The deleted trips did not read. Reload to try again.'

/** What the delete's question says about the trip's way back, after its minute of Undo. */
export const TRIP_DELETE_KEPT_WORDS = `After that it waits under ${TRIP_DELETED_FOLD_LABEL} for ${TRIP_DELETED_KEEP_DAYS} days.`

export type DeletedTrip = {
  /** The trip as it was, ready for its own save. A job, a roster row or a login gone since is already left out. */
  record: TripRecord
  /** When it was deleted, as the database stamped it; null when the reply names none. */
  deletedAt: string | null
  /** Who deleted it, by name; null for a delete nobody is named for, such as one that came with a deleted job. */
  deletedByName: string | null
  /** How many jobs the trip named that have been deleted since. They are not in `record.jobIds`. */
  jobsGone: number
  /** The trip this one was joined into, which holds its days; null for a trip somebody deleted. */
  joinedInto: { tripId: string; tripNumber: number | null } | null
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Read `trip_deleted_list`'s reply. Anything that is not a trip with an id is passed over. */
export function parseDeletedTrips(data: unknown): DeletedTrip[] {
  if (!Array.isArray(data)) return []
  const out: DeletedTrip[] = []
  for (const item of data) {
    if (!isObject(item) || !isObject(item.trip) || typeof item.trip.id !== 'string' || !item.trip.id) continue
    const trip = item.trip
    const people = Array.isArray(trip.trip_people) ? trip.trip_people.filter((p) => isObject(p) && typeof p.person_name === 'string' && p.person_name.trim()) : []
    const jobs = Array.isArray(trip.trip_jobs) ? trip.trip_jobs.filter((j) => isObject(j) && typeof j.job_id === 'string' && j.job_id) : []
    const gone = typeof item.jobs_gone === 'number' && Number.isFinite(item.jobs_gone) && item.jobs_gone > 0 ? Math.floor(item.jobs_gone) : 0
    out.push({
      record: tripFromRow({ ...trip, trip_people: people, trip_jobs: jobs } as unknown as TripRow),
      deletedAt: typeof item.deleted_at === 'string' && item.deleted_at ? item.deleted_at : null,
      deletedByName: typeof item.deleted_by_name === 'string' && item.deleted_by_name.trim() ? item.deleted_by_name.trim() : null,
      jobsGone: gone,
      joinedInto: isObject(item.joined_into) && typeof item.joined_into.trip_id === 'string' && item.joined_into.trip_id ? { tripId: item.joined_into.trip_id, tripNumber: tripNumberOf(item.joined_into.trip_number) } : null,
    })
  }
  return out
}

/** One deleted trip as the fold draws it. */
export type DeletedTripLine = {
  id: string
  /** *Trip 3 · Nov 9 to 11*, or its days alone for a trip made before numbers. */
  name: string
  /** What it was for. */
  why: string
  /** Who went, by name. */
  who: string
  /** *Deleted Nov 18 by Dana*, and *Joined into Trip 7 on Nov 18 by Dana* for a trip that was joined away. */
  deleted: string
  /** *Its days are on Trip 7. To take the join back, press Split in two on Trip 7.*; null for a trip somebody deleted. It has no Put back. */
  joined: string | null
  /** *kept until Feb 16*; null when the day it was deleted is not known. */
  kept: string | null
  /** *A job it named is gone since.*; null when every job it named is still there. */
  gone: string | null
  /** The press by the trip's own name, for its title: *Put back Trip 3, Nov 9 to 11*. */
  pressLabel: string
}

/** *A job it named is gone since.* A put back saves the trip without it. */
export function deletedTripGoneWords(jobsGone: number): string | null {
  if (jobsGone <= 0) return null
  return jobsGone === 1 ? 'A job it named is gone since.' : `${jobsGone} jobs it named are gone since.`
}

/** Say one deleted trip. `toYmd` turns the delete's instant into a day of the company's calendar. */
export function deletedTripLine(d: DeletedTrip, args: { todayYmd: string; toYmd: (iso: string) => string | null }): DeletedTripLine {
  const name = tripNameOfRecord(d.record, args.todayYmd)
  const day = d.deletedAt ? args.toYmd(d.deletedAt) : null
  const until = day ? addDays(day, TRIP_DELETED_KEEP_DAYS) : null
  const into = d.joinedInto ? (tripNumberWords(d.joinedInto.tripNumber) ?? 'another trip') : null
  return {
    id: d.record.id,
    name: name.full,
    why: d.record.purpose.trim() || 'A trip',
    who: d.record.people.map((p) => p.name.trim()).filter(Boolean).join(', '),
    deleted: [into ? `Joined into ${into}` : 'Deleted', day ? `${into ? 'on ' : ''}${monthDay(day)}` : null, d.deletedByName ? `by ${d.deletedByName}` : null].filter(Boolean).join(' '),
    joined: into ? `Its days are on ${into === 'another trip' ? 'that trip' : into}. To take the join back, press Split in two on ${into === 'another trip' ? 'that trip' : into}.` : null,
    kept: until ? (until <= args.todayYmd ? 'goes within a day' : `kept until ${monthDay(until)}`) : null,
    gone: deletedTripGoneWords(d.jobsGone),
    pressLabel: `${TRIP_PUT_BACK_LABEL} ${name.said}`,
  }
}

export function deletedTripLines(list: ReadonlyArray<DeletedTrip>, args: { todayYmd: string; toYmd: (iso: string) => string | null }): DeletedTripLine[] {
  return list.map((d) => deletedTripLine(d, args))
}
