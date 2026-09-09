import { useEffect, useState } from 'react'
import { buildJobTeamLaborRow, pendingSessionHours, type JobTeamLaborRowModel } from '../lib/jobs/jobTeamLaborRow'
import { supabase } from '../lib/supabase'
import { fetchTeamLaborBreakdownForJob } from '../utils/teamLabor'

/**
 * Team labor for the Job window's cost block (v2.3178): the per-job breakdown
 * (crew days × pay config — the same math as the Cost Timeline's 👷 markers
 * and Job Summary's Labor column) plus the job's closed-but-unapproved session
 * hours, so the row can say how much of the figure still awaits a reviewer.
 *
 * Gate it with `showJobCostBreakdownTeamLabor(role)` at the call site — the
 * dollars derive from wages, which only dev / master / controller may see.
 * The pending-hours read degrades to 0 on any error (RLS or otherwise); the
 * breakdown failing marks `failed` and hides the row.
 */
export function useJobDetailTeamLabor(
  enabled: boolean,
  jobId: string | null,
  refreshKey = 0,
): { loading: boolean; row: JobTeamLaborRowModel | null; failed: boolean } {
  const [loading, setLoading] = useState(false)
  const [row, setRow] = useState<JobTeamLaborRowModel | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!enabled || !jobId) {
      setLoading(false)
      setRow(null)
      setFailed(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setFailed(false)

    void (async () => {
      try {
        const [breakdown, pendingRes] = await Promise.all([
          fetchTeamLaborBreakdownForJob(supabase, jobId),
          supabase
            .from('clock_sessions')
            .select('clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at')
            .eq('job_ledger_id', jobId)
            .is('approved_at', null)
            .is('rejected_at', null)
            .is('revoked_at', null)
            .not('clocked_out_at', 'is', null)
            .limit(500),
        ])
        if (cancelled) return
        const pending = pendingRes.error ? 0 : pendingSessionHours(pendingRes.data ?? [])
        setRow(buildJobTeamLaborRow(breakdown, pending))
      } catch {
        if (!cancelled) {
          setRow(null)
          setFailed(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, jobId, refreshKey])

  return { loading, row, failed }
}
