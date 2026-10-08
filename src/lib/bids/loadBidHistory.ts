import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import { BID_HISTORY_PAGE, bidHistoryRowFromRpc, type BidHistoryRow, type BidHistoryRpcRow } from './bidHistory'
import type { BidPutBackResult } from './bidHistoryPutBack'

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
 * for that column under the caller's own policies. Throws the function's refusal so the window can
 * say it.
 */
export async function putBackBidChange(changeId: number, column: string): Promise<BidPutBackResult> {
  const { data, error } = await supabase.rpc('put_back_bid_change', { p_change_id: changeId, p_column: column })
  if (error) throw new Error(error.message)
  return data as unknown as BidPutBackResult
}
