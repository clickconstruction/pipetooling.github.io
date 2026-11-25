/**
 * The bids of the day (punch list #445): the read and the save. The kernels are in `bidDay.ts`.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { BidDayEntry, BidDayPayload } from './bidDay'

/** The signed-in person's own day on bids: today by the company's day, or the day given (YYYY-MM-DD). */
export async function fetchMyBidDay(workDate?: string): Promise<BidDayPayload | null> {
  const data = await withSupabaseRetry(async () => supabase.rpc('get_my_bid_day', workDate ? { p_work_date: workDate } : {}), 'read the bids of the day')
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  return data as unknown as BidDayPayload
}

/** Keeps the list the person left. Answers the rows kept. */
export async function saveMyBidDay(workDate: string, entries: readonly BidDayEntry[]): Promise<number> {
  const data = await withSupabaseRetry(
    async () => supabase.rpc('save_my_bid_day', { p_work_date: workDate, p_entries: entries as unknown as never }),
    'keep the bids of the day',
  )
  return typeof data === 'number' ? data : 0
}
