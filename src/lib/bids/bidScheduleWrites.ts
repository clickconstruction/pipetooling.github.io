/**
 * The one write of a bid's schedule (punch list #367): the three columns onto one bid, read back so a
 * policy's silent refusal is an error with its reason. The Development page's sheet uses it; Edit Bid writes
 * the same columns through its own save.
 */
import { supabase } from '../supabase'
import type { BidScheduleColumns } from './bidSchedule'

const REFUSED = 'The schedule was not saved. The bid may have moved, or you may not have the right to change it.'

export async function writeBidSchedule(bidId: string, columns: BidScheduleColumns): Promise<void> {
  const { data, error } = await supabase.from('bids').update(columns).eq('id', bidId).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error(REFUSED)
}
