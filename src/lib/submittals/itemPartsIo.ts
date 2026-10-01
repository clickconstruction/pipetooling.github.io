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

/**
 * Rows with the same fields, in order, so each batch sends one shape. A batch insert fills a field
 * one row leaves out with NULL, not the column's default: a split's copies (no procurement key)
 * batched with the carried part (its key) failed on procure_key NOT NULL.
 */
export function partInsertBatches(rows: ReadonlyArray<SubmittalPartInsert>, size = 200): SubmittalPartInsert[][] {
  const byShape = new Map<string, SubmittalPartInsert[]>()
  for (const r of rows) {
    const shape = Object.keys(r).filter((k) => r[k as keyof SubmittalPartInsert] !== undefined).sort().join(',')
    byShape.set(shape, [...(byShape.get(shape) ?? []), r])
  }
  const out: SubmittalPartInsert[][] = []
  for (const group of byShape.values()) for (let i = 0; i < group.length; i += size) out.push(group.slice(i, i + size))
  return out
}

/** Insert parts, one shape per batch, 200 at a time. */
export async function insertItemParts(db: SupabaseClient, rows: ReadonlyArray<SubmittalPartInsert>): Promise<void> {
  for (const batch of partInsertBatches(rows)) {
    const { error } = await db.from('bid_submittal_item_parts').insert(batch)
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
