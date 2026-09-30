import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseBulkHoursAlertRow, type BulkHoursAlert } from '../lib/clock/bulkHoursAlert'
import { withSupabaseRetry } from '../utils/errorHandling'

/**
 * Bursts of typed hours (v2.4281) — the sibling of useBulkDeleteAlerts. All of the detection
 * (thresholds, the window, excluding your own typing, who may see it) lives in
 * list_bulk_hours_alerts(), so the card and the numbers behind it can never disagree; anyone
 * outside the approving roles gets zero rows from the RPC itself. Refetches on window focus.
 */
export function useBulkHoursAlerts(enabled: boolean): { alerts: BulkHoursAlert[]; loading: boolean } {
  const [refreshKey, setRefreshKey] = useState(0)
  const [alerts, setAlerts] = useState<BulkHoursAlert[]>([])
  const [loading, setLoading] = useState(false)

  const bump = useCallback(() => setRefreshKey((k) => k + 1), [])

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
        // The RPC lands in src/types/database.ts with the regen that follows the push; until then the name is a string.
        const rpc = supabase.rpc as unknown as (fn: string) => ReturnType<typeof supabase.rpc<'list_bulk_deletion_alerts'>>
        const data = await withSupabaseRetry(async () => rpc('list_bulk_hours_alerts'), 'load bulk hours alerts')
        if (cancelled) return
        const rows = Array.isArray(data) ? data : []
        setAlerts(rows.map(parseBulkHoursAlertRow).filter((a): a is BulkHoursAlert => a != null))
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
