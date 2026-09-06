import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

/** The card only nags about suggestions at least this old — a same-week queue stays quiet. */
export const LABEL_APPROVALS_MIN_AGE_DAYS = 3

export type PendingLabelApprovals = {
  /** Every pending bank-label suggestion. */
  pending: number
  /** Pending suggestions at least LABEL_APPROVALS_MIN_AGE_DAYS old — the true exceptions. */
  stale: number
  /** Sum of |amount| over the stale rows — the "Unlabeled" money sitting in the P&L. */
  staleAmount: number
  /** Whole days since the oldest pending suggestion was created (0 = today). */
  oldestAgeDays: number
}

/**
 * Pending bank-label suggestions, for the Needs You card (journey-map Tier-2
 * #27, v2.2671 shape). With the org switch on, rule matches approve themselves
 * server-side the moment they are minted, so what stays pending is the
 * exception list — Internal Transfers on split transactions, matches minted
 * before the switch was flipped — and this card counts only the rows old
 * enough to be a stall, not the normal same-week trickle.
 *
 * All gating lives in count_pending_accounting_label_suggestions() — a caller
 * who cannot work the queue gets the zero row, so this hook has no role logic
 * (list_bulk_deletion_alerts precedent). Refetches on window focus like the
 * neighbouring dashboard nudges; a failed poll shows nothing this round.
 *
 * The RPC is not in the generated types yet, hence the established
 * `(supabase as any).rpc(...)` cast precedent.
 */
export function usePendingLabelApprovalsNudge(enabled: boolean): {
  approvals: PendingLabelApprovals | null
  /** Re-poll now — call after Approve all so the card doesn't lag until the next focus. */
  refresh: () => void
} {
  const [refreshKey, setRefreshKey] = useState(0)
  const [approvals, setApprovals] = useState<PendingLabelApprovals | null>(null)

  const bump = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setApprovals(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rpc = (supabase as any).rpc.bind(supabase)
        const rows = await withSupabaseRetry(
          async () => await rpc('count_pending_accounting_label_suggestions', { p_min_age_days: LABEL_APPROVALS_MIN_AGE_DAYS }),
          'count pending label approvals',
        )
        if (cancelled) return
        const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined
        const pending = typeof row?.pending === 'number' ? row.pending : 0
        const oldest = typeof row?.oldest_created_at === 'string' ? Date.parse(row.oldest_created_at) : NaN
        if (pending <= 0 || !Number.isFinite(oldest)) {
          setApprovals(null)
          return
        }
        setApprovals({
          pending,
          stale: typeof row?.stale === 'number' ? row.stale : 0,
          staleAmount: Number(row?.stale_amount ?? 0) || 0,
          oldestAgeDays: Math.max(0, Math.floor((Date.now() - oldest) / 86_400_000)),
        })
      } catch {
        // Never break the dashboard over a nudge; a failed poll just shows nothing this round.
        if (!cancelled) setApprovals(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, refreshKey])

  useEffect(() => {
    if (!enabled) return
    const onFocus = () => bump()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [enabled, bump])

  return { approvals, refresh: bump }
}
