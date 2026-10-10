import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { todayYmdInAppTz } from '../utils/dateUtils'
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
import { zzTestJobIds } from '../lib/jobs/zzTestJobVisibility'

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
/**
 * `hideZzTestJobs` (punch list #61, PR 3): a release on a ZZ test job leaves the count, the dollars and the
 * queue, by the owed jobs' own names once they are read.
 */
export function useLienReleasesOwedNudge(enabled: boolean, hideZzTestJobs = false): {
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
        const todayYmd = todayYmdInAppTz()
        let next = computeLienUnconditionalOwed(releases, appliedByInvoiceIdFromPayments(payments), { payments, todayYmd })
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
        // Only an owed job can count, so the owed jobs' names are enough to find the ZZ ones.
        const zzJobIds = hideZzTestJobs ? zzTestJobIds([...jobsById.values()]) : null
        const shownReleases = zzJobIds && zzJobIds.size > 0 ? releases.filter((r) => !zzJobIds.has(r.job_id)) : releases
        if (shownReleases !== releases) {
          next = computeLienUnconditionalOwed(shownReleases, appliedByInvoiceIdFromPayments(payments), { payments, todayYmd })
        }
        setOwed(next)
        setQueue(buildLienUnconditionalQueue(shownReleases, payments, jobsById, todayYmd))
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
  }, [enabled, hideZzTestJobs, loadKey])

  return { owed, queue, refetch }
}
