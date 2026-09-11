import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { JobBudgetFooting } from '../lib/jobs/jobSummaryBurn'

/**
 * The budget footing of many jobs at once (Burn against the bid, PR 3 —
 * v2.3300): one `job_budgets` read for the listed ids (chunked under the
 * PostgREST row cap), as job id → { usd, source }. Job Summary's rows and the
 * Pipeline burn card read it so every Burn figure names what it stands on;
 * a job with no row is on the assumption. Fail-soft: an error yields an
 * empty map, which reads as "everything assumed" — never a crash.
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
        const { data, error } = await supabase.from('job_budgets').select('job_id, kind, total_direct_usd').in('job_id', ids.slice(i, i + CHUNK))
        if (error || cancelled) break
        for (const r of (data ?? []) as Array<{ job_id: string; kind: string; total_direct_usd: number | string | null }>) {
          const usd = Number(r.total_direct_usd) || 0
          if ((r.kind === 'bid' || r.kind === 'typed') && usd > 0) next.set(r.job_id, { usd, source: r.kind })
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
