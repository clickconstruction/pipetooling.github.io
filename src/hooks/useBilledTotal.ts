import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { computeBillTruth, type BillTruthInvoice, type BillTruthJob, type BillTruthPayment } from '../lib/billing/billTruth'
import { LEAN_STATS_ACTIVE_JOB_STATUSES } from '../lib/jobs/fetchStagesHeaderStats'
import { legacyBilledPinTotal, reportBillTruthShadow } from '../lib/billing/billTruthShadow'

// Intentionally ALL billed jobs, including those flagged into Collections — this total means
// "billed and unpaid" = the bill-truth kernel's Owed (billed + collections), the same figure the
// Pipeline strip, the AR card (ar + Collections) and Quickfill read. Bills on paid or deleted jobs
// are excluded by the kernel (they used to pad this pin).
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
              supabase
                .from('jobs_ledger')
                .select('id, status, revenue, payments_made, collections_at')
                // the spine's cohort — a billed invoice on a working/waiting job is owed too
                .or(`status.in.(${LEAN_STATS_ACTIVE_JOB_STATUSES.join(',')}),status.is.null`),
            'useBilledTotal jobs',
          ),
          withSupabaseRetry(
            async () =>
              supabase.from('jobs_ledger_invoices').select('id, job_id, amount, status').eq('status', 'billed'),
            'useBilledTotal invoices',
          ),
        ])
        if (cancelled) return
        const jobs = (jobsRes ?? []) as unknown as BillTruthJob[]
        const invoices = (invoicesRes ?? []) as unknown as BillTruthInvoice[]
        const invoiceIds = invoices.map((i) => i.id)
        let paymentsRows: BillTruthPayment[] = []
        if (invoiceIds.length > 0) {
          paymentsRows =
            ((await withSupabaseRetry(
              async () =>
                supabase.from('jobs_ledger_payments').select('invoice_id, amount').in('invoice_id', invoiceIds),
              'useBilledTotal payments',
            )) ?? []) as BillTruthPayment[]
        }
        const truth = computeBillTruth({ jobs, invoices, payments: paymentsRows })
        // Shadow (one release): the old pin summed every billed invoice, orphans and paid-job bills included.
        reportBillTruthShadow({
          surface: 'dashboard-billed-pin',
          legacy: legacyBilledPinTotal(
            jobs.filter((j) => j.status === 'billed'),
            invoices,
            paymentsRows,
          ),
          kernel: truth.owed.total,
        })
        if (!cancelled) {
          setCount(truth.owed.count)
          setTotal(truth.owed.total)
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
