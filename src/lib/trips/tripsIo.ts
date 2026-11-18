/**
 * The reads and the writes behind a site's trips (punch list #379, PR 3; migration 20261117234500).
 * A site's trips are few, so one read holds them whole, each with its people and its jobs. A trip saves
 * through the one door, `trip_save`, whole or not at all, and a delete takes its people and jobs with it.
 * The days somebody said were **Not a trip** (PR 5) are read by the site, kept one row a person, and
 * deleted by their ids, which is the undo. Nothing here reads or writes a clock row for change: the
 * punches are read, never written.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import { PUNCH_COLUMNS, type PunchRow } from './tripHourRows'
import { TRIP_DISMISSAL_SELECT, type TripDismissalInsert, type TripDismissalRow } from './tripOffers'
import { tripFromRow, tripSavePayload, TRIP_SELECT, type TripRecord, type TripRosterPerson, type TripRow } from './tripRecord'

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

/** Save a trip whole through `trip_save`. The record's own id is sent, so the same call makes a deleted trip again. */
export async function saveTrip(record: TripRecord): Promise<void> {
  const { error } = await db.rpc('trip_save', { p: tripSavePayload(record), p_dry_run: false })
  if (error) throw error
}

/** Delete a trip with its people and its jobs. No clock row, bill or cost hangs on a trip. */
export async function deleteTrip(id: string): Promise<void> {
  const { error } = await db.from('trips').delete().eq('id', id)
  if (error) throw error
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
