import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { loadBidPricedMargins, stampBidPricedMargin } from '../lib/bids/pricedMarginIo'
import { pricedMarginPct, pricedMarginStampDiffers, type BidPricedMargin, type PricedMarginStampInput } from '../lib/bids/pricedMargin'

/** How long the strip's numbers must sit still after a price write before the stamp reads them. */
export const PRICED_MARGIN_STAMP_SETTLE_MS = 600

/** What the Pricing tab has on screen, refreshed every render: the strip's numbers over saved prices and the gate. */
export type PricedMarginStampLatest = {
  bidId: string
  /** The bid version whose customer-facing price is on screen; null for a bid with no versions. */
  bidVersionId: string | null
  input: PricedMarginStampInput | null
  /** `mayStampPricedMargin` for what is on screen. */
  mayStamp: boolean
}

/** A price write that landed on this bid, and when. */
export type PricedMarginStampArm = { bidId: string; at: number }

/**
 * The margin a bid was priced at, kept on the bid (Burn against the bid, piece 1, v2.5043). Lives at
 * the Pricing tab's top level, so a reload that unmounts the strip cannot drop a write. After one of
 * the tab's own price writes lands on this bid (`arm`), it waits for the numbers to settle, then
 * stamps them (`stamp_bid_priced_margin`) unless the bid already carries them. An arm made on
 * another bid is ignored, so opening a bid never writes. Returns the bid's stamp for the strip's
 * line. Fail-soft both ways: a read or a stamp that fails leaves pricing as it was.
 */
export function usePricedMarginStamp(bidId: string | null, arm: PricedMarginStampArm | null, latest: MutableRefObject<PricedMarginStampLatest | null>): BidPricedMargin | null {
  const [stamp, setStamp] = useState<BidPricedMargin | null>(null)
  const stampRef = useRef<BidPricedMargin | null>(null)
  useEffect(() => {
    stampRef.current = stamp
  }, [stamp])

  useEffect(() => {
    setStamp(null)
    if (!bidId) return
    let cancelled = false
    void loadBidPricedMargins([bidId]).then((m) => {
      if (!cancelled) setStamp(m.get(bidId) ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [bidId])

  useEffect(() => {
    if (!bidId || !arm || arm.bidId !== bidId) return
    const timer = window.setTimeout(() => {
      const now = latest.current
      if (!now || now.bidId !== bidId || !now.mayStamp || !now.input) return
      if (!pricedMarginStampDiffers(stampRef.current, now.input, now.bidVersionId)) return
      const sent = { bidId, bidVersionId: now.bidVersionId, input: now.input }
      void stampBidPricedMargin(sent).then((res) => {
        if (!res || !res.ok || latest.current?.bidId !== sent.bidId) return
        setStamp({ pct: Number.isFinite(res.marginPct) ? res.marginPct : pricedMarginPct(sent.input), ...sent.input, bidVersionId: sent.bidVersionId, at: res.pricedAt })
      })
    }, PRICED_MARGIN_STAMP_SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [bidId, arm, latest])

  return stamp
}
