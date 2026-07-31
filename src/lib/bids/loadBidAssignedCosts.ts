import type { SupabaseClient } from '@supabase/supabase-js'
import {
  bidAssignedCostsByBidId,
  type BidAssignedCostRows,
  type BidAssignedCosts,
} from './bidAssignedCosts'

/**
 * Read the four bid-side cost mirrors (v2.1165) and fold them into per-bid
 * totals. Everything the Bid Costs tab needs beyond the clocked-labor loader.
 *
 * The four reads run concurrently and each failure degrades to an empty list —
 * a bid missing its parts rows should still show its materials, not blank the
 * whole column. The supply join mirrors the job side
 * (`fetchJobMaterialsCostSnapshot`): the allocation stores a percentage, the
 * cost is that share of the invoice's own amount.
 */
export async function loadBidAssignedCosts(
  supabase: SupabaseClient,
): Promise<Map<string, BidAssignedCosts>> {
  const safe = async <T>(run: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> => {
    try {
      const { data, error } = await run()
      if (error) return []
      return (data ?? []) as T[]
    } catch {
      return []
    }
  }

  const [parts, materials, supplyRaw, mercury] = await Promise.all([
    safe<BidAssignedCostRows['parts'][number]>(() =>
      supabase.from('bids_tally_parts').select('bid_id, quantity, fixture_cost'),
    ),
    safe<BidAssignedCostRows['materials'][number]>(() =>
      supabase.from('bids_materials').select('bid_id, amount'),
    ),
    safe<{ bid_id: string; pct: number | string | null; supply_house_invoices?: { amount: number | string | null } | { amount: number | string | null }[] | null }>(
      () =>
        supabase
          .from('supply_house_invoice_bid_allocations')
          .select('bid_id, pct, supply_house_invoices(amount)'),
    ),
    safe<BidAssignedCostRows['mercury'][number]>(() =>
      supabase.from('mercury_transaction_bid_allocations').select('bid_id, amount'),
    ),
  ])

  // PostgREST returns an embedded to-one either as an object or a 1-element
  // array depending on how it infers the relationship; normalise both.
  const supply = supplyRaw.map((r) => {
    const inv = Array.isArray(r.supply_house_invoices) ? r.supply_house_invoices[0] : r.supply_house_invoices
    return { bid_id: r.bid_id, pct: r.pct, invoice_amount: inv?.amount ?? 0 }
  })

  return bidAssignedCostsByBidId({ parts, materials, supply, mercury })
}
