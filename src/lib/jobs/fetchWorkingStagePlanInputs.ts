/**
 * The Stage Plan's fetched inputs for a set of Working jobs at once
 * (to-dos/stage-plan-residuals item 1, v2.3431): the jobs' stage windows, the
 * sub orders on those windows, and the orders' sheets — three paged,
 * id-chunked reads, the client-side twin of `loadGcStageInputs` in
 * supabase/functions/_shared/gcStages.ts. Line items, invoices and payments
 * ride the job rows already, so they are not fetched here. Read by the
 * Pipeline's `useWorkingStagePlanInputs` hook and (v2.3809) by
 * `fetchStagesHeaderStats`, so the header tile and the Capable list agree.
 */
import { supabase } from '../supabase'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { EMPTY_WORKING_STAGE_INPUTS, type WorkingStageInputs } from './capableToBillPlan'
import type { StagePlanOrder, StagePlanSheet, StagePlanWindow } from './stagePlan'

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
