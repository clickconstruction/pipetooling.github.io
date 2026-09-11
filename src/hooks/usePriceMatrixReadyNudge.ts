import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import type { NeedsYouInputs } from '../lib/dashboardNeedsYou'

// bid_price_matrix_requests joins bids for the label — untyped client (twins pattern).
const db = supabase as unknown as SupabaseClient

type Row = {
  id: string
  bid_id: string
  finished_at: string | null
  result: { rows_priced?: number; rows_asked?: number; expired_houses?: string[] } | null
  bids: { bid_number: string | null; project_name: string | null } | Array<{ bid_number: string | null; project_name: string | null }> | null
}

/**
 * Robot price matrices finished and not yet opened (Price Matrix PR 5) for the
 * Dashboard's Needs You card. RLS scopes the rows to the pricing-sharer roles;
 * null while disabled / loading / none. Refetches on window focus like the
 * neighbouring nudges.
 */
export function usePriceMatrixReadyNudge(enabled: boolean): { ready: NonNullable<NeedsYouInputs['priceMatrixReady']> | null } {
  const [ready, setReady] = useState<NonNullable<NeedsYouInputs['priceMatrixReady']> | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setReady(null)
      return
    }
    try {
      const { data, error } = await db
        .from('bid_price_matrix_requests')
        .select('id, bid_id, finished_at, result, bids(bid_number, project_name)')
        .eq('status', 'ready')
        .is('reviewed_at', null)
        .order('finished_at', { ascending: false, nullsFirst: false })
        .limit(20)
      if (error || !Array.isArray(data) || data.length === 0) {
        setReady(null)
        return
      }
      const rows = data as Row[]
      const f = rows[0]!
      const bid = Array.isArray(f.bids) ? (f.bids[0] ?? null) : f.bids
      setReady({
        count: rows.length,
        first: {
          bidId: f.bid_id,
          bidLabel: bid?.bid_number ? `BP${bid.bid_number}` : 'a bid',
          project: bid?.project_name ?? null,
          picks: f.result?.rows_priced ?? 0,
          toSettle: f.result?.rows_asked ?? 0,
          expiredHouses: f.result?.expired_houses?.length ?? 0,
        },
      })
    } catch {
      setReady(null)
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
  return { ready }
}
