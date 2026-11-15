import { useEffect, useMemo, useState } from 'react'
import { bidScoreReadiness, bidsToJudge, type LaborCompleteness, type ScoreReadiness } from '../lib/scorecard/scoreReadiness'
import { loadLaborCompleteness } from '../lib/scorecard/scoreReadinessIo'
import { supabase } from '../lib/supabase'

type JudgedBid = { id: string; outcome?: string | null; bid_date_sent?: string | null; priced_revenue_usd?: number | null; priced_cost_usd?: number | null; priced_uncosted_usd?: number | null }

const NONE: ReadonlyMap<string, LaborCompleteness> = new Map()

/**
 * Which of a board's bids cannot be scored, by bid id (team scorecard, punch list #360, PR 2): only
 * the bids held, each with its reason. It reads the labor rows of the bids that carry a priced
 * margin, once per set of those bids. A failed read gives nothing: the chip is a reminder, and the
 * board never waits on it.
 */
export function useBidScoreReadiness(bids: readonly JudgedBid[], enabled = true): ReadonlyMap<string, Extract<ScoreReadiness, { kind: 'hold' }>> {
  const judged = useMemo(() => (enabled ? bidsToJudge(bids) : []), [bids, enabled])
  const idsKey = useMemo(() => judged.map((b) => b.id).sort().join(','), [judged])
  const [labor, setLabor] = useState<ReadonlyMap<string, LaborCompleteness>>(NONE)

  useEffect(() => {
    if (!idsKey) {
      setLabor(NONE)
      return
    }
    let live = true
    loadLaborCompleteness(idsKey.split(','))
      .then((m) => {
        if (live) setLabor(m)
      })
      .catch(() => {
        if (live) setLabor(NONE)
      })
    return () => {
      live = false
    }
  }, [idsKey])

  return useMemo(() => {
    const out = new Map<string, Extract<ScoreReadiness, { kind: 'hold' }>>()
    for (const b of judged) {
      const r = bidScoreReadiness({ pricedRevenueUsd: b.priced_revenue_usd, pricedCostUsd: b.priced_cost_usd, pricedUncostedUsd: b.priced_uncosted_usd, labor: labor.get(b.id) ?? null, sent: !!b.bid_date_sent })
      if (r.kind === 'hold') out.set(b.id, r)
    }
    return out
  }, [judged, labor])
}

type Hold = Extract<ScoreReadiness, { kind: 'hold' }>

/**
 * One bid's hold, read fresh (punch list #360, PR 2): the Cover Letter's *Mark sent* is the moment the
 * margin is kept, and the row the page holds may be older than the workbench's last price. Reads the
 * bid's priced margin and its labor rows when the bid opens. Null while it reads and when it fails.
 */
export function useBidScoreHold(bidId: string | null | undefined): Hold | null {
  const [hold, setHold] = useState<Hold | null>(null)
  useEffect(() => {
    setHold(null)
    if (!bidId) return
    let live = true
    void (async () => {
      try {
        const [{ data, error }, labor] = await Promise.all([
          supabase.from('bids').select('id, bid_date_sent, priced_revenue_usd, priced_cost_usd, priced_uncosted_usd').eq('id', bidId).maybeSingle(),
          loadLaborCompleteness([bidId]),
        ])
        if (!live || error || !data) return
        const r = bidScoreReadiness({ pricedRevenueUsd: data.priced_revenue_usd, pricedCostUsd: data.priced_cost_usd, pricedUncostedUsd: data.priced_uncosted_usd, labor: labor.get(bidId) ?? null, sent: !!data.bid_date_sent })
        setHold(r.kind === 'hold' ? r : null)
      } catch {
        /* a reminder: the send never waits on it */
      }
    })()
    return () => {
      live = false
    }
  }, [bidId])
  return hold
}
