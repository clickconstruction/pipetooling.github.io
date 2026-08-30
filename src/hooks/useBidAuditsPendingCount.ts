import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// bid_audits reaches the generated types only with the post-push gen-types run
// (BidRfiQueue pattern) — untyped view until then.
const auditDb = supabase as unknown as SupabaseClient

/**
 * Audits-tab gating (v2.2517): how many robot bids are awaiting a human audit, and
 * whether any audits exist at all (the tab shows whenever there is history, so a
 * just-finished audit doesn't make the tab vanish mid-session). Missing table —
 * client shipping ahead of the migration — reads as "no audits".
 */
export function useBidAuditsPendingCount(enabled: boolean): { pending: number; anyAudits: boolean } {
  const [state, setState] = useState<{ pending: number; anyAudits: boolean }>({ pending: 0, anyAudits: false })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await auditDb.from('bid_audits').select('status').limit(200)
        if (error) throw new Error(error.message)
        if (cancelled) return
        const rows = (data ?? []) as Array<{ status: string }>
        setState({ pending: rows.filter((r) => r.status === 'pending').length, anyAudits: rows.length > 0 })
      } catch {
        // Missing table or transient error: keep the tab hidden rather than toasting.
        if (!cancelled) setState({ pending: 0, anyAudits: false })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return state
}
