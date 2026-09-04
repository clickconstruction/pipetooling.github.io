import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  appliedByInvoiceIdFromPayments,
  buildLienUnconditionalQueue,
  computeLienUnconditionalOwed,
  liveLienReleases,
  type JobLienReleaseRow,
  type LienQueueJob,
  type LienQueuePayment,
  type LienUnconditionalQueueRow,
} from '../lib/jobs/lienReleaseTracking'

export type LienReleasesOwed = { count: number; total: number; jobIds: string[] }

/**
 * Cleared payments behind conditional lien releases (v2.2582): counts the
 * conditional releases whose money has landed but whose unconditional
 * follow-up hasn't been issued — the Needs You card's "issue the release"
 * nudge. Three small queries (live releases, payments on the covered bill
 * lines, then the owed jobs' identity); null while loading, 0 on error so
 * the card stays quiet.
 *
 * Also returns the queue the card's action opens (v2.2751): one row per owed
 * release with the job and the payment that cleared it — built from the same
 * rows as the count, so the two can't disagree. `refetch` re-runs the load
 * after a release is issued from the queue.
 */
export function useLienReleasesOwedNudge(enabled: boolean): {
  owed: LienReleasesOwed | null
  queue: LienUnconditionalQueueRow[]
  refetch: () => void
} {
  const [owed, setOwed] = useState<LienReleasesOwed | null>(null)
  const [queue, setQueue] = useState<LienUnconditionalQueueRow[]>([])
  const [loadKey, setLoadKey] = useState(0)

  const refetch = useCallback(() => setLoadKey((k) => k + 1), [])

  useEffect(() => {
    if (!enabled) {
      setOwed(null)
      setQueue([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data: releaseRows, error } = await supabase
          .from('job_lien_releases')
          .select('*')
          .is('voided_at', null)
        if (error) throw error
        if (cancelled) return
        const releases = liveLienReleases((releaseRows ?? []) as JobLienReleaseRow[])
        const invoiceIds = [...new Set(releases.flatMap((r) => r.invoice_ids ?? []))]
        let payments: LienQueuePayment[] = []
        if (invoiceIds.length > 0) {
          const { data: payRows, error: payError } = await supabase
            .from('jobs_ledger_payments')
            .select('id, invoice_id, amount, paid_on, payment_type, reference_number, created_at')
            .in('invoice_id', invoiceIds)
          if (payError) throw payError
          payments = (payRows ?? []) as LienQueuePayment[]
        }
        if (cancelled) return
        const next = computeLienUnconditionalOwed(releases, appliedByInvoiceIdFromPayments(payments))
        const jobsById = new Map<string, LienQueueJob>()
        if (next.jobIds.length > 0) {
          const { data: jobRows, error: jobError } = await supabase
            .from('jobs_ledger')
            .select('id, hcp_number, click_number, job_name, customer_name, job_address')
            .in('id', next.jobIds)
          if (jobError) throw jobError
          for (const j of (jobRows ?? []) as LienQueueJob[]) jobsById.set(j.id, j)
        }
        if (cancelled) return
        setOwed(next)
        setQueue(buildLienUnconditionalQueue(releases, payments, jobsById))
      } catch {
        if (!cancelled) {
          setOwed({ count: 0, total: 0, jobIds: [] })
          setQueue([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, loadKey])

  return { owed, queue, refetch }
}
