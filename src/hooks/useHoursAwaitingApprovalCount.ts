import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useHoursAwaitingApprovalCount(
  enabled: boolean,
  refreshKey?: number
): {
  count: number | null
  loading: boolean
} {
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

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
        const { count: c, error } = await supabase
          .from('clock_sessions')
          .select('id', { count: 'exact', head: true })
          .not('clocked_out_at', 'is', null)
          .is('approved_at', null)
        if (cancelled) return
        if (error) {
          setCount(null)
          return
        }
        setCount(c ?? 0)
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

  return { count, loading }
}
