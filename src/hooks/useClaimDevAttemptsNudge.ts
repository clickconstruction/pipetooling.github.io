import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  loadClaimDevAlertDismissState,
  saveClaimDevAlertDismissState,
  shouldShowClaimDevAlert,
  type ClaimDevAlertDismissState,
} from '../lib/claimDevAlertDismiss'

const SNOOZE_MS = 24 * 60 * 60 * 1000

export const CLAIM_DEV_LOOKBACK_DAYS = 7

/**
 * Refused break-glass dev-code attempts (attack indicator) for the Needs You
 * card (v2.2492): the query + snooze/dismiss state extracted from
 * DashboardClaimDevAttemptsBanner. Dev-only RLS on claim_dev_attempts means
 * non-devs count zero rows, so no role logic here. We alert on REFUSED
 * attempts, not granted ones — a granted break-glass means no usable dev
 * existed, so there is nobody left to alert.
 */
export function useClaimDevAttemptsNudge(userId: string | undefined): {
  /** Refused attempts in the lookback window, or null when hidden (loading, error, snoozed, dismissed, zero). */
  visibleCount: number | null
  snooze24h: () => void
  dismissUntilItHappensAgain: () => void
} {
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [dismissState, setDismissState] = useState<ClaimDevAlertDismissState>({})

  const load = useCallback(async () => {
    if (!userId) {
      setCount(null)
      return
    }
    setLoading(true)
    try {
      const since = new Date(Date.now() - CLAIM_DEV_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { count: n, error } = await supabase
        .from('claim_dev_attempts')
        .select('id', { count: 'exact', head: true })
        .like('outcome', 'refused%')
        .gte('attempted_at', since)
      // Never break the dashboard over an alarm; a failed poll (or a not-yet-pushed migration) shows nothing.
      setCount(error ? null : (n ?? 0))
    } catch {
      setCount(null)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!userId) return
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [userId, load])

  useEffect(() => {
    if (!userId) {
      setDismissState({})
      return
    }
    setDismissState(loadClaimDevAlertDismissState(userId))
  }, [userId])

  const persist = (next: ClaimDevAlertDismissState) => {
    if (!userId) return
    saveClaimDevAlertDismissState(userId, next)
    setDismissState(next)
  }

  const visible = Boolean(userId) && !loading && shouldShowClaimDevAlert(count, dismissState)

  return {
    visibleCount: visible ? count : null,
    snooze24h: () => persist({ ...dismissState, snoozeUntil: Date.now() + SNOOZE_MS }),
    dismissUntilItHappensAgain: () => persist({ ...dismissState, dismissedCount: count ?? 0 }),
  }
}
