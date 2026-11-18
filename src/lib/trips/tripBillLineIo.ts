/**
 * The read and the press behind Put on a bill (punch list #391; migration 20261118060000).
 *
 * The read: the lines the site's trips hold, each with the status of the bill that took it. One small read
 * of `jobs_ledger_fixtures` by `trip_id`, under the line table's own row security.
 *
 * The press: `trip_put_on_job_line`. It writes one line, the job's total and one History row, or on a dry
 * run nothing, and answers the total before and after. It refuses in plain words (a trip that is not Extra,
 * a job that is not the trip's, the GC desk's billing job, training mode), so its own refusal is thrown as
 * those words alone: `formatErrorMessage` would read a 42501 as the house's *no access* sentence and lose
 * them. Anything else (a lost signal, a function that is not there yet) is thrown as it came.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { parseTripBillLineReply, TRIP_BILL_LINE_SELECT, tripBillLinesByTrip, type TripBillLine, type TripBillLineReply, type TripBillLineRow } from './tripBillLine'

// The column and the function are younger than the generated types; the next types PR removes this cast.
const db = supabase as unknown as SupabaseClient

type Paged<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/** The lines these trips hold, by trip. A trip with no line is not in the map. */
export async function readTripBillLines(tripIds: ReadonlyArray<string>): Promise<Map<string, TripBillLine>> {
  if (tripIds.length === 0) return new Map()
  const rows = await fetchAllRowsChunkedIn<TripBillLineRow, string>(
    [...tripIds],
    (chunk, from, to) => db.from('jobs_ledger_fixtures').select(TRIP_BILL_LINE_SELECT).in('trip_id', chunk).order('id').range(from, to) as unknown as Paged<TripBillLineRow>,
    'read the lines the site’s trips hold',
  )
  return tripBillLinesByTrip(rows)
}

export type TripBillLinePress = { tripId: string; jobId: string; amount: number; name: string; words: string; dryRun: boolean }

/** `trip_put_on_job_line`'s own refusals: who may not press (42501), a press it cannot take (22023), a trip or a job that is gone (P0002). */
const TRIP_BILL_LINE_REFUSALS: ReadonlySet<string> = new Set(['42501', '22023', 'P0002'])

/** Was this thrown by the function as its own refusal? Its words are the window's to show as they are. */
export class TripBillLineRefusal extends Error {}

/** Put the trip on the job's lines, or on a dry run say what the total would be. */
export async function putTripOnJobLine(press: TripBillLinePress): Promise<TripBillLineReply> {
  const { data, error } = await db.rpc('trip_put_on_job_line', {
    p_trip_id: press.tripId,
    p_job_id: press.jobId,
    p_amount: press.amount,
    p_name: press.name,
    p_words: press.words,
    p_dry_run: press.dryRun,
  })
  if (error) {
    const refusal = error as { code?: string; message?: string }
    if (TRIP_BILL_LINE_REFUSALS.has(refusal.code ?? '') && refusal.message?.trim()) throw new TripBillLineRefusal(refusal.message.trim())
    throw error
  }
  return parseTripBillLineReply(data)
}
