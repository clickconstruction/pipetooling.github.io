import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function getDefaultWeekRange(): { start: string; end: string } {
  const d = new Date()
  const day = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return {
    start: start.toLocaleDateString('en-CA'),
    end: end.toLocaleDateString('en-CA'),
  }
}

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
        const { start, end } = getDefaultWeekRange()
        const { count: c, error } = await supabase
          .from('clock_sessions')
          .select('id', { count: 'exact', head: true })
          .is('approved_at', null)
          .is('rejected_at', null)
          .gte('work_date', start)
          .lte('work_date', end)
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
