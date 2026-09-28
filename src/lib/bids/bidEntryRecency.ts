import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { buildBidEntryRecencyMaps, type BidScopedEntryLike } from './bidContacts'

/**
 * "When was each bid last contacted, and last touched?" — the two recency maps the Bids page
 * loads with its bids: the chase lenses' last contact (method entries only) and the Followup
 * "Last update" (any entry).
 *
 * The page used to read the whole `bids_submission_entries` table with no filter, order or
 * range on every load. PostgREST answers an un-ranged read with at most `max_rows` (1,000)
 * rows and a 200; the table held 752 rows on 2026-09-28, so the read was one busy month from
 * dropping an arbitrary part of the log — bids would have shown a stale last contact, or
 * none, with nothing in the error path. This reads the entries of the bids in hand: chunked
 * `.in()`, each chunk paged with a stable `.order('bid_id').order('id')` (the shape of
 * `loadCountRowTalliesByBid`).
 */

type Client = SupabaseClient<Database>

export type BidEntryRecency = {
  /** bid id → the newest entry of any kind. */
  lastActivityByBid: Record<string, string>
  /** bid id → the newest entry that names a contact method. */
  lastContactByBid: Record<string, string>
}

/**
 * The recency maps for `bidIds`. Returns empty maps for no ids. Throws DatabaseError on any
 * page error — the caller decides what a failed read shows.
 */
export async function loadBidEntryRecency(supabase: Client, bidIds: ReadonlyArray<string>): Promise<BidEntryRecency> {
  const rows = await fetchAllRowsChunkedIn<BidScopedEntryLike, string>(
    [...bidIds],
    (chunk, from, to) =>
      supabase
        .from('bids_submission_entries')
        .select('bid_id, occurred_at, contact_method')
        .in('bid_id', chunk)
        .order('bid_id', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    'load bid entry recency',
  )
  const maps = buildBidEntryRecencyMaps(rows)
  return { lastActivityByBid: maps.lastActivityByBid, lastContactByBid: maps.lastContactByBid }
}
