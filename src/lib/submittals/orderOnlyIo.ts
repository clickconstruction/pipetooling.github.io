/**
 * The writes and the one read behind Order only (2026-10-02): the row's flag with the bid's
 * remembered pick beside it, and what the procurement log already holds for a row, so a fixture
 * somebody has ordered is never left out by accident.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import type { LogOrderFact } from './orderOnly'
import { saveTakeoffChoices } from './takeoffCandidatesIo'

type Client = SupabaseClient<Database>

/**
 * Sets a draft row order only, or back to a row the GC sees. A row from the takeoff has the pick
 * remembered on the bid, so the next build brings it on the same way. Its parts are not touched.
 */
export async function writeRowOrderOnly(db: Client, bidId: string, item: { id: string; source_count_row_id: string | null }, on: boolean): Promise<void> {
  const { error } = await db.from('bid_submittal_items').update({ order_only: on }).eq('id', item.id)
  if (error) throw error
  if (item.source_count_row_id) await saveTakeoffChoices(db, bidId, new Map([[item.source_count_row_id, true]]), undefined, undefined, new Map([[item.source_count_row_id, on]]))
}

/** The order dates, deliveries and POs the log holds under a tag: the tag's own line and its parts' lines. */
export async function loadRowOrderFacts(db: Client, bidId: string, tag: string): Promise<LogOrderFact[]> {
  if (!tag.trim()) return []
  const { data, error } = await db.from('bid_procurement_items').select('ordered_on, delivered_on, po_ref').eq('bid_id', bidId).eq('tag', tag)
  if (error) throw error
  return ((data ?? []) as Array<{ ordered_on: string | null; delivered_on: string | null; po_ref: string | null }>).map((r) => ({ orderedOn: r.ordered_on, deliveredOn: r.delivered_on, poRef: r.po_ref }))
}
