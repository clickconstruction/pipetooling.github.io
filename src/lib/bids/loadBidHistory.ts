import { supabase } from '../supabase'
import { bidHistoryRowFromRpc, type BidHistoryRow, type BidHistoryRpcRow } from './bidHistory'

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
