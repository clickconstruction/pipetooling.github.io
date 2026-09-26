import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { JobBudgetFooting } from '../lib/jobs/jobSummaryBurn'
import { jobBudgetFootingFromRow, type JobBudgetRowLike } from '../lib/jobs/jobBudget'

/**
 * The budget footing of many jobs at once (Burn against the bid, PR 3 —
 * v2.3300): one `job_budgets` read for the listed ids (chunked under the
 * PostgREST row cap), as job id → { usd, source }. Job Summary's rows and the
 * Pipeline burn card read it so every Burn figure names what it stands on;
 * a job with no row is on the assumption, and so is a job whose row cannot
 * stand for the whole job (`jobBudgetFootingFromRow`, v2.3847 — a snapshot
 * with no labor or no materials figure). Fail-soft: an error yields an empty
 * map, which reads as "everything assumed" — never a crash.
 */
const CHUNK = 200

export function useJobBudgetFootings(jobIds: ReadonlyArray<string>, enabled: boolean): ReadonlyMap<string, JobBudgetFooting> {
  const key = useMemo(() => (enabled ? [...new Set(jobIds)].sort().join(',') : ''), [jobIds, enabled])
  const [map, setMap] = useState<ReadonlyMap<string, JobBudgetFooting>>(() => new Map())

  useEffect(() => {
    if (!key) {
      setMap(new Map())
      return
    }
    let cancelled = false
    const ids = key.split(',')
    void (async () => {
      const next = new Map<string, JobBudgetFooting>()
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data, error } = await supabase.from('job_budgets').select('job_id, kind, labor_hours, labor_rate, labor_usd, materials_usd, subs_usd, other_usd, total_direct_usd, completeness').in('job_id', ids.slice(i, i + CHUNK))
        if (error || cancelled) break
        for (const r of (data ?? []) as Array<JobBudgetRowLike & { job_id: string }>) {
          const footing = jobBudgetFootingFromRow(r)
          if (footing) next.set(r.job_id, footing)
        }
      }
      if (!cancelled) setMap(next)
    })()
    return () => {
      cancelled = true
    }
  }, [key])

  return map
}
