import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useBilledTotal(
  enabled: boolean,
  refreshKey?: number
): { count: number | null; total: number | null; loading: boolean } {
  const [count, setCount] = useState<number | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setCount(null)
      setTotal(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setCount(null)
    setTotal(null)

    void (async () => {
      try {
        const [jobsRes, invoicesRes] = await Promise.all([
          supabase.from('jobs_ledger').select('revenue, payments_made').eq('status', 'billed'),
          supabase.from('jobs_ledger_invoices').select('amount').eq('status', 'billed'),
        ])
        if (cancelled) return
        const jobs = (jobsRes.data ?? []) as Array<{ revenue: number | null; payments_made: number | null }>
        const invoices = (invoicesRes.data ?? []) as Array<{ amount: number }>
        const jobsTotal = jobs.reduce(
          (s, j) => s + (Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)),
          0
        )
        const invoicesTotal = invoices.reduce((s, i) => s + Number(i.amount ?? 0), 0)
        setCount(jobs.length + invoices.length)
        setTotal(jobsTotal + invoicesTotal)
      } catch {
        if (!cancelled) {
          setCount(null)
          setTotal(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, refreshKey])

  return { count, total, loading }
}
