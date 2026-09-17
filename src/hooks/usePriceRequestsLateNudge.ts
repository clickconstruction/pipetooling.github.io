import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import type { NeedsYouInputs } from '../lib/dashboardNeedsYou'
import { todayYmdInAppTz } from '../utils/dateUtils'

// bid_rfqs joins bids for the label and the live check — untyped client (the sibling nudges' pattern).
const db = supabase as unknown as SupabaseClient

type Row = {
  id: string
  bid_id: string
  needed_by: string | null
  sent_to: string | null
  bids: { bid_number: string | null; project_name: string | null; outcome: string | null } | Array<{ bid_number: string | null; project_name: string | null; outcome: string | null }> | null
}

function daysPast(ymd: string, todayYmd: string): number {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number)
  const [ty, tm, td] = todayYmd.split('-').map(Number)
  return Math.max(1, Math.round((Date.UTC(ty!, (tm ?? 1) - 1, td ?? 1) - Date.UTC(y!, (m ?? 1) - 1, d ?? 1)) / 86_400_000))
}

/**
 * Price requests past their needed-by with nothing in, on live bids (Price requests PR 4,
 * v2.3573) — the Dashboard's Needs You card. "Nothing in" is the table's own rule: no quote
 * link on the row and no quote plugged against it; closed, draft and quoted rows are out. A
 * live bid is one with no outcome yet (unsent or pending). RLS scopes the rows; null while
 * disabled / loading / none. Refetches on window focus like the neighbouring nudges.
 */
export function usePriceRequestsLateNudge(enabled: boolean): { late: NonNullable<NeedsYouInputs['priceRequestsLate']> | null; reload: () => void } {
  const [late, setLate] = useState<NonNullable<NeedsYouInputs['priceRequestsLate']> | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setLate(null)
      return
    }
    try {
      const today = todayYmdInAppTz()
      const { data, error } = await db
        .from('bid_rfqs')
        .select('id, bid_id, needed_by, sent_to, bids(bid_number, project_name, outcome)')
        .lt('needed_by', today)
        .is('quote_url', null)
        .not('status', 'in', '(closed,draft,quoted)')
        .order('needed_by', { ascending: true })
        .limit(50)
      if (error || !Array.isArray(data) || data.length === 0) {
        setLate(null)
        return
      }
      const live = (data as Row[]).filter((r) => {
        const bid = Array.isArray(r.bids) ? (r.bids[0] ?? null) : r.bids
        return bid != null && bid.outcome == null && !!r.needed_by
      })
      if (live.length === 0) {
        setLate(null)
        return
      }
      // A quote plugged in on Pricing counts as "in" even with no link on the row.
      const { data: quotes } = await db.from('bid_quotes').select('rfq_id').in('rfq_id', live.map((r) => r.id))
      const plugged = new Set(((quotes ?? []) as Array<{ rfq_id: string | null }>).map((q) => q.rfq_id).filter((x): x is string => !!x))
      const open = live.filter((r) => !plugged.has(r.id))
      if (open.length === 0) {
        setLate(null)
        return
      }
      const f = open[0]!
      const bid = Array.isArray(f.bids) ? (f.bids[0] ?? null) : f.bids
      setLate({
        count: open.length,
        first: {
          bidId: f.bid_id,
          bidLabel: bid?.bid_number ? `BP${bid.bid_number}` : 'a bid',
          project: bid?.project_name ?? null,
          house: (f.sent_to ?? '').trim() || 'a supply house',
          daysLate: daysPast(f.needed_by!, today),
        },
      })
    } catch {
      setLate(null)
    }
  }, [enabled])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])
  return { late, reload: () => void load() }
}
