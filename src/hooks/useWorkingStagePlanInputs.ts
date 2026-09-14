/**
 * The Stage Plan's fetched inputs for every Working job on the Pipeline at
 * once (to-dos/stage-plan-residuals item 1): the jobs' stage windows, the sub
 * orders on those windows, and the orders' sheets — three paged, id-chunked
 * reads, the client-side twin of `loadGcStageInputs` in
 * supabase/functions/_shared/gcStages.ts. Line items, invoices and payments
 * ride the board rows already, so they are not fetched here.
 *
 * Returns null until the first fetch lands (the header keeps its formula
 * figure meanwhile) and after a failed read; re-fetches when the set of job
 * ids changes, keeping the last result on screen while the new one is out.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRowsChunkedIn } from '../lib/supabasePaging'
import { EMPTY_WORKING_STAGE_INPUTS, type WorkingStageInputs } from '../lib/jobs/capableToBillPlan'
import type { StagePlanOrder, StagePlanSheet, StagePlanWindow } from '../lib/jobs/stagePlan'

const WINDOW_COLS = 'id, job_id, fixture_id, window_start, window_end, asked_start, asked_end, asked_note, asked_at, answered_at, answer, answer_note'
const ORDER_COLS = 'id, stage_window_id, status, picked_start, picked_end, labor_job_id, change_requested_at'
const SHEET_COLS = 'id, stage, progress_pct, progress_at, stage_changed_at'

export async function fetchWorkingStagePlanInputs(jobIds: readonly string[]): Promise<WorkingStageInputs> {
  const ids = [...new Set(jobIds)]
  if (ids.length === 0) return EMPTY_WORKING_STAGE_INPUTS
  const windows = await fetchAllRowsChunkedIn<StagePlanWindow & { job_id: string }, string>(
    ids,
    (chunk, from, to) => supabase.from('job_stage_windows').select(WINDOW_COLS).in('job_id', chunk).order('id').range(from, to),
    'workingStagePlan.windows',
  )
  const windowIds = windows.map((w) => w.id)
  const orders =
    windowIds.length > 0
      ? await fetchAllRowsChunkedIn<StagePlanOrder, string>(
          windowIds,
          (chunk, from, to) => supabase.from('step_commitments').select(ORDER_COLS).in('stage_window_id', chunk).order('id').range(from, to),
          'workingStagePlan.orders',
        )
      : []
  const sheetIds = [...new Set(orders.map((o) => o.labor_job_id).filter((id): id is string => !!id))]
  const sheets =
    sheetIds.length > 0
      ? await fetchAllRowsChunkedIn<StagePlanSheet, string>(
          sheetIds,
          (chunk, from, to) => supabase.from('people_labor_jobs').select(SHEET_COLS).in('id', chunk).order('id').range(from, to),
          'workingStagePlan.sheets',
        )
      : []
  return { windows, orders, sheets }
}

/**
 * `enabled` false (the Working scope isn't loaded — the rows carry no line
 * items anyway) hands back null without a read.
 */
export function useWorkingStagePlanInputs(jobIds: readonly string[], enabled: boolean): WorkingStageInputs | null {
  const key = enabled ? [...new Set(jobIds)].sort().join(',') : null
  const [inputs, setInputs] = useState<WorkingStageInputs | null>(null)
  useEffect(() => {
    if (key == null) {
      setInputs(null)
      return
    }
    let cancelled = false
    void fetchWorkingStagePlanInputs(key === '' ? [] : key.split(','))
      .then((r) => {
        if (!cancelled) setInputs(r)
      })
      .catch((err: unknown) => {
        console.warn('[useWorkingStagePlanInputs] stage inputs unavailable — the header keeps its formula figure', err)
        if (!cancelled) setInputs(null)
      })
    return () => {
      cancelled = true
    }
  }, [key])
  return inputs
}
