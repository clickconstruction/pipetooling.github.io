import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { lostBidNudgeFromCounts, type LostBidNudge } from '../lib/dashboardLostBidNudge'
import { bidSentCounts, type BidSentCountsBid, type BidSentScope } from '../lib/bids/bidSentCounts'

/** The Dashboard card is company-wide by design — the label it wears (Tier-2 #20). */
export const LOST_BID_NUDGE_SCOPE: BidSentScope = { kind: 'all' }

/**
 * Lost-bids-missing-reason nudge data (v2.2347): the whole-team queue, matching
 * the Why we lost lens — most lost bids have someone else (or nobody) as
 * estimator/account man, so a personal filter would hide the backlog from the
 * person clearing it. Tier-2 #20: one hook for the Dashboard quick row AND the
 * Quickfill twin, reading the one count kernel (`bidSentCounts`, scope `all`) so
 * the card's number is the `/bids` lens number summed over every trade pill —
 * adopted bids excluded here as they are there.
 */
export function useLostBidNudge(enabled: boolean): { nudge: LostBidNudge | null; loading: boolean } {
  const [nudge, setNudge] = useState<LostBidNudge | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled) {
      setNudge(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const rawRows = await withSupabaseRetry(
          async () =>
            supabase
              .from('bids')
              .select('id, outcome, bid_date_sent, loss_category, bid_value, service_type_id, adopted_into_bid_id')
              .eq('outcome', 'lost')
              .limit(1000),
          'quickfill lost bids missing loss reason',
        )
        if (cancelled) return
        const rows = (rawRows ?? []) as BidSentCountsBid[]
        setNudge(lostBidNudgeFromCounts(bidSentCounts(rows, { scope: LOST_BID_NUDGE_SCOPE })))
      } catch {
        if (!cancelled) setNudge(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return { nudge, loading }
}
