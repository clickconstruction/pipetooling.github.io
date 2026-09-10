/**
 * A bid's priced active-version count rows — the shape `takeoffDiff` eats
 * (v2.3222, lifted from the Audits cockpit so the send-time envelope prices
 * the same way the audit card does). Assigned unit price (override wins) ×
 * count over the ACTIVE rows: the selected version's rows when the bid is
 * split, the version-less rows otherwise.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { TakeoffDiffRow } from './takeoffDiff'

// bids_count_rows / bid_pricing_assignments are typed, but the caller passes bid ids
// that may be twin shells (RLS-visible, fenced for writes) — the untyped client keeps
// the four reads uniform with the audit tab's.
const db = supabase as unknown as SupabaseClient

export type PricedTakeoffRow = TakeoffDiffRow & { id: string }

export async function loadPricedTakeoffRows(bidId: string, selectedVersionId: string | null): Promise<PricedTakeoffRow[]> {
  const rows = ((await db.from('bids_count_rows').select('id, fixture, count, bid_version_id').eq('bid_id', bidId)).data ?? []) as Array<{
    id: string
    fixture: string
    count: number
    bid_version_id: string | null
  }>
  const assigns = ((await db.from('bid_pricing_assignments').select('count_row_id, price_book_entry_id, unit_price_override').eq('bid_id', bidId)).data ?? []) as Array<{
    count_row_id: string
    price_book_entry_id: string | null
    unit_price_override: number | null
  }>
  const entryIds = [...new Set(assigns.map((a) => a.price_book_entry_id).filter((x): x is string => !!x))]
  const entries = entryIds.length
    ? (((await db.from('price_book_entries').select('id, total_price').in('id', entryIds)).data ?? []) as Array<{ id: string; total_price: number | null }>)
    : []
  const priceById = new Map(entries.map((e) => [e.id, e.total_price ?? 0]))
  const byRow = new Map(assigns.map((a) => [a.count_row_id, a]))
  return rows
    .filter((r) => (selectedVersionId ? r.bid_version_id === selectedVersionId : r.bid_version_id == null))
    .map((r) => {
      const a = byRow.get(r.id)
      const unit = a ? (a.unit_price_override ?? (a.price_book_entry_id ? (priceById.get(a.price_book_entry_id) ?? 0) : 0)) : 0
      return { id: r.id, name: r.fixture, count: Number(r.count), ext: Number(r.count) * Number(unit) }
    })
    .sort((a, b) => b.ext - a.ext)
}
