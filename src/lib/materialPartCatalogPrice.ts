import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { withSupabaseRetry } from '@/utils/errorHandling'

export type LowestPartPriceRow = {
  price: number
  priceId: string
  supply_house_id: string
  supplyHouseName: string
}

type PriceRowWithHouse = {
  id: string
  price: number
  supply_house_id: string
  supply_houses: { name?: string } | null
}

function supplyHouseNameFromJoin(supply_houses: { name?: string } | null | undefined): string {
  const n = supply_houses?.name
  return typeof n === 'string' && n.trim() ? n.trim() : '—'
}

/** Half-cent tolerance for comparing bid unit price to catalog `price`. */
export function catalogUnitPricesEffectivelyEqual(a: number, b: number, eps = 0.005): boolean {
  return Math.abs(Number(a) - Number(b)) <= eps
}

/**
 * Lowest material_part_prices row per part (same ordering as PO expansion in materialPOUtils).
 */
export async function fetchLowestPartPrice(
  supabase: SupabaseClient<Database>,
  partId: string
): Promise<LowestPartPriceRow | null> {
  const rows = await withSupabaseRetry(
    async () =>
      await supabase
        .from('material_part_prices')
        .select('id, price, supply_house_id, supply_houses(name)')
        .eq('part_id', partId)
        .order('price', { ascending: true })
        .limit(1),
    'fetch lowest material part price'
  )
  const list = (rows ?? []) as PriceRowWithHouse[]
  const first = list[0]
  if (!first?.id) return null
  return {
    priceId: first.id,
    price: Number(first.price),
    supply_house_id: first.supply_house_id,
    supplyHouseName: supplyHouseNameFromJoin(first.supply_houses),
  }
}

/**
 * One round-trip: lowest catalog price per part_id. Ignores empty partIds.
 */
export async function fetchLowestPartPricesBatch(
  supabase: SupabaseClient<Database>,
  partIds: string[]
): Promise<Map<string, LowestPartPriceRow>> {
  const unique = Array.from(new Set(partIds.filter(Boolean)))
  const out = new Map<string, LowestPartPriceRow>()
  if (unique.length === 0) return out

  const all = await withSupabaseRetry(
    async () =>
      await supabase
        .from('material_part_prices')
        .select('id, part_id, price, supply_house_id, supply_houses(name)')
        .in('part_id', unique),
    'fetch material part prices batch'
  )
  for (const row of (all ?? []) as Array<
    PriceRowWithHouse & {
      part_id: string
    }
  >) {
    if (!row.part_id || !row.id) continue
    const price = Number(row.price)
    const prev = out.get(row.part_id)
    if (!prev || price < prev.price || (price === prev.price && row.id < prev.priceId)) {
      out.set(row.part_id, {
        priceId: row.id,
        price,
        supply_house_id: row.supply_house_id,
        supplyHouseName: supplyHouseNameFromJoin(row.supply_houses),
      })
    }
  }
  return out
}
