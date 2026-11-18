/**
 * A trip as it is kept (punch list #379, PR 3): the row with its people and its jobs, read back into one
 * record, the payload the one write door takes, and the draft a person fills on the sheet. Also here: how
 * one person is named the same way by the crew's days (the roster person), the clock (the login) and a
 * trip (either, or a name alone), so their hours can be laid over their days.
 *
 * Pure. `tripsIo.ts` reads and writes; the rules themselves are `tripDays.ts`, `tripHours.ts`.
 */
import { parseTripDays, tripCanSave, type Trip, type TripDays } from './tripDays'

export type TripAskedBy = 'us' | 'them'
export type TripBilling = 'inside' | 'extra' | 'ours'

export const TRIP_BILLINGS: ReadonlyArray<TripBilling> = ['inside', 'extra', 'ours']

export const TRIP_BILLING_LABEL: Readonly<Record<TripBilling, string>> = {
  inside: 'Inside the price',
  extra: 'Extra',
  ours: 'Ours',
}

/** What each billing means, under the chip on an open trip. */
export const TRIP_BILLING_WORDS: Readonly<Record<TripBilling, string>> = {
  inside: 'part of the job’s price, not billed apart',
  extra: 'past the job’s price, to be billed with its reason',
  ours: 'our own cost, no bill',
}

export const TRIP_PURPOSE_MAX = 500
export const TRIP_ASKED_MAX = 200
export const TRIP_OUTCOME_MAX = 2000
export const TRIP_NAME_MAX = 200

export type TripRecordPerson = {
  /** The roster person (`people.id`); null for someone not in the app. */
  personId: string | null
  /** The person's login, which is how the clock names them; null when they have none. */
  userId: string | null
  name: string
  days: TripDays
}

export type TripRecord = {
  id: string
  developmentId: string | null
  /** The job that holds the trip when no development does. */
  jobId: string | null
  purpose: string
  askedBy: TripAskedBy | null
  askedWho: string
  askedHow: string
  outcome: string
  billing: TripBilling | null
  via: string
  people: TripRecordPerson[]
  /** The jobs the trip's work goes on. */
  jobIds: string[]
  createdAt: string | null
}

/** The row as the read asks for it, its people and jobs embedded. */
export type TripRow = {
  id: string
  development_id: string | null
  job_id: string | null
  purpose: string | null
  asked_by: string | null
  asked_who: string | null
  asked_how: string | null
  outcome: string | null
  billing: string | null
  via: string | null
  created_at: string | null
  trip_people: Array<{ person_id: string | null; user_id: string | null; person_name: string; days: unknown }> | null
  trip_jobs: Array<{ job_id: string }> | null
}

export const TRIP_SELECT = 'id, development_id, job_id, purpose, asked_by, asked_who, asked_how, outcome, billing, via, created_at, trip_people(person_id, user_id, person_name, days), trip_jobs(job_id)'

const isAskedBy = (v: unknown): v is TripAskedBy => v === 'us' || v === 'them'
const isBilling = (v: unknown): v is TripBilling => v === 'inside' || v === 'extra' || v === 'ours'

export function tripFromRow(row: TripRow): TripRecord {
  return {
    id: row.id,
    developmentId: row.development_id,
    jobId: row.job_id,
    purpose: row.purpose ?? '',
    askedBy: isAskedBy(row.asked_by) ? row.asked_by : null,
    askedWho: row.asked_who ?? '',
    askedHow: row.asked_how ?? '',
    outcome: row.outcome ?? '',
    billing: isBilling(row.billing) ? row.billing : null,
    via: row.via ?? 'app',
    people: (row.trip_people ?? [])
      .map((p) => ({ personId: p.person_id, userId: p.user_id, name: p.person_name, days: parseTripDays(p.days) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    jobIds: (row.trip_jobs ?? []).map((j) => j.job_id),
    createdAt: row.created_at,
  }
}

/** What `trip_save` takes: the trip whole. An id is always sent, so a save and its undo name the same trip. */
export function tripSavePayload(t: TripRecord): Record<string, unknown> {
  return {
    id: t.id,
    development_id: t.developmentId,
    job_id: t.jobId,
    purpose: t.purpose.trim().slice(0, TRIP_PURPOSE_MAX),
    asked_by: t.askedBy,
    asked_who: t.askedBy === 'them' ? t.askedWho.trim().slice(0, TRIP_ASKED_MAX) : '',
    asked_how: t.askedBy === 'them' ? t.askedHow.trim().slice(0, TRIP_ASKED_MAX) : '',
    outcome: t.outcome.trim().slice(0, TRIP_OUTCOME_MAX),
    billing: t.billing,
    via: t.via || 'app',
    people: t.people
      .filter((p) => p.name.trim())
      .map((p) => ({ person_id: p.personId, user_id: p.userId, name: p.name.trim().slice(0, TRIP_NAME_MAX), days: p.days })),
    job_ids: [...new Set(t.jobIds)],
  }
}

/** Why a trip cannot save yet, in the sheet's words; null when it can. One person and one day is a whole trip. */
export function tripProblem(t: Pick<TripRecord, 'people'>): string | null {
  const named = t.people.filter((p) => p.name.trim())
  if (named.length === 0) return 'Add who went.'
  const seen = new Set<string>()
  for (const p of named) {
    const key = p.name.trim().toLowerCase()
    if (seen.has(key)) return `${p.name.trim()} is on this trip twice.`
    seen.add(key)
  }
  if (!tripCanSave({ people: named.map((p) => ({ personKey: p.name, name: p.name, days: p.days })) })) return 'Pick at least one day.'
  return null
}

// ---- one person, three names ------------------------------------------------------------------

/** A roster person as the reads give them. */
export type TripRosterPerson = { id: string; name: string; userId: string | null }

export type TripPeopleIndex = {
  byUserId: ReadonlyMap<string, string>
  /** By lower-cased name; a name two roster people share is left out, since it names neither. */
  byName: ReadonlyMap<string, string>
}

export function tripPeopleIndex(roster: ReadonlyArray<TripRosterPerson>): TripPeopleIndex {
  const byUserId = new Map<string, string>()
  const byName = new Map<string, string>()
  const shared = new Set<string>()
  for (const p of roster) {
    if (p.userId) byUserId.set(p.userId, p.id)
    const name = p.name.trim().toLowerCase()
    if (!name) continue
    if (byName.has(name) && byName.get(name) !== p.id) shared.add(name)
    else byName.set(name, p.id)
  }
  for (const name of shared) byName.delete(name)
  return { byUserId, byName }
}

/** An index with nobody in it: every person then goes by their own id, login or name. */
export const NO_TRIP_PEOPLE: TripPeopleIndex = { byUserId: new Map(), byName: new Map() }

/**
 * The one key a person goes by across the crew's days, the clock and a trip: the roster person when any of
 * the three names reaches one, else the login, else the name as written.
 */
export function tripPersonKey(index: TripPeopleIndex, who: { personId?: string | null; userId?: string | null; name?: string | null }): string {
  if (who.personId) return `p:${who.personId}`
  const viaUser = who.userId ? index.byUserId.get(who.userId) : undefined
  if (viaUser) return `p:${viaUser}`
  const name = (who.name ?? '').trim().toLowerCase()
  const viaName = name ? index.byName.get(name) : undefined
  if (viaName) return `p:${viaName}`
  if (who.userId) return `u:${who.userId}`
  return `n:${name}`
}

/** A kept trip as the rules read it: each person under their one key. */
export function tripOfRecord(record: TripRecord, index: TripPeopleIndex): Trip {
  return {
    id: record.id,
    people: record.people.map((p) => ({ personKey: tripPersonKey(index, p), name: p.name, days: p.days })),
    jobIds: record.jobIds,
  }
}

/** A new trip with nobody on it yet, for the sheet. The id is made here so a save can be undone by its id. */
export function newTripRecord(args: { id: string; developmentId: string | null; jobId?: string | null }): TripRecord {
  return { id: args.id, developmentId: args.developmentId, jobId: args.jobId ?? null, purpose: '', askedBy: null, askedWho: '', askedHow: '', outcome: '', billing: null, via: 'app', people: [], jobIds: [], createdAt: null }
}
