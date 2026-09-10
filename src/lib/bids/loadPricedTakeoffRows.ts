/**
 * A bid's priced active-version count rows — the shape `takeoffDiff` eats
 * (v2.3222, lifted from the Audits cockpit so the send-time envelope prices
 * the same way the audit card does). Unit price precedence follows the
 * Workbench's own write rule (`updateUnitPriceOverride`): an assignment's
 * override, else the row's typed price (`bid_count_row_custom_prices`, scoped to
 * the bid's active pricing), else the assigned book entry's price. v2.3239 added
 * the typed price — the Workbench saves most human prices there, so before this
 * a human reference bid read as $0 rows and the diff filed them under "robot
 * added" / "everything else".
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { TakeoffDiffRow } from './takeoffDiff'

// bids_count_rows / bid_pricing_assignments are typed, but the caller passes bid ids
// that may be twin shells (RLS-visible, fenced for writes) — the untyped client keeps
// the reads uniform with the audit tab's.
const db = supabase as unknown as SupabaseClient

export type PricedTakeoffRow = TakeoffDiffRow & { id: string }

/** The Workbench's unit-price rule, shared so every reader prices a row the same way. */
export function resolveTakeoffUnitPrice(args: {
  assignment: { price_book_entry_id: string | null; unit_price_override: number | null } | undefined
  customUnitPrice: number | null | undefined
  entryPrice: (entryId: string) => number | undefined
}): number {
  const { assignment, customUnitPrice } = args
  if (assignment?.unit_price_override != null) return Number(assignment.unit_price_override)
  if (customUnitPrice != null && Number(customUnitPrice) > 0) return Number(customUnitPrice)
  if (assignment?.price_book_entry_id) return Number(args.entryPrice(assignment.price_book_entry_id) ?? 0)
  return 0
}

export async function loadPricedTakeoffRows(bidId: string, selectedVersionId: string | null): Promise<PricedTakeoffRow[]> {
  const [rowsRes, assignsRes, customRes, bidRes] = await Promise.all([
    db.from('bids_count_rows').select('id, fixture, count, bid_version_id').eq('bid_id', bidId),
    db.from('bid_pricing_assignments').select('count_row_id, price_book_entry_id, unit_price_override').eq('bid_id', bidId),
    db.from('bid_count_row_custom_prices').select('count_row_id, price_book_version_id, unit_price').eq('bid_id', bidId),
    db.from('bids').select('selected_price_book_version_id').eq('id', bidId).maybeSingle(),
  ])
  const rows = (rowsRes.data ?? []) as Array<{ id: string; fixture: string; count: number; bid_version_id: string | null }>
  const assigns = (assignsRes.data ?? []) as Array<{ count_row_id: string; price_book_entry_id: string | null; unit_price_override: number | null }>
  const customs = (customRes.data ?? []) as Array<{ count_row_id: string; price_book_version_id: string; unit_price: number }>
  const activePricing = (bidRes.data as { selected_price_book_version_id: string | null } | null)?.selected_price_book_version_id ?? null
  const entryIds = [...new Set(assigns.map((a) => a.price_book_entry_id).filter((x): x is string => !!x))]
  const entries = entryIds.length
    ? (((await db.from('price_book_entries').select('id, total_price').in('id', entryIds)).data ?? []) as Array<{ id: string; total_price: number | null }>)
    : []
  const priceById = new Map(entries.map((e) => [e.id, e.total_price ?? 0]))
  const byRow = new Map(assigns.map((a) => [a.count_row_id, a]))
  // The active pricing's typed price wins; with no active pricing on record, any typed price stands in.
  const customByRow = new Map<string, number>()
  for (const c of customs) {
    if (activePricing && c.price_book_version_id !== activePricing) continue
    customByRow.set(c.count_row_id, Number(c.unit_price))
  }
  if (!activePricing) for (const c of customs) if (!customByRow.has(c.count_row_id)) customByRow.set(c.count_row_id, Number(c.unit_price))
  return rows
    .filter((r) => (selectedVersionId ? r.bid_version_id === selectedVersionId : r.bid_version_id == null))
    .map((r) => {
      const unit = resolveTakeoffUnitPrice({ assignment: byRow.get(r.id), customUnitPrice: customByRow.get(r.id), entryPrice: (id) => priceById.get(id) })
      return { id: r.id, name: r.fixture, count: Number(r.count), ext: Number(r.count) * unit }
    })
    .sort((a, b) => b.ext - a.ext)
}
