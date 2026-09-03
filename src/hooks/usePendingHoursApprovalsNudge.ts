import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { denverCalendarDayKey } from '../utils/dateUtils'

/** The card only nags once the OLDEST pending day is this old — a same-week queue stays quiet. */
export const HOURS_APPROVALS_MIN_AGE_DAYS = 3

export type PendingHoursApprovals = {
  /** Closed sessions waiting on approval. */
  sessions: number
  totalHours: number
  people: number
  /** Whole company-calendar days since the oldest pending session's work_date (0 = today). */
  oldestAgeDays: number
}

/**
 * Closed clock sessions awaiting approval, for the Needs You card (v2.2671).
 *
 * All gating lives in count_pending_clock_session_approvals() — a caller
 * without approval powers gets the zero row, so this hook has no role logic
 * (list_bulk_deletion_alerts precedent). Refetches on window focus like the
 * neighbouring dashboard nudges; a failed poll shows nothing this round.
 *
 * The RPC is not in the generated types yet, hence the established
 * `(supabase as any).rpc(...)` cast precedent.
 */
export function usePendingHoursApprovalsNudge(enabled: boolean): {
  approvals: PendingHoursApprovals | null
  /** Re-poll now — call after approving/rejecting so a count badge doesn't lag until the next focus. */
  refresh: () => void
} {
  const [refreshKey, setRefreshKey] = useState(0)
  const [approvals, setApprovals] = useState<PendingHoursApprovals | null>(null)

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
          async () => await rpc('count_pending_clock_session_approvals'),
          'count pending hours approvals',
        )
        if (cancelled) return
        const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined
        const sessions = typeof row?.sessions === 'number' ? row.sessions : 0
        const oldest = typeof row?.oldest_work_date === 'string' ? row.oldest_work_date : null
        if (sessions <= 0 || oldest == null) {
          setApprovals(null)
          return
        }
        const todayYmd = denverCalendarDayKey(Date.now())
        const ageMs = Date.parse(`${todayYmd}T00:00:00Z`) - Date.parse(`${oldest}T00:00:00Z`)
        setApprovals({
          sessions,
          totalHours: typeof row?.total_hours === 'number' ? row.total_hours : Number(row?.total_hours ?? 0) || 0,
          people: typeof row?.people === 'number' ? row.people : 0,
          oldestAgeDays: Math.max(0, Math.round(ageMs / 86_400_000)),
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
