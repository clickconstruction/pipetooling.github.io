import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'

/**
 * The Takeoff tab's "PO items summary" row shape: what the existing-PO panel
 * and the cost-estimate PO review modal render per line.
 */
export type POItemSummary = {
  part_name: string
  quantity: number
  price_at_time: number
  template_name: string | null
}

/** Raw join-row shape returned by the summary select. */
export type POItemSummaryRow = {
  quantity: number
  price_at_time: number
  material_parts: { name: string } | null
  source_template: { id: string; name: string } | null
}

export const PO_ITEMS_SUMMARY_SELECT =
  'quantity, price_at_time, material_parts(name), source_template:material_templates!source_template_id(id, name)'

export function mapPOItemSummaryRows(rows: POItemSummaryRow[] | null | undefined): POItemSummary[] {
  return (rows ?? []).map((row) => ({
    part_name: row.material_parts?.name ?? '—',
    quantity: row.quantity,
    price_at_time: row.price_at_time,
    template_name: row.source_template?.name ?? null,
  }))
}

/**
 * Load a PO's items in summary form — extracted from 3 copy-pasted call sites
 * in BidsTakeoffTab.tsx (existing-PO effect, addTakeoffToExistingPO, the
 * cost-estimate PO modal effect; see BIDS_TAKEOFF_TAB_ARCHITECTURE.md).
 * Returns null on query error (never throws) so call sites keep their
 * pre-extraction "null = failed to load" state semantics.
 */
export async function loadPOItemsSummary(
  supabase: SupabaseClient<Database>,
  purchaseOrderId: string
): Promise<POItemSummary[] | null> {
  const { data, error } = await supabase
    .from('purchase_order_items')
    .select(PO_ITEMS_SUMMARY_SELECT)
    .eq('purchase_order_id', purchaseOrderId)
    .order('sequence_order', { ascending: true })

  if (error) return null
  return mapPOItemSummaryRows(data as unknown as POItemSummaryRow[])
}
