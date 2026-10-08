import { supabase } from '../supabase'
import { bidHistoryRowFromRpc, type BidHistoryRow, type BidHistoryRpcRow } from './bidHistory'
import type { BidPutBackResult } from './bidHistoryPutBack'

/**
 * A bid's history (punch list #73, PR 2): `list_bid_history`, which runs under the caller's own
 * policies — the ledger for whoever can read the bid, the delete archive's removed rows for a dev.
 * Throws the read's error so the window can say it.
 */
export async function loadBidHistory(bidId: string): Promise<BidHistoryRow[]> {
  const { data, error } = await supabase.rpc('list_bid_history', { p_bid_id: bidId })
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
