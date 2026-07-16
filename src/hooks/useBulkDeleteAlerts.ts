import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

export type BulkDeleteAlert = {
  actor_id: string
  actor_name: string
  bundles: number
  row_count: number
  window_start: string
  window_end: string
  tables: string[]
}

/**
 * Bursts of deletions detected in deleted_records_archive (dev dashboard notice).
 *
 * All of the detection — thresholds, the window, excluding your own deletions, and the dev gate — lives
 * in list_bulk_deletion_alerts() so the notice and the numbers behind it can never disagree. A non-dev
 * gets zero rows from the RPC itself, so this hook needs no role logic of its own.
 *
 * Refetches on window focus, like the neighbouring dashboard notices. No Realtime: a deletion burst is
 * not something you need sub-second latency on, and subscribing to the whole archive would be costly.
 */
export function useBulkDeleteAlerts(enabled: boolean): {
  alerts: BulkDeleteAlert[]
  loading: boolean
} {
  const [refreshKey, setRefreshKey] = useState(0)
  const [alerts, setAlerts] = useState<BulkDeleteAlert[]>([])
  const [loading, setLoading] = useState(false)

  const bump = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setAlerts([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () => supabase.rpc('list_bulk_deletion_alerts'),
          'load bulk deletion alerts',
        )
        if (cancelled) return
        setAlerts((data ?? []) as BulkDeleteAlert[])
      } catch {
        // Never break the dashboard over a heuristic alarm; a failed poll just shows nothing this round.
        if (!cancelled) setAlerts([])
      } finally {
        if (!cancelled) setLoading(false)
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

  return { alerts, loading }
}
