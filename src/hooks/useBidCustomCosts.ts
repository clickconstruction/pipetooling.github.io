/**
 * Applied-quote materials overrides for a bid (Rung G, v2.2655 —
 * docs/APPLY_PICKS_TO_COSTS_DECISION.md). Rows in bid_count_row_custom_costs
 * replace a count row's MATERIALS component (per unit, pre-tax) in
 * computeBidPricingRows; labor is never touched. Bid-level (not per price
 * book version) — a negotiated materials price is true regardless of which
 * sale scenario is on screen.
 */
import { useCallback, useEffect, useState } from 'react'

import { supabase } from '../lib/supabase'

export type BidCustomCost = {
  id: string
  count_row_id: string
  unit_materials_cents: number
  house_name: string | null
  lot_group_id: string | null
  applied_at: string
}

/**
 * `versionId` is only a reason to read again: the rows are the whole bid's, but a version made a
 * moment ago brought copies of its source's costs with it (v2.4413), and the list read when the
 * bid opened does not hold them.
 */
export function useBidCustomCosts(bidId: string | null, versionId: string | null = null) {
  const [customCosts, setCustomCosts] = useState<BidCustomCost[]>([])

  const reloadCustomCosts = useCallback(async () => {
    if (!bidId) {
      setCustomCosts([])
      return
    }
    const { data, error } = await supabase
      .from('bid_count_row_custom_costs')
      .select('id, count_row_id, unit_materials_cents, house_name, lot_group_id, applied_at')
      .eq('bid_id', bidId)
    if (!error) setCustomCosts((data as BidCustomCost[]) ?? [])
  }, [bidId])

  useEffect(() => {
    void reloadCustomCosts()
  }, [reloadCustomCosts, versionId])

  return { customCosts, reloadCustomCosts }
}
