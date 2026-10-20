/**
 * A count row's marks on the database (punch list #128, PR 2): its kind, its tags and its split
 * (`bids_count_rows.kind`, `tags`, `split_material_cents`, `split_markup_pct`, `split_taxable`,
 * migration 20261020020000). One read per bid version, one write per row. Fail-soft before the
 * push: a read that fails for the columns' absence gives no marks (`isNotThereYetError`), and a
 * write says so.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { isNotThereYetError } from '../gcWordAskIo'
import { ROW_KINDS, type RowKind, type RowMarks, type RowMarksByRowId } from './rowKinds'

type Client = SupabaseClient<Database>

/** The five columns as the database row carries them; the generated types gain them on the regen after the push. */
export type RowMarksDbRow = {
  id: string
  kind: string | null
  tags: string[] | null
  split_material_cents: number | string | null
  split_markup_pct: number | string | null
  split_taxable: boolean | null
}

const num = (v: number | string | null | undefined): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** A database row → the marks the Workbench reads. Pure. */
export function rowMarksFromDbRow(r: RowMarksDbRow): RowMarks {
  const cents = num(r.split_material_cents)
  const markupPct = num(r.split_markup_pct)
  const kind = r.kind && (ROW_KINDS as string[]).includes(r.kind) ? (r.kind as RowKind) : null
  const split =
    cents != null || markupPct != null || r.split_taxable != null
      ? { material: cents != null ? cents / 100 : null, markup: markupPct != null ? markupPct / 100 : null, taxable: r.split_taxable ?? null }
      : null
  return { kind, tags: (r.tags ?? []).filter((t) => typeof t === 'string' && t.trim() !== ''), split }
}

/** The marks → the columns a write sets. Pure. */
export function rowMarksToDbPatch(m: RowMarks): Omit<RowMarksDbRow, 'id'> {
  return {
    kind: m.kind ?? null,
    tags: m.tags ?? [],
    split_material_cents: m.split?.material != null ? Math.round(m.split.material * 100) : null,
    split_markup_pct: m.split?.markup != null ? Math.round(m.split.markup * 100000) / 1000 : null,
    split_taxable: m.split?.taxable ?? null,
  }
}

/** Every row's marks for one bid version (null version = the unsplit rows), keyed by row id. */
export async function loadRowMarks(supabase: Client, bidId: string, bidVersionId: string | null): Promise<{ marks: RowMarksByRowId; missing: boolean }> {
  let q = supabase.from('bids_count_rows').select('id, kind, tags, split_material_cents, split_markup_pct, split_taxable').eq('bid_id', bidId)
  q = bidVersionId ? q.eq('bid_version_id', bidVersionId) : q.is('bid_version_id', null)
  const { data, error } = await q
  if (error) return { marks: {}, missing: isNotThereYetError(error) }
  const marks: RowMarksByRowId = {}
  for (const r of (data ?? []) as unknown as RowMarksDbRow[]) marks[r.id] = rowMarksFromDbRow(r)
  return { marks, missing: false }
}

/** Writes one row's marks. The error comes back for a toast; `missing` when the columns are not pushed yet. */
export async function saveRowMarks(supabase: Client, rowId: string, m: RowMarks): Promise<{ error: string | null; missing: boolean }> {
  const payload = rowMarksToDbPatch(m) as unknown as Database['public']['Tables']['bids_count_rows']['Update']
  const { error } = await supabase.from('bids_count_rows').update(payload).eq('id', rowId)
  if (error) return { error: error.message, missing: isNotThereYetError(error) }
  return { error: null, missing: false }
}
