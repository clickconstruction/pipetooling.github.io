import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { fetchTwinUserIds } from '../lib/fetchTwinUserIds'
import { partitionBidsByScope } from '../lib/bidBoardScope'
import { bidFollowupsDue, type BidFollowupRow, type BidFollowupsDue } from '../lib/bids/bidFollowupsDue'

type Embed = { name: string | null } | { name: string | null }[] | null
const embedName = (e: Embed): string | null => (Array.isArray(e) ? e[0]?.name : e?.name) ?? null

/** The bids that carry a call-again day at all: few rows, read whole, judged by the kernel. */
export async function loadBidFollowupRows(): Promise<BidFollowupRow[]> {
  const [rows, twinIds] = await Promise.all([
    withSupabaseRetry(
      async () =>
        supabase
          .from('bids')
          .select('id, project_name, bid_value, bid_date_sent, outcome, last_contact, next_followup_on, adopted_into_bid_id, estimator_id, created_by, customers(name), bids_gc_builders(name)')
          .not('next_followup_on', 'is', null)
          .is('outcome', null)
          .limit(500),
      'bids with a call-again day',
    ),
    fetchTwinUserIds(),
  ])
  type Row = Omit<BidFollowupRow, 'builderName'> & { estimator_id: string | null; created_by: string | null; customers: Embed; bids_gc_builders: Embed }
  // People bids only, like every other bid reminder: the robots' specimens stay on their board.
  const people = partitionBidsByScope((rows ?? []) as unknown as Row[], twinIds).people
  return people.map((b) => ({ ...b, builderName: embedName(b.customers) ?? embedName(b.bids_gc_builders) }))
}

/**
 * Promised bid calls that are due (v2.4426): the Dashboard's Needs You item. The whole team's,
 * like the lost-bids card: the person who promised the call may be out the day it comes due.
 */
export function useBidFollowupsDue(enabled: boolean): { due: BidFollowupsDue | null; loading: boolean } {
  const [due, setDue] = useState<BidFollowupsDue | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled) {
      setDue(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const rows = await loadBidFollowupRows()
        if (!cancelled) setDue(bidFollowupsDue(rows, todayYmdInAppTz()))
      } catch {
        if (!cancelled) setDue(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return { due, loading }
}
