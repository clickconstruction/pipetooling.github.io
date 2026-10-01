/**
 * The reads and writes behind a submittal row's parts (`bid_submittal_item_parts`). The read is
 * paged with a stable order (the row-cap rule) and a missing table — a client ahead of the push —
 * reads as no parts, so every row falls back to its own columns.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { diffPartDrafts, rollUpFromParts, type PartDraft, type SubmittalPartInsert, type SubmittalPartRow } from './itemParts'

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/** Every part of the given rows, ordered. [] when there are none, or the table is not there yet. */
export async function loadItemParts(db: SupabaseClient, itemIds: ReadonlyArray<string>): Promise<SubmittalPartRow[]> {
  const ids = [...new Set(itemIds)].filter(Boolean)
  if (ids.length === 0) return []
  try {
    return await fetchAllRowsChunkedIn<SubmittalPartRow, string>(
      ids,
      (chunk, from, to) => db.from('bid_submittal_item_parts').select('*').in('item_id', chunk).order('item_id').order('sequence_order').order('id').range(from, to) as unknown as Page<SubmittalPartRow>,
      'load submittal parts',
    )
  } catch {
    return []
  }
}

/** Insert parts in batches of 200. */
export async function insertItemParts(db: SupabaseClient, rows: ReadonlyArray<SubmittalPartInsert>): Promise<void> {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from('bid_submittal_item_parts').insert(rows.slice(i, i + 200))
    if (error) throw error
  }
}

/**
 * Save the editor's parts for one row: delete, update and insert what changed, then write the
 * row's roll-up (label, house, lead time) from what the row now holds. Returns the roll-up.
 */
export async function saveItemParts(
  db: SupabaseClient,
  itemId: string,
  bidId: string,
  before: ReadonlyArray<SubmittalPartRow>,
  drafts: ReadonlyArray<PartDraft>,
): Promise<ReturnType<typeof rollUpFromParts>> {
  const diff = diffPartDrafts(before, drafts, itemId, bidId)
  if (diff.deletes.length > 0) {
    const { error } = await db.from('bid_submittal_item_parts').delete().in('id', diff.deletes)
    if (error) throw error
  }
  for (const u of diff.updates) {
    const { error } = await db.from('bid_submittal_item_parts').update({ ...u.patch, updated_at: new Date().toISOString() }).eq('id', u.id)
    if (error) throw error
  }
  if (diff.inserts.length > 0) await insertItemParts(db, diff.inserts)
  const now = await loadItemParts(db, [itemId])
  return rollUpFromParts(now)
}
