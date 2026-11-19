/**
 * The reads and the writes behind a site's trips (punch list #379, PR 3; migration 20261117234500).
 * A site's trips are few, so one read holds them whole, each with its people and its jobs. A trip saves
 * through the one door, `trip_save`, whole or not at all, and a delete takes its people and jobs with it.
 * The days somebody said were **Not a trip** (PR 5) are read by the site, kept one row a person, and
 * deleted by their ids, which is the undo. The phone's two calls (PR 7b; migration 20261118030000) are here
 * too: `trip_phone_state` and `trip_phone`. Nothing here reads or writes a clock row for change: the
 * punches are read, never written.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import { PUNCH_COLUMNS, type PunchRow } from './tripHourRows'
import type { TripPhoneAct } from './tripPhone'
import { TRIP_DISMISSAL_SELECT, type TripDismissalInsert, type TripDismissalRow } from './tripOffers'
import { tripFromRow, tripNumberOf, tripSavePayload, TRIP_SELECT, type TripRecord, type TripRosterPerson, type TripRow } from './tripRecord'
import { parseDeletedTrips, type DeletedTrip } from './tripDeleted'
import { TRIP_FAR_MILES_KEY, tripFarMilesOf } from './tripFarMiles'
import { TRIP_FAR_MILES_DEFAULT } from './tripPlace'

// The tables are younger than the generated types; the next types PR removes this cast.
const db = supabase as unknown as SupabaseClient

type Paged<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/**
 * A site's trips: the ones on the development, and the ones a job of the site holds by itself (a trip made
 * on a job before the job joined the development follows it in).
 */
export async function readSiteTrips(developmentId: string, jobIds: ReadonlyArray<string>): Promise<TripRecord[]> {
  const onSite = await fetchAllRows<TripRow>((from, to) => db.from('trips').select(TRIP_SELECT).eq('development_id', developmentId).order('created_at').order('id').range(from, to) as unknown as Paged<TripRow>, 'read the site’s trips')
  const onJobs = jobIds.length
    ? await fetchAllRowsChunkedIn<TripRow, string>(
        [...jobIds],
        (chunk, from, to) => db.from('trips').select(TRIP_SELECT).is('development_id', null).in('job_id', chunk).order('created_at').order('id').range(from, to) as unknown as Paged<TripRow>,
        'read the trips the site’s jobs hold',
      )
    : []
  const seen = new Set<string>()
  const out: TripRecord[] = []
  for (const row of [...onSite, ...onJobs]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push(tripFromRow(row))
  }
  return out
}

/**
 * Save a trip whole through `trip_save`. The record's own id is sent, so the same call makes a deleted trip again,
 * and the number it had goes with it, so the database can give it back. The reply names the trip's number, which
 * the database hands out: it comes back here, null from a reply that names none.
 */
export async function saveTrip(record: TripRecord): Promise<number | null> {
  const { data, error } = await db.rpc('trip_save', { p: tripSavePayload(record), p_dry_run: false })
  if (error) throw error
  return tripNumberOf((data as { trip_number?: unknown } | null)?.trip_number)
}

/**
 * Split a trip in two at a day, through `trip_split` (migration 20261119010000): the trip keeps its id, its number
 * and every day before the day, and a new trip takes the day and every day after it. One call, so both land or
 * neither does. The function says what it cannot take in plain words (a day that leaves a half empty, a trip that
 * is gone), so that refusal is thrown as those words alone. Anything else is thrown as it came. The reply is
 * handed back as it came: `parseTripSplitReply` reads it.
 */
export async function splitTrip(tripId: string, fromDay: string): Promise<unknown> {
  const { data, error } = await db.rpc('trip_split', { p_trip_id: tripId, p_from_day: fromDay, p_dry_run: false })
  if (!error) return data as unknown
  const refusal = error as { code?: string; message?: string }
  if (refusal.code === '22023' && refusal.message?.trim()) throw new Error(refusal.message.trim())
  throw error
}

/** Delete a trip with its people and its jobs. No clock row, bill or cost hangs on a trip. */
export async function deleteTrip(id: string): Promise<void> {
  const { error } = await db.from('trips').delete().eq('id', id)
  if (error) throw error
}

/**
 * A site's deleted trips that nothing has put back, newest first (`trip_deleted_list`, migration 20261118100000).
 * For the trips office: the function refuses everyone else in words. Putting one back is `saveTrip`.
 */
export async function readDeletedTrips(developmentId: string): Promise<DeletedTrip[]> {
  const { data, error } = await db.rpc('trip_deleted_list', { p_development_id: developmentId })
  if (error) throw error
  return parseDeletedTrips(data)
}

/** The roster, for the sheet's Who went and for naming one person the same way everywhere. */
export async function readTripRoster(): Promise<TripRosterPerson[]> {
  type Row = { id: string; name: string; account_user_id: string | null }
  const rows = await fetchAllRows<Row>((from, to) => db.from('people').select('id, name, account_user_id').is('archived_at', null).order('name').order('id').range(from, to) as unknown as Paged<Row>, 'read the roster')
  return rows.map((r) => ({ id: r.id, name: r.name, userId: r.account_user_id }))
}

/** The clock's rows on the site's jobs with the places they carry; a rejected or revoked row is not a sighting. */
export async function readSitePunches(jobIds: ReadonlyArray<string>): Promise<PunchRow[]> {
  if (jobIds.length === 0) return []
  return fetchAllRowsChunkedIn<PunchRow, string>(
    [...jobIds],
    (chunk, from, to) => db.from('clock_sessions').select(PUNCH_COLUMNS).in('job_ledger_id', chunk).is('rejected_at', null).is('revoked_at', null).order('id').range(from, to) as unknown as Paged<PunchRow>,
    'read the punches on the site’s jobs',
  )
}

/** The addresses on a development's jobs and bids, and nothing else of them: what the site's shared address is read from. */
export type SiteAddresses = { jobs: Array<{ job_address: string | null }>; bids: Array<{ address: string | null }> }

/**
 * The addresses of a development's jobs and of its bids, by `development_id` (PR 6): the Job window reads the
 * site's point from the address they share (`sharedAddressWords`), as the Trips look does, so a job's bar and
 * the look's figures stand on one point. Two small reads of one column each.
 */
export async function readSiteAddresses(developmentId: string): Promise<SiteAddresses> {
  const [jobs, bids] = await Promise.all([
    fetchAllRows<{ job_address: string | null }>((from, to) => db.from('jobs_ledger').select('job_address').eq('development_id', developmentId).order('id').range(from, to) as unknown as Paged<{ job_address: string | null }>, 'read the addresses of the site’s jobs'),
    fetchAllRows<{ address: string | null }>((from, to) => db.from('bids').select('address').eq('development_id', developmentId).order('id').range(from, to) as unknown as Paged<{ address: string | null }>, 'read the addresses of the site’s bids'),
  ])
  return { jobs, bids }
}

/** The days on this site somebody said were not a trip, so Looks like a trip does not offer them again. */
export async function readSiteDismissals(developmentId: string): Promise<TripDismissalRow[]> {
  return fetchAllRows<TripDismissalRow>((from, to) => db.from('trip_dismissals').select(TRIP_DISMISSAL_SELECT).eq('development_id', developmentId).order('created_at').order('id').range(from, to) as unknown as Paged<TripDismissalRow>, 'read the days said to be not a trip')
}

/** Remember Not a trip, one row a person, said by the signed-in user. The rows come back with their ids, for the undo. */
export async function insertTripDismissals(rows: ReadonlyArray<TripDismissalInsert>): Promise<TripDismissalRow[]> {
  if (rows.length === 0) return []
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) throw new Error('Sign in first.')
  const { data, error } = await db
    .from('trip_dismissals')
    .insert(rows.map((r) => ({ ...r, dismissed_by: userId })))
    .select(TRIP_DISMISSAL_SELECT)
  if (error) throw error
  return (data ?? []) as unknown as TripDismissalRow[]
}

/** Take a Not a trip back: the rows go, and the days are offered again. */
export async function deleteTripDismissals(ids: ReadonlyArray<string>): Promise<void> {
  if (ids.length === 0) return
  const { error } = await db.from('trip_dismissals').delete().in('id', [...ids])
  if (error) throw error
}

/**
 * What the phone needs before it asks about a trip on a job (PR 7b): the reply of `trip_phone_state`, as it
 * came. `parseTripPhoneState` reads it. One small call, made for somebody already clocked in on the job.
 */
export async function readTripPhoneState(jobId: string): Promise<unknown> {
  const { data, error } = await db.rpc('trip_phone_state', { p_job_id: jobId })
  if (error) throw error
  return data as unknown
}

/** `trip_phone`'s own refusals: who may not press (42501) and a press it cannot take (22023). Its words are the screen's. */
const TRIP_PHONE_REFUSALS: ReadonlySet<string> = new Set(['42501', '22023'])

/**
 * One of the phone's four acts through `trip_phone`: start, join, day or end. It writes the caller's own
 * row on a trip and never a clock row, a bill or a cost. The function refuses in plain words (training
 * mode, a trip that has ended, a job on no site), so its own refusal is thrown as those words alone:
 * `formatErrorMessage` would otherwise read a 42501 as the house's *no access* sentence and lose them.
 * Anything else (a lost signal, a function that is not there yet) is thrown as it came.
 */
export async function sendTripPhoneAct(act: TripPhoneAct): Promise<void> {
  const { error } = await db.rpc('trip_phone', { p: act })
  if (!error) return
  const refusal = error as { code?: string; message?: string }
  if (TRIP_PHONE_REFUSALS.has(refusal.code ?? '') && refusal.message?.trim()) throw new Error(refusal.message.trim())
  throw error
}

/**
 * How far a site is from the shop before it is a trip from home (v2.7888): the one setting, `app_settings`
 * `trips_far_miles_v1`. Every signed-in user reads it. No row, a number out of range or a read that fails
 * answers the default, so the look and the phone behave as they did before the setting.
 */
export async function readTripFarMiles(): Promise<number> {
  const { data, error } = await db.from('app_settings').select('value_num').eq('key', TRIP_FAR_MILES_KEY).maybeSingle()
  if (error) return TRIP_FAR_MILES_DEFAULT
  return tripFarMilesOf((data as { value_num?: unknown } | null)?.value_num ?? null)
}

/** Sets the distance. A dev's write, by the table's own policy; anyone else is refused in the database's words. */
export async function saveTripFarMiles(miles: number): Promise<void> {
  const { error } = await db.from('app_settings').upsert({ key: TRIP_FAR_MILES_KEY, value_num: miles }, { onConflict: 'key' })
  if (error) throw error
}
