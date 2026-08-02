import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import type { PartPriceOption } from '../materialsDocuments/poPrint'

type MaterialPartPrice = Database['public']['Tables']['material_part_prices']['Row']
type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']

export type PartPriceWithSupplyHouse = MaterialPartPrice & { supply_house: SupplyHouse }

/**
 * Batch-fetch prices for multiple parts in one query, then group by part_id —
 * extracted from module scope in Materials.tsx (Stage A). Part of the v2.46
 * disk-IO optimization wave: 500-ID `.in()` chunks with a client-side re-sort,
 * since chunked results aren't globally ordered. Keep the chunk size.
 */
export async function fetchPricesForParts(
  supabase: SupabaseClient<Database>,
  partIds: string[]
): Promise<Map<string, PartPriceWithSupplyHouse[]>> {
  const map = new Map<string, PartPriceWithSupplyHouse[]>()
  if (partIds.length === 0) return map

  // Supabase .in() works with many IDs; chunk if needed for very large sets (e.g. 1000+)
  const CHUNK = 500
  for (let i = 0; i < partIds.length; i += CHUNK) {
    const chunk = partIds.slice(i, i + CHUNK)
    const { data: pricesData } = await supabase
      .from('material_part_prices')
      .select('*, supply_houses(*)')
      .in('part_id', chunk)
      .order('price', { ascending: true })

    const rows = (pricesData as unknown as (MaterialPartPrice & { supply_houses: SupplyHouse })[]) ?? []
    for (const row of rows) {
      const pid = row.part_id
      const priceRow = { ...row, supply_house: row.supply_houses }
      const existing = map.get(pid)
      if (existing) {
        existing.push(priceRow)
      } else {
        map.set(pid, [priceRow])
      }
    }
  }

  // Sort each part's prices by price ascending (chunked results may not be fully ordered)
  for (const prices of map.values()) {
    prices.sort((a, b) => a.price - b.price)
  }
  return map
}

/** Single-part price options (ascending) for the draft PO print's "All prices" column. */
export async function fetchPricesForPart(
  supabase: SupabaseClient<Database>,
  partId: string
): Promise<PartPriceOption[]> {
  const { data, error } = await supabase
    .from('material_part_prices')
    .select('*, supply_houses(*)')
    .eq('part_id', partId)
    .order('price', { ascending: true })
  if (error) return []
  const pricesList = (data as unknown as (MaterialPartPrice & { supply_houses: SupplyHouse })[]) ?? []
  return pricesList.map(p => ({
    supply_house_name: p.supply_houses.name,
    price: p.price,
  }))
}
