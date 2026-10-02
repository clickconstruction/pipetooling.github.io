/**
 * Reads a bid's materials (v2.4368): the version's part lines with the order
 * rounding. The same read the pricing engine makes, for a document that
 * fetches its own data (the Approval PDF). The math is `bidMaterials.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { combinedMaterials, type BidMaterials } from './bidMaterials'
import type { RoughLineDbRow } from './takeoffOrderRounding'

type Client = SupabaseClient<Database>

/**
 * Reads the lines of `bidVersionId` (null = the unsplit base), which must be
 * the version `countRows` belong to.
 */
export async function loadBidMaterials(
  supabase: Client,
  args: {
    bidId: string
    bidVersionId: string | null
    countRows: ReadonlyArray<{ id: string; count: number | string | null }>
  },
): Promise<BidMaterials> {
  const q = supabase
    .from('bids_takeoff_rough_part_lines')
    .select('count_row_id, part_id, quantity, unit_price, order_increment, order_increment_unit')
    .eq('bid_id', args.bidId)
  const { data } = await (args.bidVersionId == null ? q.is('bid_version_id', null) : q.eq('bid_version_id', args.bidVersionId))
  return combinedMaterials((data ?? []) as RoughLineDbRow[], new Map(args.countRows.map((r) => [r.id, r.count])))
}
