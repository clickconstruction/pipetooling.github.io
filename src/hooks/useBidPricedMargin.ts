import { useEffect, useState } from 'react'
import { loadBidPricedMargins } from '../lib/bids/pricedMarginIo'
import type { BidPricedMargin } from '../lib/bids/pricedMargin'

/**
 * The margin a linked bid was priced at (v2.5043), for the job's Costs verdict. Fail-soft: no bid,
 * no stamp, or a read that fails all read as null, and the verdict shows no priced line.
 */
export function useBidPricedMargin(bidId: string | null, enabled: boolean): BidPricedMargin | null {
  const [stamp, setStamp] = useState<BidPricedMargin | null>(null)
  useEffect(() => {
    setStamp(null)
    if (!enabled || !bidId) return
    let cancelled = false
    void loadBidPricedMargins([bidId]).then((m) => {
      if (!cancelled) setStamp(m.get(bidId) ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [bidId, enabled])
  return stamp
}
