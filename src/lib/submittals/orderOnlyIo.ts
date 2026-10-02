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

/** Every tag on the bid's log with what it holds, read once when the takeoff window opens. */
export async function loadBidOrderFacts(db: Client, bidId: string): Promise<Map<string, LogOrderFact[]>> {
  const { data, error } = await db.from('bid_procurement_items').select('tag, ordered_on, delivered_on, po_ref').eq('bid_id', bidId)
  if (error) throw error
  const out = new Map<string, LogOrderFact[]>()
  for (const r of (data ?? []) as Array<{ tag: string | null; ordered_on: string | null; delivered_on: string | null; po_ref: string | null }>) {
    if (!r.tag) continue
    out.set(r.tag, [...(out.get(r.tag) ?? []), { orderedOn: r.ordered_on, deliveredOn: r.delivered_on, poRef: r.po_ref }])
  }
  return out
}

/** By procure key, what the log holds for each of a row's parts ("Ordered 09/23"); only the parts somebody bought. */
export async function loadPartOrderWords(db: Client, bidId: string, tag: string, words: (facts: LogOrderFact[]) => string): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!tag.trim()) return out
  const { data, error } = await db.from('bid_procurement_items').select('part_key, ordered_on, delivered_on, po_ref').eq('bid_id', bidId).eq('tag', tag)
  if (error) throw error
  for (const r of (data ?? []) as Array<{ part_key: string | null; ordered_on: string | null; delivered_on: string | null; po_ref: string | null }>) {
    if (!r.part_key) continue
    const w = words([{ orderedOn: r.ordered_on, deliveredOn: r.delivered_on, poRef: r.po_ref }])
    if (w) out.set(r.part_key, w)
  }
  return out
}

/**
 * The takeoff lines left off a fixture, added to what the bid already remembers for it, so a
 * refresh from the takeoff does not bring the parts back. The tick and the other picks are left as stored.
 */
export async function rememberLeftOutLines(db: Client, bidId: string, countRowId: string, keys: ReadonlyArray<string>): Promise<void> {
  if (keys.length === 0) return
  const { data, error } = await db.from('bid_submittal_takeoff_choices').select('left_out_line_ids').eq('bid_id', bidId).eq('count_row_id', countRowId).maybeSingle()
  if (error) throw error
  const have = ((data as { left_out_line_ids?: string[] | null } | null)?.left_out_line_ids ?? []) as string[]
  const next = [...new Set([...have, ...keys])]
  const { error: upErr } = await db.from('bid_submittal_takeoff_choices').upsert({ bid_id: bidId, count_row_id: countRowId, left_out_line_ids: next }, { onConflict: 'bid_id,count_row_id' })
  if (upErr) throw upErr
}
