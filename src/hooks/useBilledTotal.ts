import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { computeBillTruth, type BillTruthInvoice, type BillTruthJob, type BillTruthPayment } from '../lib/billing/billTruth'
import { LEAN_STATS_ACTIVE_JOB_STATUSES } from '../lib/jobs/fetchStagesHeaderStats'
import { loadUnlinkedMoney } from '../lib/billing/loadUnlinkedMoney'

// Intentionally ALL billed jobs, including those flagged into Collections — this total means
// "billed and unpaid" = the bill-truth kernel's Owed (billed + collections), the same figure the
// Pipeline strip, the AR card (ar + Collections) and Quickfill read. Bills on paid or deleted jobs
// are excluded by the kernel (they used to pad this pin). A job the office gave up on (Uncollectible)
// leaves Owed in the kernel, which needs `uncollectible_at` to see it.
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
                .select('id, status, revenue, payments_made, collections_at, uncollectible_at')
                // the spine's cohort — a billed invoice on a working/waiting job is owed too
                .or(`status.in.(${LEAN_STATS_ACTIVE_JOB_STATUSES.join(',')}),status.is.null`),
            'useBilledTotal jobs',
          ),
          withSupabaseRetry(
            async () =>
              supabase.from('jobs_ledger_invoices').select('id, job_id, amount, status, sequence_order, billed_at').eq('status', 'billed'),
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
        // v2.5010: a payment put on the job with no bill picked pays its bills oldest first (the owner's call of 2026-10-09).
        const extra = await loadUnlinkedMoney<BillTruthPayment & { job_id: string }, BillTruthInvoice>(
          invoices.map((i) => i.job_id),
          { paymentColumns: 'job_id, invoice_id, amount, paid_on, sequence_order', invoiceColumns: 'id, job_id, amount, status, sequence_order, billed_at', label: 'useBilledTotal', withPaidBillPayments: true },
        )
        if (cancelled) return
        const truth = computeBillTruth({
          jobs,
          invoices: [...invoices, ...extra.paidBills],
          payments: [...paymentsRows, ...extra.unlinkedPayments, ...extra.paidBillPayments],
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
