import { sumOpenSupplyBills } from '../lib/materials/supplyHousePhone'
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
          .select('amount, amount_paid')
          .eq('is_paid', false)
        if (cancelled) return
        if (error) {
          setTotal(null)
          return
        }
        // What is left on each unpaid bill: a bill paid in part counts for the rest, not for its whole amount.
        const sum = sumOpenSupplyBills(data ?? [])
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
