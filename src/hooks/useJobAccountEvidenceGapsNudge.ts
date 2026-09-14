import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

export type JobAccountEvidenceGaps = {
  /** Distinct jobs that bought at a house expecting a job account with none open / not needed on record. */
  jobs: number
  /** (job, house) pairs. */
  pairs: number
  /** Allocated invoice dollars on those pairs (last 180 days). */
  allocatedTotal: number
  /** The houses named, joined: "Ferguson, Moore Supply". */
  houseNames: string
}

/**
 * The evidence rule's count (v2.3430) for the Needs You card and the
 * Pipeline Fix-ups chip. Gating lives in count_job_account_evidence_gaps()
 * — a caller who can't work the queue gets the zero row. Null while
 * loading / disabled / zero (no card). Refetches on window focus.
 * Replaces v2.3161's useJobAccountFlagGapsNudge.
 */
export function useJobAccountEvidenceGapsNudge(enabled: boolean): { gaps: JobAccountEvidenceGaps | null; reload: () => void } {
  const [gaps, setGaps] = useState<JobAccountEvidenceGaps | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setGaps(null)
      return
    }
    try {
      const rows = await withSupabaseRetry(async () => await supabase.rpc('count_job_account_evidence_gaps'), 'count job account evidence gaps')
      const row = Array.isArray(rows) ? rows[0] : undefined
      const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) || 0 : 0)
      const next: JobAccountEvidenceGaps = {
        jobs: num(row?.jobs),
        pairs: num(row?.pairs),
        allocatedTotal: num(row?.allocated_total),
        houseNames: typeof row?.house_names === 'string' ? row.house_names : '',
      }
      setGaps(next.jobs > 0 ? next : null)
    } catch {
      setGaps(null)
    }
  }, [enabled])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])
  return { gaps, reload: () => void load() }
}
