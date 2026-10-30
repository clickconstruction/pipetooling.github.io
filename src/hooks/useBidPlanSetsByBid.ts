import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BID_PLAN_SET_SELECT, type BidPlanSetRow } from '../lib/bids/bidPlanSets'

/**
 * The plan sets behind the board's bids (v2.6169): one chunked read of `bid_plan_sets` for every bid
 * on the page, never one per row, as the CountTooling projects ride in (`useBidCountSourcesByBid`).
 * Fail-soft: a bid with no row reads as one set, the link on the bid itself (`planSetsForBid`).
 * `gen` re-runs the read.
 */
export function useBidPlanSetsByBid(bidIds: ReadonlyArray<string>, enabled: boolean, gen = 0): ReadonlyMap<string, BidPlanSetRow[]> {
  const key = useMemo(() => (enabled ? [...bidIds].sort().join(',') : ''), [bidIds, enabled])
  const [map, setMap] = useState<ReadonlyMap<string, BidPlanSetRow[]>>(() => new Map())

  useEffect(() => {
    if (!key) {
      setMap(new Map())
      return
    }
    let cancelled = false
    void (async () => {
      const ids = key.split(',')
      const rows: BidPlanSetRow[] = []
      try {
        for (let i = 0; i < ids.length; i += 200) {
          const { data, error } = await supabase.from('bid_plan_sets').select(BID_PLAN_SET_SELECT).in('bid_id', ids.slice(i, i + 200))
          if (error) throw error
          rows.push(...((data ?? []) as BidPlanSetRow[]))
        }
      } catch {
        /* the sets are a courtesy — the bid's own plans link still draws */
      }
      if (cancelled) return
      const next = new Map<string, BidPlanSetRow[]>()
      for (const r of rows) {
        const list = next.get(r.bid_id)
        if (list) list.push(r)
        else next.set(r.bid_id, [r])
      }
      setMap(next)
    })()
    return () => {
      cancelled = true
    }
  }, [key, gen])

  return map
}
