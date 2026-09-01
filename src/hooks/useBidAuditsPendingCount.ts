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
        const { data, error } = await auditDb.from('bid_audits').select('status, bid_id').limit(200)
        if (error) throw new Error(error.message)
        if (cancelled) return
        const rows = (data ?? []) as Array<{ status: string; bid_id: string }>
        const pendingRows = rows.filter((r) => r.status === 'pending')
        // Sealed-shadow hold (v2.2553): a pending audit whose reference bid hasn't
        // gone out yet isn't workable (anchoring) — don't count it as pending.
        let sealedBidIds = new Set<string>()
        if (pendingRows.length) {
          try {
            const twins = ((await auditDb.from('bids').select('id, twin_source_bid_id').in('id', pendingRows.map((r) => r.bid_id))).data ?? []) as Array<{ id: string; twin_source_bid_id: string | null }>
            const refIds = [...new Set(twins.map((t) => t.twin_source_bid_id).filter((x): x is string => !!x))]
            const refs = refIds.length
              ? (((await auditDb.from('bids').select('id, bid_date_sent').in('id', refIds)).data ?? []) as Array<{ id: string; bid_date_sent: string | null }>)
              : []
            const unsentRefs = new Set(refs.filter((r) => !r.bid_date_sent).map((r) => r.id))
            sealedBidIds = new Set(twins.filter((t) => t.twin_source_bid_id && unsentRefs.has(t.twin_source_bid_id)).map((t) => t.id))
          } catch {
            // Seal check is best-effort — fall back to the raw pending count.
          }
        }
        if (cancelled) return
        setState({ pending: pendingRows.filter((r) => !sealedBidIds.has(r.bid_id)).length, anyAudits: rows.length > 0 })
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
