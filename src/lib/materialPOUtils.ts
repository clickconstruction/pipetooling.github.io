import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

export type ExpandedPart = { part_id: string; quantity: number }

type MaterialTemplateItemRow = Database['public']['Tables']['material_template_items']['Row']

/**
 * Expand a material template recursively to a flat list of parts with quantities.
 * Nested templates are expanded with quantity multiplied through.
 */
export async function expandTemplate(
  supabase: SupabaseClient<Database>,
  tid: string,
  multiplier: number = 1
): Promise<ExpandedPart[]> {
  const { data } = await supabase
    .from('material_template_items')
    .select('*')
    .eq('template_id', tid)

  const items = (data ?? null) as MaterialTemplateItemRow[] | null
  if (!items) return []

  const result: ExpandedPart[] = []
  for (const item of items) {
    if (item.item_type === 'part' && item.part_id) {
      result.push({ part_id: item.part_id, quantity: item.quantity * multiplier })
    } else if (item.item_type === 'template' && item.nested_template_id) {
      const nested = await expandTemplate(supabase, item.nested_template_id, item.quantity * multiplier)
      result.push(...nested)
    }
  }
  return result
}

export type TemplatePartPreview = { part_name: string; quantity: number }

/**
 * Expand a template to parts and resolve part names for preview (e.g. Bids Takeoff).
 * Returns merged list by part_id with part_name and total quantity.
 */
export async function getTemplatePartsPreview(
  supabase: SupabaseClient<Database>,
  templateId: string
): Promise<TemplatePartPreview[]> {
  const expanded = await expandTemplate(supabase, templateId, 1)
  if (expanded.length === 0) return []

  const merged = new Map<string, number>()
  for (const { part_id, quantity } of expanded) {
    merged.set(part_id, (merged.get(part_id) ?? 0) + quantity)
  }

  const partIds = Array.from(merged.keys())
  const { data: parts } = await supabase
    .from('material_parts')
    .select('id, name')
    .in('id', partIds)

  const nameById = new Map<string, string>()
  for (const p of parts ?? []) {
    if (p?.id) nameById.set(p.id, p.name ?? '')
  }

  const result: TemplatePartPreview[] = []
  for (const [part_id, quantity] of merged) {
    result.push({ part_name: nameById.get(part_id) ?? part_id.slice(0, 8), quantity })
  }
  result.sort((a, b) => a.part_name.localeCompare(b.part_name))
  return result
}

/**
 * Merge expanded parts by part_id (sum quantities), resolve best price per part,
 * then insert purchase_order_items. Returns error message or null on success.
 * When templateId is provided, items are tagged with that template (for "From template" display).
 */
export async function addExpandedPartsToPO(
  supabase: SupabaseClient<Database>,
  poId: string,
  expandedParts: ExpandedPart[],
  templateId?: string
): Promise<string | null> {
  if (expandedParts.length === 0) return null

  // Merge by part_id (sum quantities)
  const merged = new Map<string, number>()
  for (const { part_id, quantity } of expandedParts) {
    merged.set(part_id, (merged.get(part_id) ?? 0) + quantity)
  }

  const poItemsWithPrices: Array<{ part_id: string; quantity: number; supply_house_id: string | null; price: number }> = []
  for (const [part_id, quantity] of merged) {
    const { data: prices } = await supabase
      .from('material_part_prices')
      .select('supply_house_id, price')
      .eq('part_id', part_id)
      .order('price', { ascending: true })
      .limit(1)

    if (prices && prices.length > 0) {
      const first = prices[0]
      if (first != null) {
        poItemsWithPrices.push({
          part_id,
          quantity,
          supply_house_id: first.supply_house_id,
          price: first.price,
        })
      } else {
        poItemsWithPrices.push({ part_id, quantity, supply_house_id: null, price: 0 })
      }
    } else {
      poItemsWithPrices.push({
        part_id,
        quantity,
        supply_house_id: null,
        price: 0,
      })
    }
  }

  const { data: existingItems } = await supabase
    .from('purchase_order_items')
    .select('sequence_order')
    .eq('purchase_order_id', poId)
    .order('sequence_order', { ascending: false })
    .limit(1)

  const maxOrder = existingItems && existingItems.length > 0 && existingItems[0] ? existingItems[0].sequence_order : 0

  for (let i = 0; i < poItemsWithPrices.length; i++) {
    const item = poItemsWithPrices[i]
    if (!item) continue
    const { error: itemError } = await supabase
      .from('purchase_order_items')
      .insert({
        purchase_order_id: poId,
        part_id: item.part_id,
        quantity: item.quantity,
        selected_supply_house_id: item.supply_house_id,
        price_at_time: item.price,
        sequence_order: maxOrder + i + 1,
        source_template_id: templateId ?? null,
      })
    if (itemError) return `Failed to add item: ${itemError.message}`
  }
  return null
}
