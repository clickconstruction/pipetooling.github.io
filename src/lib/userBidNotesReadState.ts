import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

/** Marks both bid submission and customer-contact note streams as read through now (per user, per bid). */
export async function upsertBidNotesReadWatermark(userId: string, bidId: string): Promise<void> {
  const now = new Date().toISOString()
  await withSupabaseRetry(
    async () =>
      supabase.from('user_bid_notes_read_state').upsert(
        {
          user_id: userId,
          bid_id: bidId,
          last_seen_bid_submission_at: now,
          last_seen_customer_contact_at: now,
          updated_at: now,
        },
        { onConflict: 'user_id,bid_id' }
      ),
    'upsert bid notes read state'
  )
}
