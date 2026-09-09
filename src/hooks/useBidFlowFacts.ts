import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRowsChunkedIn } from '../lib/supabasePaging'
import { EMPTY_BID_FLOW_FACTS, type BidFlowFacts } from '../lib/bids/bidFlow'

/**
 * SPIKE: the facts the bid row itself does not carry, loaded once for a set
 * of bids in chunked `.in()` reads (never per row). Five existence reads:
 * price requests, count rows, takeoff lines, price assignments, bid rooms.
 * A production build would fold these into the board's own load or one
 * lean aggregate — this is the smallest thing that shows the strip on real
 * bids.
 */
export function useBidFlowFacts(bidIds: ReadonlyArray<string>): {
  factsByBid: Record<string, BidFlowFacts>
  loading: boolean
} {
  const idsKey = useMemo(() => [...new Set(bidIds)].sort().join(','), [bidIds])
  const [factsByBid, setFactsByBid] = useState<Record<string, BidFlowFacts>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : []
    if (ids.length === 0) {
      setFactsByBid({})
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      const existing = async (table: string): Promise<Set<string>> => {
        const rows = await fetchAllRowsChunkedIn<{ bid_id: string }, string>(
          ids,
          (chunk, from, to) =>
            supabase.from(table as never).select('bid_id').in('bid_id', chunk).order('bid_id').range(from, to) as never,
          `bid flow facts · ${table}`,
        )
        return new Set(rows.map((r) => r.bid_id))
      }
      try {
        const [rfq, counts, takeoff, prices, rooms] = await Promise.all([
          existing('bid_rfqs'),
          existing('bids_count_rows'),
          existing('bids_takeoff_rough_part_lines'),
          existing('bid_pricing_assignments'),
          existing('bid_proposal_rooms'),
        ])
        if (cancelled) return
        const next: Record<string, BidFlowFacts> = {}
        for (const id of ids) {
          next[id] = {
            hasRfq: rfq.has(id),
            hasCounts: counts.has(id),
            hasTakeoffLines: takeoff.has(id),
            hasPriceAssignments: prices.has(id),
            hasRoom: rooms.has(id),
          }
        }
        setFactsByBid(next)
      } catch (err) {
        if (cancelled) return
        console.warn('[bid-flow] facts load failed', err)
        const next: Record<string, BidFlowFacts> = {}
        for (const id of ids) next[id] = { ...EMPTY_BID_FLOW_FACTS }
        setFactsByBid(next)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [idsKey])

  return { factsByBid, loading }
}
