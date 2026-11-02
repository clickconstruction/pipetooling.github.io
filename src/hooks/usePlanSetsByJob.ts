import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PlanSetRow } from '../lib/plans/planSets'
import type { JobPlanSetsEntry } from '../lib/plans/jobPlanSetsIcon'

/**
 * The plan sets behind the Pipeline's rows (punch list #239, PR 6): one chunked read of `plan_parts` and
 * `plan_sets` for every job on the page that names a part, never one per row, as the Bid Board's sets ride in
 * (`useBidPlanSetsByBid`). Fail-soft: a job whose read fails keeps its old plans link. `gen` re-runs the read.
 */
export function usePlanSetsByJob(jobs: ReadonlyArray<{ id: string; plan_part_id?: string | null }>, enabled: boolean, gen = 0): ReadonlyMap<string, JobPlanSetsEntry> {
  const key = useMemo(() => (enabled ? jobs.filter((j) => j.plan_part_id).map((j) => `${j.id}:${j.plan_part_id}`).sort().join(',') : ''), [jobs, enabled])
  const [map, setMap] = useState<ReadonlyMap<string, JobPlanSetsEntry>>(() => new Map())

  useEffect(() => {
    if (!key) {
      setMap(new Map())
      return
    }
    let cancelled = false
    void (async () => {
      const pairs = key.split(',').map((k) => k.split(':') as [string, string])
      const partIds = [...new Set(pairs.map(([, p]) => p))]
      const current = new Map<string, string | null>()
      const sets = new Map<string, PlanSetRow[]>()
      try {
        for (let i = 0; i < partIds.length; i += 200) {
          const slice = partIds.slice(i, i + 200)
          const [p, s] = await Promise.all([supabase.from('plan_parts').select('id, current_set_id').in('id', slice), supabase.from('plan_sets').select('*').in('part_id', slice)])
          if (p.error) throw p.error
          if (s.error) throw s.error
          for (const r of p.data ?? []) current.set(r.id, r.current_set_id)
          for (const r of (s.data ?? []) as PlanSetRow[]) sets.set(r.part_id, [...(sets.get(r.part_id) ?? []), r])
        }
      } catch {
        /* the sets are a courtesy — the row's old plans link still draws */
      }
      if (cancelled) return
      const next = new Map<string, JobPlanSetsEntry>()
      for (const [jobId, partId] of pairs) {
        if (!current.has(partId)) continue
        next.set(jobId, { partId, currentSetId: current.get(partId) ?? null, sets: sets.get(partId) ?? [] })
      }
      setMap(next)
    })()
    return () => {
      cancelled = true
    }
  }, [key, gen])

  return map
}
