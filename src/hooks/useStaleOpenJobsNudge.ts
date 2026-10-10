/**
 * Open jobs sitting idle (v2.2825) — the Needs You watch behind the Job
 * Summary Cycle view's stale-open list. One small scan of started jobs
 * (working / ready to bill) folded by the pure `staleOpenJobs` kernel; null
 * while loading, zero on error so the card stays quiet. Refreshes when a
 * clock session or job status changes.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { staleOpenJobs, type StaleOpenJobInput } from '../lib/jobs/jobSummaryCycle'
import { denverCalendarDayKey } from '../utils/dateUtils'
import { loadZzTestJobIds } from '../lib/jobs/zzTestJobRows'
import { withoutZzTestJobRows } from '../lib/jobs/zzTestJobVisibility'

export type StaleOpenNudge = { count: number; total: number; mine: number; minIdleDays: number }

export const STALE_OPEN_NUDGE_MIN_IDLE_DAYS = 21

/**
 * `hideZzTestJobs` (punch list #61, v2.5122): ZZ test jobs leave the count and the contract dollars, by name
 * and the shared ids; a failed id read zeroes the card like any other failed read.
 */
export function useStaleOpenJobsNudge(
  enabled: boolean,
  userId: string | null | undefined,
  hideZzTestJobs = false,
): { nudge: StaleOpenNudge | null } {
  const [nudge, setNudge] = useState<StaleOpenNudge | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setNudge(null)
      return
    }
    try {
      const { data, error } = await supabase
        .from('jobs_ledger')
        .select('id, hcp_number, click_number, job_name, customer_name, status, last_work_date, created_at, revenue, master_user_id')
        .not('status', 'in', '(billed,paid)')
      if (error) throw error
      const read = (data ?? []) as Array<StaleOpenJobInput & { customer_name?: string | null }>
      const rows = hideZzTestJobs ? withoutZzTestJobRows(read, (j) => j.id, await loadZzTestJobIds(userId)) : read
      const stale = staleOpenJobs(rows, denverCalendarDayKey(Date.now()), STALE_OPEN_NUDGE_MIN_IDLE_DAYS, null)
      setNudge({
        count: stale.length,
        total: stale.reduce((a, s) => a + s.contractUsd, 0),
        mine: userId ? stale.filter((s) => s.masterUserId === userId).length : 0,
        minIdleDays: STALE_OPEN_NUDGE_MIN_IDLE_DAYS,
      })
    } catch {
      setNudge({ count: 0, total: 0, mine: 0, minIdleDays: STALE_OPEN_NUDGE_MIN_IDLE_DAYS })
    }
  }, [enabled, userId, hideZzTestJobs])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onChanged = () => void load()
    window.addEventListener('job-status-changed', onChanged)
    window.addEventListener('clock-session-changed', onChanged)
    return () => {
      window.removeEventListener('job-status-changed', onChanged)
      window.removeEventListener('clock-session-changed', onChanged)
    }
  }, [load])
  return { nudge }
}
