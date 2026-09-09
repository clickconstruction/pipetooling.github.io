import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { fetchAllRowsChunkedIn } from '../supabasePaging'

/**
 * "How many count rows does each bid have?" (v2.3203) — the tally behind the
 * Counts bid picker's left column (v2.2381) and the Adopt-bid modal's
 * "N count rows" preview (v2.2133).
 *
 * Both used to run one un-ranged `.in('bid_id', …)` per 100–400 bids.
 * PostgREST answers an un-ranged read with at most `max_rows` (1,000) rows and
 * a 200, so once a chunk's bids carried more than 1,000 rows between them the
 * tail of the chunk was simply missing: bids showed a low count or none,
 * with nothing in the error path. The `[row-cap] bids_count_rows` tripwire
 * fired on the Bids page on 2026-09-09. Every read of this shape goes through
 * here now: chunked `.in()`, each chunk paged with a stable
 * `.order('bid_id').order('id')` so pages don't shuffle between requests.
 */

type Client = SupabaseClient<Database>

type BidIdRow = { bid_id: string }

/** Rows → `bid_id → row count`. Pure; bids with no rows are absent (callers default to 0). */
export function tallyRowsByBidId(rows: ReadonlyArray<BidIdRow>): Map<string, number> {
  const tally = new Map<string, number>()
  for (const r of rows) tally.set(r.bid_id, (tally.get(r.bid_id) ?? 0) + 1)
  return tally
}

/**
 * Count-row tallies for `bidIds` (chunked `.in()`, paged per chunk). Returns an
 * empty map for no ids. Throws DatabaseError on any page error — callers must
 * not read a failure as "no count rows".
 */
export async function loadCountRowTalliesByBid(supabase: Client, bidIds: ReadonlyArray<string>): Promise<Map<string, number>> {
  const rows = await fetchAllRowsChunkedIn<BidIdRow, string>(
    [...bidIds],
    (chunk, from, to) =>
      supabase
        .from('bids_count_rows')
        .select('bid_id')
        .in('bid_id', chunk)
        .order('bid_id', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    'load count-row tallies by bid',
  )
  return tallyRowsByBidId(rows)
}
