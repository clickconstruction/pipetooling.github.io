/**
 * The reads and the one write behind the bid's *priced on* (punch list #239, PR 4): what the bid's jobs build
 * from today, through `list_bid_jobs_plan_state` (SECURITY DEFINER, since an estimator reads no job row), and
 * the pin itself on `bids.priced_on_set_id`. The read is fail-soft (the note is a courtesy); the write throws
 * its reason.
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import type { BidJobPlanState } from './bidPricedOn'

export type BidPricedOnIo = {
  loadJobsPlanState(bidId: string): Promise<BidJobPlanState[]>
  setPricedOn(bidId: string, setId: string | null): Promise<void>
}

export async function loadBidJobsPlanState(bidId: string): Promise<BidJobPlanState[]> {
  try {
    const r = await supabase.rpc('list_bid_jobs_plan_state', { p_bid_ids: [bidId] })
    if (r.error) return []
    return ((r.data ?? []) as unknown as BidJobPlanState[]).filter((s) => s.bid_id === bidId)
  } catch {
    return []
  }
}

export async function setBidPricedOnSet(bidId: string, setId: string | null): Promise<void> {
  const r = await supabase.from('bids').update({ priced_on_set_id: setId }).eq('id', bidId).select('id')
  checkSupabaseError(r, 'pin priced-on set')
  if ((r.data ?? []).length === 0) throw new Error('The pin did not save from this account.')
}

export const supabaseBidPricedOnIo: BidPricedOnIo = { loadJobsPlanState: loadBidJobsPlanState, setPricedOn: setBidPricedOnSet }
