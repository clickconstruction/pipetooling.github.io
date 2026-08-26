import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { buildLostBidNudge, type LostBidNudge } from '../lib/dashboardLostBidNudge'

/**
 * Lost-bids-missing-reason nudge data (v2.2347): the whole-team queue, matching
 * the Why we lost lens — most lost bids have someone else (or nobody) as
 * estimator/account man, so a personal filter would hide the backlog from the
 * person clearing it. Same query the Dashboard quick row runs inline; when the
 * Needs You follow-ups touch that file next, point it here too.
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
              .select('loss_category, bid_value')
              .eq('outcome', 'lost')
              .limit(1000),
          'quickfill lost bids missing loss reason',
        )
        if (cancelled) return
        const rows = (rawRows ?? []) as Array<{ loss_category: string | null; bid_value: number | null }>
        setNudge(buildLostBidNudge(rows))
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
