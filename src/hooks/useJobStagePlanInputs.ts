/**
 * The Stage Plan's live inputs for one job (PR 2): its stage windows, the sub
 * orders on them, and those orders' sheets. Line items, invoices and payments
 * come from the Job form's own state; this hook fetches only what the form
 * doesn't already hold. Re-fetches when the job changes or `reload()` is
 * called. A failed read leaves the three lists empty — the plan still builds
 * from the line items (every row reads "not scheduled").
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { StagePlanOrder, StagePlanSheet, StagePlanWindow } from '../lib/jobs/stagePlan'

export type StagePlanFetched = { windows: StagePlanWindow[]; orders: StagePlanOrder[]; sheets: StagePlanSheet[] }
const EMPTY: StagePlanFetched = { windows: [], orders: [], sheets: [] }

export async function fetchStagePlanInputs(jobId: string): Promise<StagePlanFetched> {
  const [w, o, s] = await Promise.all([
    supabase
      .from('job_stage_windows')
      .select('id, fixture_id, window_start, window_end, asked_start, asked_end, asked_note, asked_at, answered_at, answer, answer_note')
      .eq('job_id', jobId),
    supabase.from('step_commitments').select('id, stage_window_id, status, picked_start, picked_end, labor_job_id, change_requested_at').eq('job_id', jobId),
    supabase.from('people_labor_jobs').select('id, stage, progress_pct, progress_at, stage_changed_at').eq('job_ledger_id', jobId),
  ])
  return {
    windows: (w.data ?? []) as StagePlanWindow[],
    orders: (o.data ?? []) as StagePlanOrder[],
    sheets: (s.data ?? []) as StagePlanSheet[],
  }
}

export function useJobStagePlanInputs(jobId: string | null): { inputs: StagePlanFetched; reload: () => void } {
  const [inputs, setInputs] = useState<StagePlanFetched>(EMPTY)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!jobId) {
      setInputs(EMPTY)
      return
    }
    let cancelled = false
    void fetchStagePlanInputs(jobId)
      .then((r) => {
        if (!cancelled) setInputs(r)
      })
      .catch(() => {
        if (!cancelled) setInputs(EMPTY)
      })
    return () => {
      cancelled = true
    }
  }, [jobId, tick])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { inputs, reload }
}
