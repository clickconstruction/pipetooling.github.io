import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

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
          withSupabaseRetry(
            async () =>
              supabase.from('jobs_ledger').select('id, revenue, payments_made').eq('status', 'billed'),
            'useBilledTotal jobs',
          ),
          withSupabaseRetry(
            async () =>
              supabase.from('jobs_ledger_invoices').select('id, job_id, amount').eq('status', 'billed'),
            'useBilledTotal invoices',
          ),
        ])
        if (cancelled) return
        const jobs = (jobsRes ?? []) as Array<{ id: string; revenue: number | null; payments_made: number | null }>
        const invoices = (invoicesRes ?? []) as Array<{ id: string; job_id: string; amount: number | null }>
        const invoiceIds = invoices.map((i) => i.id)
        let paymentsRows: Array<{ invoice_id: string | null; amount: number | null }> = []
        if (invoiceIds.length > 0) {
          paymentsRows =
            (await withSupabaseRetry(
              async () =>
                supabase.from('jobs_ledger_payments').select('invoice_id, amount').in('invoice_id', invoiceIds),
              'useBilledTotal payments',
            )) ?? []
        }
        const appliedByInvoice = new Map<string, number>()
        for (const p of paymentsRows) {
          if (!p.invoice_id) continue
          appliedByInvoice.set(
            p.invoice_id,
            (appliedByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0),
          )
        }
        const jobIdsWithBilledInvoice = new Set(invoices.map((i) => i.job_id))
        let sum = 0
        let n = 0
        for (const inv of invoices) {
          const applied = appliedByInvoice.get(inv.id) ?? 0
          sum += Math.max(0, Number(inv.amount ?? 0) - applied)
          n += 1
        }
        for (const j of jobs) {
          if (jobIdsWithBilledInvoice.has(j.id)) continue
          sum += Math.max(0, Number(j.revenue ?? 0) - Number(j.payments_made ?? 0))
          n += 1
        }
        if (!cancelled) {
          setCount(n)
          setTotal(sum)
        }
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
