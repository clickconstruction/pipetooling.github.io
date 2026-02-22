import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useSupplyHousesAPTotal(enabled: boolean, refreshKey?: number): { total: number | null; loading: boolean } {
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setTotal(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setTotal(null)

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('supply_house_invoices')
          .select('amount')
          .eq('is_paid', false)
        if (cancelled) return
        if (error) {
          setTotal(null)
          return
        }
        const sum = (data ?? []).reduce((s, r) => s + Number((r as { amount: number }).amount ?? 0), 0)
        setTotal(sum)
      } catch {
        if (!cancelled) setTotal(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, refreshKey])

  return { total, loading }
}
