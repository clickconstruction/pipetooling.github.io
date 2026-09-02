import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { assessLienWatch, type JobLienFilingRow, type LienWatchJob, type LienWatchResult } from '../lib/jobs/lienDeadlines'

/**
 * The Chapter 53 deadline watches (v2.2645, phase 4): notice windows closing
 * on unpaid sub jobs, filing windows closing on noticed/original jobs, and
 * filed-but-unserved affidavits. Small queries; null while loading, empty on
 * error so the cards stay quiet. Open balance is job-level (revenue −
 * payments_made); property kind comes from the linked property record.
 */
export function useLienWatchNudge(enabled: boolean): { watch: LienWatchResult | null } {
  const [watch, setWatch] = useState<LienWatchResult | null>(null)

  useEffect(() => {
    if (!enabled) {
      setWatch(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())
        const [{ data: jobRows, error: jobErr }, { data: filingRows, error: filErr }] = await Promise.all([
          supabase
            .from('jobs_ledger')
            .select('id, gc_customer_id, last_work_date, revenue, payments_made, customer_address_id')
            .in('status', ['billed']),
          supabase.from('job_lien_filings').select('*').is('voided_at', null),
        ])
        if (jobErr) throw jobErr
        if (filErr) throw filErr
        if (cancelled) return
        const rawJobs = (jobRows ?? []) as {
          id: string
          gc_customer_id: string | null
          last_work_date: string | null
          revenue: number | null
          payments_made: number | null
          customer_address_id: string | null
        }[]
        const addressIds = [...new Set(rawJobs.map((j) => j.customer_address_id).filter((v): v is string => Boolean(v)))]
        const kindById = new Map<string, string>()
        if (addressIds.length > 0) {
          const { data: addrRows } = await supabase
            .from('customer_addresses')
            .select('id, property_kind')
            .in('id', addressIds)
          for (const r of (addrRows ?? []) as { id: string; property_kind: string }[]) {
            kindById.set(r.id, r.property_kind ?? '')
          }
        }
        if (cancelled) return
        const jobs: LienWatchJob[] = rawJobs.map((j) => ({
          id: j.id,
          isSub: Boolean(j.gc_customer_id),
          lastWorkYmd: j.last_work_date,
          openBalance: Math.max(0, Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)),
          propertyKind: j.customer_address_id ? kindById.get(j.customer_address_id) ?? '' : '',
        }))
        setWatch(assessLienWatch(jobs, (filingRows ?? []) as JobLienFilingRow[], todayYmd))
      } catch {
        if (!cancelled) setWatch({ noticeDue: [], filingDue: [], serveDue: [] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return { watch }
}
