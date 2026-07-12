import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './useAuth'
import { useJobsListCache } from '../contexts/JobsListCacheContext'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import {
  buildQuickfillCompleteNoBillList,
  quickfillCompleteNoBillCandidates,
} from '../lib/quickfillCompleteNoBill'
import type { JobWithDetails } from '../types/jobWithDetails'

const ROLES = new Set<string>(['dev', 'master_technician', 'assistant'])

/** Quickfill "Complete, no Total Bill": non-paid jobs resolved 100% complete with no
 * `revenue` set. Jobs come from the shared list cache; the latest report % per candidate
 * comes from `list_latest_report_completion_pct` (same RPC as the Job Summary % column). */
export function useQuickfillCompleteNoBillJobs(minHcpNumber: number): {
  completeNoBillJobs: JobWithDetails[]
  loading: boolean
  jobsListBusy: boolean
  fetchEnabled: boolean
} {
  const { user: authUser, role } = useAuth()
  const { jobs, jobsListLoading, jobsListRefreshing, runFetchJobs } = useJobsListCache()
  const [reportPctByJobId, setReportPctByJobId] = useState<Map<string, number>>(() => new Map())
  const [pctFetchesInFlight, setPctFetchesInFlight] = useState(0)
  const requestedIdsRef = useRef<Set<string>>(new Set())

  const fetchEnabled = Boolean(authUser?.id && role && ROLES.has(role))

  useEffect(() => {
    if (!fetchEnabled) return
    void runFetchJobs(null)
  }, [fetchEnabled, runFetchJobs])

  const candidates = useMemo(
    () => (fetchEnabled ? quickfillCompleteNoBillCandidates(jobs, minHcpNumber) : []),
    [fetchEnabled, jobs, minHcpNumber],
  )

  useEffect(() => {
    if (!fetchEnabled) return
    const missing = candidates.map((j) => j.id).filter((id) => !requestedIdsRef.current.has(id))
    if (missing.length === 0) return
    for (const id of missing) requestedIdsRef.current.add(id)
    setPctFetchesInFlight((n) => n + 1)
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () => await supabase.rpc('list_latest_report_completion_pct', { p_job_ids: missing }),
          'quickfill complete-no-bill report pct',
        )
        const rows = (data ?? []) as Array<{ job_ledger_id: string; pct: number }>
        if (rows.length > 0) {
          setReportPctByJobId((prev) => {
            const next = new Map(prev)
            for (const r of rows) next.set(r.job_ledger_id, r.pct)
            return next
          })
        }
      } catch {
        // Fall back to pct_complete for these jobs; un-mark so a later render retries.
        for (const id of missing) requestedIdsRef.current.delete(id)
      } finally {
        setPctFetchesInFlight((n) => n - 1)
      }
    })()
  }, [fetchEnabled, candidates])

  const completeNoBillJobs = useMemo(
    () =>
      fetchEnabled ? buildQuickfillCompleteNoBillList(jobs, reportPctByJobId, minHcpNumber) : [],
    [fetchEnabled, jobs, reportPctByJobId, minHcpNumber],
  )

  const loading = fetchEnabled && (jobsListLoading || pctFetchesInFlight > 0)
  const jobsListBusy = jobsListLoading || jobsListRefreshing

  return { completeNoBillJobs, loading, jobsListBusy, fetchEnabled }
}
