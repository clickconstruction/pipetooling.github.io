import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useForecastWorkMonths } from './useForecastWorkMonths'
import { buildLienTimelineFromWindow } from '../lib/jobs/lienTimelineDesk'
import type { LienTimeline } from '../lib/jobs/lienTimeline'
import type { JobLienFilingRow } from '../lib/jobs/lienDeadlines'
import type { JobDemandLetterRow } from '../lib/jobs/demandLetterTracking'
import { jobOpenBalance } from '../lib/jobs/jobHistoryLienTimeline'
import { todayYmdInAppTz } from '../utils/dateUtils'

/**
 * One job's lien timeline for a surface that is not the Lien window (v2.3879, punch list
 * #32 PR 3 — the job window's History tab): the same reads the window makes for its header —
 * the job's filings, its demand letters, the property kind off the linked address, and the
 * work months from the approved sessions — through the same adapter, so the two strips
 * never disagree. Null until the reads land; `hasPaper` says whether anything is out.
 */
export function useJobLienTimeline(
  job: { id: string; gc_customer_id: string | null; customer_address_id: string | null; created_at: string | null; last_work_date: string | null; lien_contract_ended_on?: string | null; revenue?: number | null; payments_made?: number | null } | null,
  enabled: boolean,
): { timeline: LienTimeline | null; hasPaper: boolean; loading: boolean } {
  const [filings, setFilings] = useState<JobLienFilingRow[] | null>(null)
  const [letters, setLetters] = useState<JobDemandLetterRow[] | null>(null)
  const [propertyKind, setPropertyKind] = useState<string | null>(null)
  const jobId = enabled ? job?.id ?? null : null
  const addressId = enabled ? job?.customer_address_id ?? null : null

  useEffect(() => {
    if (!jobId) {
      setFilings(null)
      setLetters(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [{ data: f }, { data: l }] = await Promise.all([
          supabase.from('job_lien_filings').select('*').eq('job_id', jobId).is('voided_at', null),
          supabase.from('job_demand_letters').select('*').eq('job_id', jobId).is('voided_at', null),
        ])
        if (cancelled) return
        setFilings((f ?? []) as JobLienFilingRow[])
        setLetters((l ?? []) as JobDemandLetterRow[])
      } catch {
        if (!cancelled) {
          setFilings([])
          setLetters([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [jobId])

  useEffect(() => {
    if (!jobId) return
    if (!addressId) {
      setPropertyKind('')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase.from('customer_addresses').select('property_kind').eq('id', addressId).maybeSingle()
        if (!cancelled) setPropertyKind(((data as { property_kind?: string | null } | null)?.property_kind ?? '').trim())
      } catch {
        if (!cancelled) setPropertyKind('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [jobId, addressId])

  const todayYmd = todayYmdInAppTz()
  const forecastJobs = useMemo(() => (job && enabled ? [{ id: job.id, gc_customer_id: job.gc_customer_id ?? null, customer_address_id: job.customer_address_id ?? null }] : null), [job, enabled])
  const { byJob, loading: monthsLoading } = useForecastWorkMonths(forecastJobs, todayYmd)

  const timeline = useMemo(() => {
    if (!job || !enabled || filings == null || letters == null || propertyKind == null || monthsLoading) return null
    return buildLienTimelineFromWindow({
      workMonths: byJob?.[job.id] ?? null,
      filings,
      job: { id: job.id, created_at: job.created_at ?? null, last_work_date: job.last_work_date ?? null, lien_contract_ended_on: job.lien_contract_ended_on ?? null },
      isSub: Boolean(job.gc_customer_id),
      propertyKind,
      openBalance: jobOpenBalance(job),
      todayYmd,
      demandLetters: letters,
    })
  }, [job, enabled, filings, letters, propertyKind, byJob, monthsLoading, todayYmd])

  return { timeline, hasPaper: Boolean(filings?.length || letters?.length), loading: timeline == null && Boolean(jobId) }
}
