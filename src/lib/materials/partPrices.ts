import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import type { PartPriceOption } from '../materialsDocuments/poPrint'
import { chunkIds, fetchAllRowsChunkedIn } from '../supabasePaging'
import { withSupabaseRetry, type SupabaseClientResult } from '../../utils/errorHandling'

type MaterialPartPrice = Database['public']['Tables']['material_part_prices']['Row']
type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']

export type PartPriceWithSupplyHouse = MaterialPartPrice & { supply_house: SupplyHouse }

type PriceRowWithHouse = MaterialPartPrice & { supply_houses: SupplyHouse }

export type LoadPartPriceRowsOptions = {
  /** Operation name on a thrown error. */
  label?: string
  /** Ids per `.in()` list (default: the pager's 150). */
  chunkSize?: number
  /** Order pages by price before id (a caller that shows rows in price order). */
  orderByPrice?: boolean
  /** Give each page `withSupabaseRetry`'s retries: a blip re-reads that page, not the pages before it. */
  retry?: boolean
}

/**
 * Every `material_part_prices` row of the given parts: `.in('part_id', chunk)`
 * per id chunk, each chunk paged with `.range()` in a stable order ending in
 * `id`. PostgREST caps an un-ranged read at `max_rows` (1,000) with NO error,
 * and a part has one price row per supply house, so a few hundred parts pass
 * the cap and the rows past it never reach the lowest-price pick. Every read
 * of price rows ACROSS parts goes through here; one part's prices
 * (`.eq('part_id', id)`) stay where they are. Ids are de-duplicated and blanks
 * dropped. Returns [] without a read for no ids. Throws on any page error.
 */
export async function loadPartPriceRows<T>(
  supabase: SupabaseClient<Database>,
  partIds: ReadonlyArray<string>,
  select: string,
  opts: LoadPartPriceRowsOptions = {},
): Promise<T[]> {
  const label = opts.label ?? 'load part prices'
  const page = (chunk: string[], from: number, to: number) => {
    const filtered = supabase.from('material_part_prices').select(select).in('part_id', chunk)
    const ordered = opts.orderByPrice ? filtered.order('price', { ascending: true }) : filtered
    return ordered.order('id', { ascending: true }).range(from, to) as unknown as PromiseLike<SupabaseClientResult<T[]>>
  }
  return fetchAllRowsChunkedIn<T, string>(
    [...new Set(partIds)].filter(Boolean),
    opts.retry
      ? (chunk, from, to) =>
          withSupabaseRetry(() => page(chunk, from, to), label).then((data) => ({ data, error: null }))
      : page,
    label,
    { chunkSize: opts.chunkSize },
  )
}

/**
 * Batch-fetch prices for multiple parts, then group by part_id —
 * extracted from module scope in Materials.tsx (Stage A). Part of the v2.46
 * disk-IO optimization wave: 500-ID `.in()` chunks with a client-side re-sort,
 * since chunked results aren't globally ordered. Keep the chunk size. Each
 * chunk is paged (a 500-part chunk with several supply houses per part passes
 * 1,000 price rows). A chunk whose read fails adds no prices — never the pages
 * of it that did arrive — and the other chunks still load.
 */
export async function fetchPricesForParts(
  supabase: SupabaseClient<Database>,
  partIds: string[]
): Promise<Map<string, PartPriceWithSupplyHouse[]>> {
  const map = new Map<string, PartPriceWithSupplyHouse[]>()
  if (partIds.length === 0) return map

  const CHUNK = 500
  for (const chunk of chunkIds(partIds, CHUNK)) {
    let rows: PriceRowWithHouse[]
    try {
      rows = await loadPartPriceRows<PriceRowWithHouse>(supabase, chunk, '*, supply_houses(*)', {
        label: 'fetch prices for parts',
        chunkSize: CHUNK,
        orderByPrice: true,
      })
    } catch {
      continue
    }
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
