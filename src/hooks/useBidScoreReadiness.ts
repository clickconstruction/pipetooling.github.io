import { useEffect, useMemo, useState } from 'react'
import { bidScoreReadiness, bidsToJudge, type LaborCompleteness, type ScoreReadiness } from '../lib/scorecard/scoreReadiness'
import { loadLaborCompleteness, loadPricedLabor, type PricedLabor } from '../lib/scorecard/scoreReadinessIo'
import { supabase } from '../lib/supabase'

type JudgedBid = { id: string; outcome?: string | null; bid_date_sent?: string | null; priced_revenue_usd?: number | null; priced_cost_usd?: number | null; priced_uncosted_usd?: number | null }

const NONE: ReadonlyMap<string, LaborCompleteness> = new Map()
const NO_KEPT: ReadonlyMap<string, PricedLabor> = new Map()

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
  /** The count kept with each sent bid's stamp (v2.7370); a bid with none is judged by the Labor tab as it stands. */
  const [kept, setKept] = useState<ReadonlyMap<string, PricedLabor>>(NO_KEPT)

  useEffect(() => {
    if (!idsKey) {
      setLabor(NONE)
      setKept(NO_KEPT)
      return
    }
    let live = true
    const ids = idsKey.split(',')
    loadLaborCompleteness(ids)
      .then((m) => {
        if (live) setLabor(m)
      })
      .catch(() => {
        if (live) setLabor(NONE)
      })
    void loadPricedLabor(ids).then((m) => {
      if (live) setKept(m)
    })
    return () => {
      live = false
    }
  }, [idsKey])

  return useMemo(() => {
    const out = new Map<string, Extract<ScoreReadiness, { kind: 'hold' }>>()
    for (const b of judged) {
      const r = bidScoreReadiness({ pricedRevenueUsd: b.priced_revenue_usd, pricedCostUsd: b.priced_cost_usd, pricedUncostedUsd: b.priced_uncosted_usd, labor: labor.get(b.id) ?? null, sent: !!b.bid_date_sent, pricedLabor: kept.get(b.id) ?? null })
      if (r.kind === 'hold') out.set(b.id, r)
    }
    return out
  }, [judged, labor, kept])
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
        const [{ data, error }, labor, kept] = await Promise.all([
          supabase.from('bids').select('id, bid_date_sent, priced_revenue_usd, priced_cost_usd, priced_uncosted_usd').eq('id', bidId).maybeSingle(),
          loadLaborCompleteness([bidId]),
          loadPricedLabor([bidId]),
        ])
        if (!live || error || !data) return
        const r = bidScoreReadiness({ pricedRevenueUsd: data.priced_revenue_usd, pricedCostUsd: data.priced_cost_usd, pricedUncostedUsd: data.priced_uncosted_usd, labor: labor.get(bidId) ?? null, sent: !!data.bid_date_sent, pricedLabor: kept.get(bidId) ?? null })
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

/** The count kept with one bid's stamp (v2.7370), for the Workbench on a sent bid. Null until read, and when the stamp has none. */
export function usePricedLabor(bidId: string | null | undefined): PricedLabor | null {
  const [kept, setKept] = useState<PricedLabor | null>(null)
  useEffect(() => {
    setKept(null)
    if (!bidId) return
    let live = true
    void loadPricedLabor([bidId]).then((m) => {
      if (live) setKept(m.get(bidId) ?? null)
    })
    return () => {
      live = false
    }
  }, [bidId])
  return kept
}
