/**
 * Projects → Forecast → Specific: fetch the full `project_workflow_steps` row for one stage.
 *
 * The list-level loader (`fetchForecastStages`) intentionally selects only the columns the
 * Gantt grid needs (slim payload, scoped to many workflows in one IN-clause). When the user
 * clicks a stage and we open the detail modal, we re-query Supabase for ALL columns so the
 * modal can show the same fields the Workflow page's stage card shows — including
 * `notes`, `private_notes`, `inspector_name`, `inspection_notes`, `rejection_reason`,
 * `skipped_reason`, `step_type`, and the actual `started_at` / `ended_at` timestamps —
 * without bloating the forecast list payload for every job/stage on screen.
 *
 * `sibling` (the row immediately after `sequence_order`, same `workflow_id`) is included
 * so the modal can offer the "Also push the next stage's expected start to this stage's
 * expected end" affordance, mirroring the Workflow page's `openExpectedDates` flow.
 *
 * Returns `null` when the row no longer exists or RLS denies access — callers should
 * surface a toast and close the modal in that case rather than render stale data.
 */

import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { Database } from '../types/database'

export type ForecastStageDetailRow = Database['public']['Tables']['project_workflow_steps']['Row']

export type ForecastStageDetail = {
  step: ForecastStageDetailRow
  /** The next stage in the same workflow (by `sequence_order` ascending), if any. Includes
   *  only the few fields the modal needs to display + chain the expected start. */
  nextStage: Pick<
    ForecastStageDetailRow,
    'id' | 'name' | 'sequence_order' | 'scheduled_start_date' | 'scheduled_end_date'
  > | null
}

/**
 * Load the full row for one `project_workflow_steps` id, plus the immediately-following
 * stage in the same workflow (if any). One round-trip for the step, a second IN-bound
 * query for siblings — the sibling query is gated on the step existing so we never make a
 * wasted call when the stage was deleted out from under the modal.
 */
export async function fetchForecastStageDetail(stageId: string): Promise<ForecastStageDetail | null> {
  if (!stageId) return null

  const stepData = (await withSupabaseRetry(
    async () => supabase.from('project_workflow_steps').select('*').eq('id', stageId).maybeSingle(),
    'fetch project_workflow_steps row for forecast stage detail',
  )) as unknown as ForecastStageDetailRow | null

  if (!stepData) return null

  // Pull every sibling row at `sequence_order > current` so we can pick the *immediately*
  // next one (smallest `sequence_order` strictly greater than the clicked stage's). Doing
  // it client-side keeps the SQL trivial and avoids a window function — the per-workflow
  // step count is small enough (~5-20) that this is essentially free.
  const siblingsData = (await withSupabaseRetry(
    async () =>
      supabase
        .from('project_workflow_steps')
        .select('id, name, sequence_order, scheduled_start_date, scheduled_end_date')
        .eq('workflow_id', stepData.workflow_id)
        .gt('sequence_order', stepData.sequence_order)
        .order('sequence_order', { ascending: true })
        .limit(1),
    'fetch next sibling project_workflow_steps row for forecast stage detail',
  )) as unknown as
    | Pick<
        ForecastStageDetailRow,
        'id' | 'name' | 'sequence_order' | 'scheduled_start_date' | 'scheduled_end_date'
      >[]
    | null

  return {
    step: stepData,
    nextStage: siblingsData && siblingsData.length > 0 ? siblingsData[0]! : null,
  }
}
