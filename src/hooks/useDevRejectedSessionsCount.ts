import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getDefaultWeekRange } from '../utils/dateUtils'
import { withSupabaseRetry } from '../utils/errorHandling'

/**
 * Org-wide rejected clock sessions count for the current calendar week (dev dashboard).
 * Refetches on refreshKey bumps, window focus, and Realtime clock_sessions changes.
 */
export function useDevRejectedSessionsCount(enabled: boolean): {
  count: number | null
  loading: boolean
} {
  const [refreshKey, setRefreshKey] = useState(0)
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const bump = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setCount(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setCount(null)

    void (async () => {
      try {
        const { start, end } = getDefaultWeekRange()
        const c = await withSupabaseRetry(
          async () => {
            const r = await supabase
              .from('clock_sessions')
              .select('id', { count: 'exact', head: true })
              .not('rejected_at', 'is', null)
              .gte('work_date', start)
              .lte('work_date', end)
            return { data: r.count ?? null, error: r.error }
          },
          'load dev rejected clock sessions count',
        )
        if (cancelled) return
        setCount(typeof c === 'number' ? c : null)
      } catch {
        if (!cancelled) setCount(null)
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

  useEffect(() => {
    if (!enabled) return
    const channel = supabase
      .channel('dashboard-dev-rejected-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clock_sessions' }, () => {
        bump()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled, bump])

  return { count, loading }
}
