/**
 * The reads and writes behind a submittal row's parts (`bid_submittal_item_parts`). The read is
 * paged with a stable order (the row-cap rule) and a missing table — a client ahead of the push —
 * reads as no parts, so every row falls back to its own columns.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { diffPartDrafts, rollUpFromParts, type PartDraft, type SubmittalPartInsert, type SubmittalPartRow } from './itemParts'
import type { PartWrites } from './refreshFromTakeoff'
import { rollUpPartDecisions } from '../../../supabase/functions/_shared/submittalRoomPayload'

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

/** The reviewer's columns, as `enteredDecisionPatch` writes them on a row or a part. */
export type CallPatch = {
  review_decision: string | null
  review_note: string | null
  reviewed_by_person_id: string | null
  reviewed_by_name: string | null
  reviewed_by_email: string | null
  reviewed_at: string | null
  decision_source: string
  decision_entered_by: string | null
  decision_entered_by_name: string | null
}

/** Write a row's call from its parts' calls (`rollUpPartDecisions`, the room's own rule). */
export async function writeRowCallFromParts(db: SupabaseClient, itemId: string): Promise<void> {
  const parts = await loadItemParts(db, [itemId])
  const { error } = await db.from('bid_submittal_items').update(rollUpPartDecisions(parts)).eq('id', itemId)
  if (error) throw error
}

/**
 * A call entered on a row that has parts the GC sees (2026-10-01): it lands on those parts —
 * the ones named, else all of them; with `onlyOpen`, only the ones with no call yet — and the
 * row reads the roll-up. Returns how many parts took it; 0 when the row has no part the GC
 * sees, so the caller writes the row as before.
 */
export async function enterCallOnParts(db: SupabaseClient, itemId: string, patch: CallPatch, opts: { partIds?: ReadonlyArray<string> | null; onlyOpen?: boolean; parts?: ReadonlyArray<SubmittalPartRow> } = {}): Promise<number> {
  const parts = opts.parts ?? (await loadItemParts(db, [itemId]))
  const gc = parts.filter((p) => p.item_id === itemId && p.on_submittal)
  if (gc.length === 0) return 0
  const named = opts.partIds && opts.partIds.length > 0 ? new Set(opts.partIds) : null
  const target = gc.filter((p) => (!named || named.has(p.id)) && (!opts.onlyOpen || !p.review_decision)).map((p) => p.id)
  if (target.length > 0) {
    const { error } = await db.from('bid_submittal_item_parts').update({ ...patch, updated_at: new Date().toISOString() }).in('id', target)
    if (error) throw error
  }
  await writeRowCallFromParts(db, itemId)
  return target.length
}

/** Take the entered and robot calls back off a row's parts (every one, or the parts named), then write the row's roll-up. */
export async function clearEnteredCallsOnParts(db: SupabaseClient, itemId: string, clear: CallPatch, partIds?: ReadonlyArray<string>): Promise<void> {
  if (partIds && partIds.length === 0) return
  let q = db.from('bid_submittal_item_parts').update({ ...clear, updated_at: new Date().toISOString() }).eq('item_id', itemId).in('decision_source', ['entered', 'robot'])
  if (partIds) q = q.in('id', [...partIds])
  const { error } = await q
  if (error) throw error
  await writeRowCallFromParts(db, itemId)
}

/**
 * Write a refresh or a fold on one row's parts (2026-10-01): delete, update, insert, then the
 * row's label, house and lead time from the parts it now holds.
 */
export async function applyPartWrites(db: SupabaseClient, itemId: string, w: PartWrites): Promise<void> {
  if (w.deletes.length > 0) {
    const { error } = await db.from('bid_submittal_item_parts').delete().in('id', w.deletes)
    if (error) throw error
  }
  for (const u of w.updates) {
    const { error } = await db.from('bid_submittal_item_parts').update({ ...u.patch, updated_at: new Date().toISOString() }).eq('id', u.id)
    if (error) throw error
  }
  if (w.inserts.length > 0) await insertItemParts(db, w.inserts)
  const { error } = await db.from('bid_submittal_items').update(rollUpFromParts(await loadItemParts(db, [itemId]))).eq('id', itemId)
  if (error) throw error
}

/**
 * The office's facts on many log lines at once (2026-10-02, the procurement log's tick bar): the
 * house, the lead time and the stage. A part's line writes its part (matched by row and procure
 * key, so the same part on an older revision is left as it was); a row's own line writes the
 * row's house and lead time (a row has no stage of its own). Each row with parts then reads its
 * roll-up again. Returns how many lines took it.
 */
export async function setLineFacts(
  db: SupabaseClient,
  lines: ReadonlyArray<{ itemId: string; partKey: string | null }>,
  patch: { supply_house_id?: string | null; lead_time_days?: number | null; stage?: string | null },
): Promise<number> {
  const now = new Date().toISOString()
  const rowPatch: Record<string, unknown> = {}
  if ('supply_house_id' in patch) rowPatch.supply_house_id = patch.supply_house_id
  if ('lead_time_days' in patch) rowPatch.lead_time_days = patch.lead_time_days
  let done = 0
  const withParts = new Set<string>()
  for (const l of lines) {
    if (l.partKey) {
      const { error } = await db.from('bid_submittal_item_parts').update({ ...patch, updated_at: now }).eq('item_id', l.itemId).eq('procure_key', l.partKey)
      if (error) throw error
      withParts.add(l.itemId)
      done++
    } else if (Object.keys(rowPatch).length > 0) {
      const { error } = await db.from('bid_submittal_items').update(rowPatch).eq('id', l.itemId)
      if (error) throw error
      done++
    }
  }
  for (const itemId of withParts) {
    const { error } = await db.from('bid_submittal_items').update(rollUpFromParts(await loadItemParts(db, [itemId]))).eq('id', itemId)
    if (error) throw error
  }
  return done
}

/**
 * A tag's own procurement line moved onto a part (a fold): the dates typed for the row it was
 * stay with the part it became. A tag with no line moves nothing, and before the part lines'
 * column is pushed nothing moves (the log then keeps the fixture's line as logged before its parts).
 */
export async function moveProcurementLines(db: SupabaseClient, bidId: string, moves: ReadonlyArray<{ tag: string; partKey: string }>, intoTag: string): Promise<void> {
  for (const m of moves) {
    // Read first: a bid with no line for the tag writes nothing.
    const { data, error: readErr } = await db.from('bid_procurement_items').select('*').eq('bid_id', bidId).eq('tag', m.tag)
    if (readErr) throw readErr
    const line = ((data ?? []) as Array<{ id: string; part_key?: string | null }>).find((r) => !r.part_key)
    if (!line) continue
    // A database without part lines yet (a client ahead of the push): the line stays on its tag.
    if (!('part_key' in line)) return
    const { error } = await db.from('bid_procurement_items').update({ part_key: m.partKey, tag: intoTag }).eq('id', line.id)
    if (error) throw error
  }
}
