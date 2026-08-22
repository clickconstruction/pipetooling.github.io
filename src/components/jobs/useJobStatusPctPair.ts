import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { JobStatusPct } from '../../lib/jobs/jobCombineNote'

export type JobStatusPctPair = { source: JobStatusPct; target: JobStatusPct }

/**
 * Status/% of a source/target job pair, for JobCombineStatusNotice (v2.2068).
 * The combine and migrate pickers hold search rows with no status/pct, so the
 * pair is fetched fresh whenever both sides are picked. Pass nulls to idle.
 */
export function useJobStatusPctPair(sourceId: string | null, targetId: string | null) {
  const [pair, setPair] = useState<JobStatusPctPair | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sourceId || !targetId || sourceId === targetId) {
      setPair(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setPair(null)
    void (async () => {
      try {
        const raw = await withSupabaseRetry(
          async () => supabase.from('jobs_ledger').select('id, status, pct_complete').in('id', [sourceId, targetId]),
          'combine status pct pair',
        )
        if (cancelled) return
        const rows = (raw ?? []) as { id: string; status: string | null; pct_complete: number | null }[]
        const byId = new Map(rows.map((r) => [r.id, { status: r.status, pctComplete: r.pct_complete }]))
        const source = byId.get(sourceId)
        const target = byId.get(targetId)
        setPair(source && target ? { source, target } : null)
      } catch {
        if (!cancelled) setPair(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sourceId, targetId])

  return { pair, loading }
}
