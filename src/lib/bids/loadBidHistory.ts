import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import { BID_ACTIONS, withBidAction } from './bidActionHeader'
import { BID_HISTORY_PAGE, bidHistoryRowFromRpc, type BidHistoryRow, type BidHistoryRpcRow } from './bidHistory'
import { bidRemovedRowFromRpc, type BidPutBackResult, type BidRemovedRow, type BidRemovedRpcRow, type BidRestoreResult } from './bidHistoryPutBack'

/**
 * One page of a bid's history (punch list #73, PR 2; paged since the row-cap fix):
 * `list_bid_history`, newest first in a total order, rows `from` to `from + BID_HISTORY_PAGE - 1`.
 * It runs under the caller's own policies: the ledger for whoever can read the bid, the delete
 * archive's removed rows for a dev. A page shorter than `BID_HISTORY_PAGE` is the last. Throws the
 * read's error so the window can say it.
 */
export async function loadBidHistory(bidId: string, from = 0, client: SupabaseClient<Database> = supabase): Promise<BidHistoryRow[]> {
  const { data, error } = await client.rpc('list_bid_history', { p_bid_id: bidId }).range(from, from + BID_HISTORY_PAGE - 1)
  if (error) throw new Error(error.message)
  return ((data ?? []) as BidHistoryRpcRow[]).map(bidHistoryRowFromRpc)
}

/**
 * Put back one value (punch list #73, PR 4): `put_back_bid_change` writes the change's old value
 * for that column under the caller's own policies; with no column (Undo, PR 6), every column the
 * change touched. Throws the function's refusal so the window can say it.
 */
export async function putBackBidChange(changeId: number, column: string | null): Promise<BidPutBackResult> {
  const { data, error } = await supabase.rpc('put_back_bid_change', { p_change_id: changeId, p_column: column ?? undefined })
  if (error) throw new Error(error.message)
  return data as unknown as BidPutBackResult
}

/**
 * The bid's own removed rows still out (punch list #73, PR 5): `list_bid_removed_rows`, which reads
 * the delete archive for whoever can edit the bid, a page at a time (PostgREST's 1,000-row cap).
 * Someone who cannot edit the bid gets none, and so does a database the function has not reached
 * yet: the window works without them. Any other failure throws.
 */
export async function loadBidRemovedRows(bidId: string, client: SupabaseClient<Database> = supabase): Promise<BidRemovedRow[]> {
  const out: BidRemovedRow[] = []
  for (let from = 0; ; from += BID_HISTORY_PAGE) {
    // Not in the generated types until the push regenerates them.
    const { data, error } = await client.rpc('list_bid_removed_rows' as never, { p_bid_id: bidId } as never).range(from, from + BID_HISTORY_PAGE - 1)
    if (error) {
      if (error.code === '42501' || error.code === 'PGRST202' || /could not find the function/i.test(error.message)) return []
      throw new Error(error.message)
    }
    const page = (data ?? []) as unknown as BidRemovedRpcRow[]
    out.push(...page.map(bidRemovedRowFromRpc))
    if (page.length < BID_HISTORY_PAGE) return out
  }
}

/**
 * Put back one removed row (punch list #73, PR 5): `restore_bid_removed_row` brings it back with
 * what was removed with it, for whoever can edit the bid. Throws the function's refusal so the
 * window can say it.
 */
export async function restoreBidRemovedRow(archiveId: string): Promise<BidRestoreResult> {
  const { data, error } = await supabase.rpc('restore_bid_removed_row' as never, { p_archive_id: archiveId } as never)
  if (error) throw new Error(error.message)
  return data as unknown as BidRestoreResult
}

/**
 * Whether the signed-in person can edit the bid (`can_edit_bid`, PR 5): the window offers Undo
 * only then. A failed read is a no.
 */
export async function loadCanEditBid(bidId: string, client: SupabaseClient<Database> = supabase): Promise<boolean> {
  const { data, error } = await client.rpc('can_edit_bid', { p_bid_id: bidId })
  return !error && data === true
}

/** Ids per request, so a long `in` list stays well inside a URL. */
const REMOVE_CHUNK = 100

/**
 * Remove rows an action added (punch list #73, PR 6, History's Undo): a delete by id under the
 * presser's own policies, tagged `put-back` so the ledger reads it as their Undo. Only for the
 * tables the delete archive keeps (`BID_UNDO_REMOVABLE_TABLES`), so each row lands there and its
 * own Put back brings it back. Resolves how many rows went; throws the first refusal.
 */
export async function removeBidAddedRows(table: string, ids: ReadonlyArray<string>, client: SupabaseClient<Database> = supabase): Promise<number> {
  // The table is one of several, named at run time.
  const untyped = client as unknown as SupabaseClient
  let removed = 0
  for (let i = 0; i < ids.length; i += REMOVE_CHUNK) {
    const { data, error } = await withBidAction(untyped.from(table).delete().in('id', ids.slice(i, i + REMOVE_CHUNK)).select('id'), BID_ACTIONS.putBack)
    if (error) throw new Error(error.message)
    removed += (data ?? []).length
  }
  return removed
}
