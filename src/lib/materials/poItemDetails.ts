import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'

type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row']
type MaterialPart = Database['public']['Tables']['material_parts']['Row']
type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row']

/** A purchase-order item hydrated with its part / supply house / source template. */
export type POItemWithDetails = PurchaseOrderItem & {
  part: MaterialPart
  supply_house?: SupplyHouse
  source_template?: { id: string; name: string } | null
}

export type PurchaseOrderWithItems = PurchaseOrder & {
  items: POItemWithDetails[]
}

/** Raw join-row shape returned by PO_ITEMS_WITH_DETAILS_SELECT. */
export type POItemJoinRow = PurchaseOrderItem & {
  material_parts: MaterialPart
  supply_houses: SupplyHouse | null
  source_template?: { id: string; name: string } | null
}

export const PO_ITEMS_WITH_DETAILS_SELECT =
  '*, material_parts(*), supply_houses(*), source_template:material_templates!source_template_id(id, name)'

/**
 * Map raw purchase_order_items join rows to POItemWithDetails. Join keys
 * (material_parts / supply_houses) are intentionally kept on the result via
 * spread — behavior-preserving with the pre-extraction inline mapping.
 */
export function mapPOItemRowsToDetails(rows: POItemJoinRow[] | null | undefined): POItemWithDetails[] {
  return (rows ?? []).map((item) => ({
    ...item,
    part: item.material_parts,
    supply_house: item.supply_houses || undefined,
    source_template: item.source_template ?? null,
  }))
}

/**
 * The canonical "load a PO's items with details" query — extracted from ~12
 * copy-pasted call sites in Materials.tsx (see MATERIALS_TABS_ARCHITECTURE.md).
 *
 * Returns `null` on query error (never throws) so call sites keep their
 * distinct pre-extraction error behaviors: fall back to `items: []` via
 * `?? []`, or skip the state update entirely via an `if (items)` gate.
 */
export async function loadPOItemsWithDetails(
  supabase: SupabaseClient<Database>,
  purchaseOrderId: string
): Promise<POItemWithDetails[] | null> {
  const { data, error } = await supabase
    .from('purchase_order_items')
    .select(PO_ITEMS_WITH_DETAILS_SELECT)
    .eq('purchase_order_id', purchaseOrderId)
    .order('sequence_order', { ascending: true })

  if (error || !data) return null
  return mapPOItemRowsToDetails(data as unknown as POItemJoinRow[])
}
