import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, bidUpdateRefused } from '../bids/updateGuard'
import type { LostBidSource, LostBidWrites } from './fillInLostBids'

/**
 * The lost-bid kind's reads and writes (v2.5774, punch list #145). The read is the Needs you
 * line's own query with the names joined; the writes are the Why we lost lens's patch and the
 * call session's contact-log insert. Undo puts the bid back as it was and removes the entry.
 */
export type LostBidFillInIo = {
  fetchSources: () => Promise<LostBidSource[]>
  save: (w: LostBidWrites) => Promise<{ entryId: string | null }>
  undo: (args: { bidId: string; previous: { loss_category: string | null; loss_reason: string | null }; entryId: string | null }) => Promise<void>
}

export const lostBidFillInIo: LostBidFillInIo = {
  async fetchSources() {
    const rows = await withSupabaseRetry(
      async () =>
        supabase
          .from('bids')
          .select('id, bid_number, project_name, customer_id, bid_value, outcome, outcome_at, bid_date_sent, last_contact, loss_category, loss_reason, adopted_into_bid_id, customers(name), bids_gc_builders(name)')
          .eq('outcome', 'lost')
          .limit(1000),
      'fill in: lost bids',
    )
    return (rows ?? []) as unknown as LostBidSource[]
  },
  async save(w) {
    const rows = await withSupabaseRetry(async () => supabase.from('bids').update(w.patch).eq('id', w.bidId).select('id'), 'fill in: save loss reason')
    if (bidUpdateRefused(rows)) throw new Error(BID_UPDATE_NOT_APPLIED_MESSAGE)
    if (!w.entry) return { entryId: null }
    const inserted = await withSupabaseRetry(async () => supabase.from('bids_submission_entries').insert(w.entry!).select('id'), 'fill in: contact log')
    return { entryId: (inserted?.[0] as { id?: string } | undefined)?.id ?? null }
  },
  async undo({ bidId, previous, entryId }) {
    const rows = await withSupabaseRetry(async () => supabase.from('bids').update(previous).eq('id', bidId).select('id'), 'fill in: undo loss reason')
    if (bidUpdateRefused(rows)) throw new Error(BID_UPDATE_NOT_APPLIED_MESSAGE)
    if (entryId) await withSupabaseRetry(async () => supabase.from('bids_submission_entries').delete().eq('id', entryId), 'fill in: undo contact log')
  },
}
