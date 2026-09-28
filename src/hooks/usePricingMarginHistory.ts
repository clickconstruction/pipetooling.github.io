/**
 * Bids → Pricing: the win/loss calibration history for a service type (Workbench
 * iteration 3) — the read behind `PricingMarginHistory`, moved out of `BidsPricingTab` as it
 * was. `null` = loading or no service type; a failed read is an empty list, so the block
 * stays away without an error.
 */
import { useEffect, useState } from 'react'

import { supabase } from '../lib/supabase'
import type { BidPricingHistoryRow } from '../types/database-functions'

export function usePricingMarginHistory(selectedServiceTypeId: string | null | undefined): BidPricingHistoryRow[] | null {
  // Iteration 3 — win/loss calibration history (null = loading/unavailable).
  const [wbHistory, setWbHistory] = useState<BidPricingHistoryRow[] | null>(null)
  // Iteration 3 — win/loss calibration history for this service type.
  useEffect(() => {
    if (!selectedServiceTypeId) {
      setWbHistory(null)
      return
    }
    let cancelled = false
    void (async () => {
      const { data, error: rpcErr } = await supabase.rpc('bid_pricing_history', { p_service_type_id: selectedServiceTypeId })
      if (cancelled) return
      if (rpcErr || !Array.isArray(data)) {
        setWbHistory([])
        return
      }
      setWbHistory(data as unknown as BidPricingHistoryRow[])
    })()
    return () => {
      cancelled = true
    }
  }, [selectedServiceTypeId])
  return wbHistory
}
