/**
 * The `job_budgets` row of many jobs at once (punch list #242, PR 3): the Projects board
 * resolves each card's labor hours and its source from the row (`resolveJobBudget`), where
 * `useJobBudgetFootings` keeps only the dollar footing. One chunked read; fail-soft, an error
 * yields an empty map and every card reads the lines' sum as assumed.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { JobBudgetRowLike } from '../lib/jobs/jobBudget'

const CHUNK = 200

export function useJobBudgetRows(jobIds: ReadonlyArray<string>, enabled: boolean): ReadonlyMap<string, JobBudgetRowLike> {
  const key = useMemo(() => (enabled ? [...new Set(jobIds)].sort().join(',') : ''), [jobIds, enabled])
  const [map, setMap] = useState<ReadonlyMap<string, JobBudgetRowLike>>(() => new Map())

  useEffect(() => {
    if (!key) {
      setMap(new Map())
      return
    }
    let cancelled = false
    const ids = key.split(',')
    void (async () => {
      const next = new Map<string, JobBudgetRowLike>()
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data, error } = await supabase
          .from('job_budgets')
          .select('job_id, kind, bid_id, labor_hours, labor_rate, labor_usd, materials_usd, subs_usd, other_usd, total_direct_usd, completeness, taken_at, taken_by, note')
          .in('job_id', ids.slice(i, i + CHUNK))
        if (error || cancelled) break
        for (const r of (data ?? []) as Array<JobBudgetRowLike & { job_id: string }>) next.set(r.job_id, r)
      }
      if (!cancelled) setMap(next)
    })()
    return () => {
      cancelled = true
    }
  }, [key])

  return map
}
