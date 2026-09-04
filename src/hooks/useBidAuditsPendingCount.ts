import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { countWorkablePendingAudits, pairTwinReferences } from '../lib/bids/bidAudits'

// bid_audits reaches the generated types only with the post-push gen-types run
// (BidRfiQueue pattern) — untyped view until then.
const auditDb = supabase as unknown as SupabaseClient

/**
 * Audits-tab gating (v2.2517): how many robot bids are awaiting a human audit, and
 * whether any audits exist at all (the tab shows whenever there is history, so a
 * just-finished audit doesn't make the tab vanish mid-session). Missing table —
 * client shipping ahead of the migration — reads as "no audits".
 *
 * Two kinds of pending audit are NOT workable and don't count (v2.2553, v2.2796):
 * sealed shadows (the reference bid hasn't gone out — anchoring) and unpriced
 * audits (the robot opened the audit before pasting its counts into PipeTooling,
 * so there is nothing to judge). The pairing for the seal comes from
 * `bids.twin_source_bid_id` OR the shadow run row, so a pre-stamp shadow still seals.
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
        const rows = (data ?? []) as Array<{ status: 'pending' | 'done' | 'digested'; bid_id: string }>
        const pendingIds = [...new Set(rows.filter((r) => r.status === 'pending').map((r) => r.bid_id))]
        let sealedBidIds = new Set<string>()
        let unpricedBidIds = new Set<string>()
        if (pendingIds.length) {
          try {
            const [twins, shadowRuns] = await Promise.all([
              auditDb.from('bids').select('id, bid_number, twin_source_bid_id').in('id', pendingIds).then((r) => (r.data ?? []) as Array<{ id: string; bid_number: string | null; twin_source_bid_id: string | null }>),
              // Staff read of shadow runs is the RPC (bid numbers; sealed money NULL) — the direct select is RLS-closed.
              auditDb.rpc('list_shadow_runs').then((r) => (r.data ?? []) as Array<{ shadow_bid_number: string | null; reference_bid_number: string | null; reference_sent_at: string | null }>),
            ])
            const pairing = pairTwinReferences(twins, shadowRuns)
            const refIds = [...new Set([...pairing.values()].map((k) => k.refId).filter((x): x is string => !!x))]
            const refs = refIds.length
              ? (((await auditDb.from('bids').select('id, bid_date_sent').in('id', refIds)).data ?? []) as Array<{ id: string; bid_date_sent: string | null }>)
              : []
            const unsentRefs = new Set(refs.filter((r) => !r.bid_date_sent).map((r) => r.id))
            sealedBidIds = new Set(
              [...pairing]
                .filter(([, key]) => (key.refId ? unsentRefs.has(key.refId) : key.refSentAt == null))
                .map(([twinId]) => twinId),
            )
          } catch {
            // Seal check is best-effort — fall back to the raw pending count.
          }
          try {
            // One HEAD count per pending bid (cheap, indexed) instead of pulling every row.
            const counts = await Promise.all(
              pendingIds.map(async (bidId) => {
                const { count } = await auditDb.from('bids_count_rows').select('id', { count: 'exact', head: true }).eq('bid_id', bidId)
                return [bidId, count ?? 0] as const
              }),
            )
            unpricedBidIds = new Set(counts.filter(([, n]) => n === 0).map(([id]) => id))
          } catch {
            // Best-effort too — an unpriced audit then counts as pending, as before.
          }
        }
        if (cancelled) return
        setState({ pending: countWorkablePendingAudits(rows, sealedBidIds, unpricedBidIds), anyAudits: rows.length > 0 })
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
