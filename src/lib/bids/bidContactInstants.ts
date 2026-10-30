import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { fetchAllRowsChunkedIn } from '../supabasePaging'

/**
 * Every contact's instant per bid (punch list #217, bids-7): the method entries of the bids in
 * hand, for the chase clock's contact dots. The shape of `loadBidEntryRecency` — chunked
 * `.in()`, each chunk paged on a stable order — read only while the strip is on. A method-less
 * note is not a contact (v2.2413) and is left out at the database.
 */
export async function loadBidContactInstants(supabase: SupabaseClient<Database>, bidIds: ReadonlyArray<string>): Promise<Record<string, string[]>> {
  if (bidIds.length === 0) return {}
  const rows = await fetchAllRowsChunkedIn<{ bid_id: string; occurred_at: string }, string>(
    [...bidIds],
    (chunk, from, to) =>
      supabase
        .from('bids_submission_entries')
        .select('bid_id, occurred_at')
        .in('bid_id', chunk)
        .not('contact_method', 'is', null)
        .order('bid_id', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    'load bid contact instants',
  )
  const out: Record<string, string[]> = {}
  for (const r of rows) {
    if (!r.occurred_at) continue
    ;(out[r.bid_id] ??= []).push(r.occurred_at)
  }
  return out
}
