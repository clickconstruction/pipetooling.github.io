/**
 * The reads behind a takeoff's materials at today's book (v2.4395): today's price of each book
 * row the lines were picked from, and, for Pricing, the bid version's own lines. The math is
 * `takeoffPriceDrift.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import { roughCountMultiplier } from './bidTakeoffHelpers'
import type { BookPrice, DriftLine } from './takeoffPriceDrift'

type PriceRow = { id: string; price: number | string; house: { name: string | null } | null; part: { name: string | null } | null }
type LineRow = {
  id: string
  quantity: number | string | null
  unit_price: number | string | null
  source_material_part_price_id: string | null
  part: { name: string | null } | null
  row: { n: number | string | null } | null
}

/** Today's price and house of each book row; a row the reader cannot see is simply missing. */
export async function loadBookPrices(db: SupabaseClient, priceIds: ReadonlyArray<string>): Promise<Map<string, BookPrice>> {
  const ids = [...new Set(priceIds.filter(Boolean))]
  const rows = await fetchAllRowsChunkedIn<PriceRow, string>(
    ids,
    async (chunk, from, to) => ({
      data: (await withSupabaseRetry(
        async () => db.from('material_part_prices').select('id, price, house:supply_houses(name), part:material_parts(name)').in('id', chunk).order('id', { ascending: true }).range(from, to),
        'load book prices for a takeoff',
      )) as unknown as PriceRow[] | null,
      error: null,
    }),
    'load book prices for a takeoff',
  )
  return new Map(rows.map((r) => [r.id, { price: Number(r.price), houseName: r.house?.name ?? 'Supply house', partName: r.part?.name ?? null }]))
}

/** One bid version's part lines as the drift reads them (`versionId` null = an unsplit bid's base). */
export async function loadTakeoffDriftLines(db: SupabaseClient, args: { bidId: string; versionId: string | null }): Promise<DriftLine[]> {
  const rows = await fetchAllRows<LineRow>(
    async (from, to) => ({
      data: (await withSupabaseRetry(async () => {
        const q = db
          .from('bids_takeoff_rough_part_lines')
          .select('id, quantity, unit_price, source_material_part_price_id, part:material_parts(name), row:bids_count_rows(n:count)')
          .eq('bid_id', args.bidId)
        const scoped = args.versionId ? q.eq('bid_version_id', args.versionId) : q.is('bid_version_id', null)
        return scoped.order('id', { ascending: true }).range(from, to)
      }, 'load takeoff lines for today’s book')) as unknown as LineRow[] | null,
      error: null,
    }),
    'load takeoff lines for today’s book',
  )
  return rows.map((r) => ({
    id: r.id,
    partName: r.part?.name ?? 'Part',
    quantity: Number(r.quantity) || 0,
    unitPrice: Number(r.unit_price) || 0,
    count: roughCountMultiplier(r.row?.n),
    sourcePriceId: r.source_material_part_price_id,
  }))
}
