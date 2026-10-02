/**
 * Reads a bid's materials the way its model stores them (v2.4368): the stage
 * POs for By Stage, the version's part lines with the order rounding for
 * Combined. The same reads the pricing engine makes, for a document that
 * fetches its own data (the Approval PDF). The math is `bidMaterials.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { normalizeMaterialsModel } from './bidTakeoffHelpers'
import { combinedMaterials, stagePoMaterials, type BidMaterials } from './bidMaterials'
import type { RoughLineDbRow } from './takeoffOrderRounding'

type Client = SupabaseClient<Database>

/** The cost estimate's three stage PO links (By Stage's "Create purchase orders for Stages"). */
export type StagePoLinks = {
  purchase_order_id_rough_in: string | null
  purchase_order_id_top_out: string | null
  purchase_order_id_trim_set: string | null
}

/** Σ price_at_time × quantity over a purchase order's items; 0 with no PO or when the read fails. */
export async function loadPoTotal(supabase: Client, poId: string | null | undefined): Promise<number> {
  if (!poId) return 0
  const { data, error } = await supabase.from('purchase_order_items').select('price_at_time, quantity').eq('purchase_order_id', poId)
  if (error) return 0
  return ((data ?? []) as Array<{ price_at_time: number | string | null; quantity: number | string | null }>).reduce(
    (sum, i) => sum + Number(i.price_at_time) * Number(i.quantity),
    0,
  )
}

/**
 * The model is read fresh, so a switch made moments ago on Takeoffs counts;
 * `fallbackModel` (the bid row the caller holds) answers when that read fails.
 * Combined reads the lines of `bidVersionId` (null = the unsplit base), which
 * must be the version `countRows` belong to.
 */
export async function loadBidMaterials(
  supabase: Client,
  args: {
    bidId: string
    bidVersionId: string | null
    countRows: ReadonlyArray<{ id: string; count: number | string | null }>
    /** null = no cost estimate yet, so By Stage has no POs. */
    costEstimate: StagePoLinks | null
    fallbackModel?: string | null
  },
): Promise<BidMaterials> {
  const { data: bidRow, error: bidErr } = await supabase.from('bids').select('materials_model').eq('id', args.bidId).maybeSingle()
  const model = normalizeMaterialsModel(bidErr || !bidRow ? args.fallbackModel : (bidRow as { materials_model: string | null }).materials_model)
  if (model === 'rough') {
    const q = supabase
      .from('bids_takeoff_rough_part_lines')
      .select('count_row_id, part_id, quantity, unit_price, order_increment, order_increment_unit')
      .eq('bid_id', args.bidId)
    const { data } = await (args.bidVersionId == null ? q.is('bid_version_id', null) : q.eq('bid_version_id', args.bidVersionId))
    return combinedMaterials((data ?? []) as RoughLineDbRow[], new Map(args.countRows.map((r) => [r.id, r.count])))
  }
  const [roughIn, topOut, trimSet] = await Promise.all([
    loadPoTotal(supabase, args.costEstimate?.purchase_order_id_rough_in),
    loadPoTotal(supabase, args.costEstimate?.purchase_order_id_top_out),
    loadPoTotal(supabase, args.costEstimate?.purchase_order_id_trim_set),
  ])
  return stagePoMaterials({ roughIn, topOut, trimSet })
}
