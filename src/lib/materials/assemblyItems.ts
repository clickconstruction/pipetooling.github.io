import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import { loadPartPriceRows } from './partPrices'

/**
 * Paged loaders for assembly contents read ACROSS assemblies
 * (`material_template_items`) and for the lowest catalog price of their parts.
 *
 * PostgREST caps every un-ranged select at `max_rows` (1,000) with NO error.
 * `material_template_items` was at the cap by 2026-09-28 (the row-cap tripwire
 * fired on Takeoffs), so a surface that reads it across assemblies without a
 * range works from an arbitrary subset: the Takeoffs "In N assemblies" link
 * under-counts (and the Add assembly modal's part filter hides assemblies
 * that hold the part), and the Materials cost roll-ups call filled assemblies
 * empty. Reads of ONE assembly's items (`.eq('template_id', id)`) stay where
 * they are.
 */

type Client = SupabaseClient<Database>

/** The columns the part → assembly index and the cost roll-ups read. */
export const ASSEMBLY_ITEM_LINK_SELECT = 'template_id, item_type, part_id, nested_template_id, quantity'

/** One `material_template_items` row, narrowed to {@link ASSEMBLY_ITEM_LINK_SELECT}. */
export type AssemblyItemLink = {
  template_id: string
  item_type: string
  part_id: string | null
  nested_template_id: string | null
  quantity: number
}

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/** Every assembly item across every service type. Throws on any page error. */
export async function loadAllAssemblyItemLinks(supabase: Client): Promise<AssemblyItemLink[]> {
  return fetchAllRows<AssemblyItemLink>(
    (from, to) =>
      supabase
        .from('material_template_items')
        .select(ASSEMBLY_ITEM_LINK_SELECT)
        .order('id', { ascending: true })
        .range(from, to) as unknown as Page<AssemblyItemLink>,
    'load assembly items',
  )
}

/** The items of the given assemblies (chunked `.in()`, paged per chunk). Returns [] for no ids. Throws on any page error. */
export async function loadAssemblyItemLinksForTemplates(
  supabase: Client,
  templateIds: ReadonlyArray<string>,
): Promise<AssemblyItemLink[]> {
  return fetchAllRowsChunkedIn<AssemblyItemLink, string>(
    [...new Set(templateIds)].filter(Boolean),
    (chunk, from, to) =>
      supabase
        .from('material_template_items')
        .select(ASSEMBLY_ITEM_LINK_SELECT)
        .in('template_id', chunk)
        .order('id', { ascending: true })
        .range(from, to) as unknown as Page<AssemblyItemLink>,
    'load assembly items for templates',
  )
}

/** Pure: the distinct part ids the item rows carry directly, in first-seen order. */
export function partIdsOfAssemblyItems(items: ReadonlyArray<AssemblyItemLink>): string[] {
  const seen = new Set<string>()
  for (const item of items) {
    if (item.item_type === 'part' && item.part_id) seen.add(item.part_id)
  }
  return [...seen]
}

/**
 * part id → its lowest catalog price (chunked `.in()`, paged per chunk).
 * Returns {} for no ids. Throws on any page error.
 */
export async function loadLowestPriceByPartId(
  supabase: Client,
  partIds: ReadonlyArray<string>,
): Promise<Record<string, number>> {
  const rows = await loadPartPriceRows<{ part_id: string; price: number }>(supabase, partIds, 'part_id, price', {
    label: 'load lowest part prices',
  })
  const map: Record<string, number> = {}
  for (const row of rows) {
    const existing = map[row.part_id]
    if (existing === undefined || row.price < existing) map[row.part_id] = row.price
  }
  return map
}
