import { supabase } from './supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

/** Matches Calendar workflow chip step shape and PreviewJobModal display. */
export type PreviewJobModalStepLite = {
  id: string
  name: string
  project_id: string
  project_name: string
  scheduled_start_date: string | null
  started_at: string | null
  status: string
}

export type PreviewJobModalStageSummary = {
  projectName: string | null
  stages: PreviewJobModalStepLite[]
}

/**
 * Project display name + current user's assigned workflow steps on this project.
 * Matches Calendar `loadAssignedSteps`: `assigned_to_name` ↔ `public.users.name`.
 */
export async function fetchPreviewJobModalStageSummary(
  projectId: string,
  authUserId: string,
): Promise<{ data: PreviewJobModalStageSummary | null; error: string | null }> {
  try {
    const userRow = (await withSupabaseRetry(
      async () =>
        await supabase.from('users').select('name').eq('id', authUserId).maybeSingle(),
      'previewJobModalStages users name',
    )) as { name: string } | null
    const viewerName = userRow?.name?.trim() ?? ''

    const projRow = (await withSupabaseRetry(
      async () => await supabase.from('projects').select('name').eq('id', projectId).maybeSingle(),
      'previewJobModalStages projects',
    )) as { name: string } | null
    const projectName = projRow?.name?.trim() ?? null

    const wfRows = (await withSupabaseRetry(
      async () => await supabase.from('project_workflows').select('id').eq('project_id', projectId),
      'previewJobModalStages workflows',
    )) as { id: string }[] | null
    const workflowIds = [...new Set((wfRows ?? []).map((w) => w.id))]
    if (workflowIds.length === 0 || !viewerName) {
      return {
        data: { projectName, stages: [] },
        error: null,
      }
    }

    const stepRows = (await withSupabaseRetry(
      async () =>
        await supabase
          .from('project_workflow_steps')
          .select('id, name, workflow_id, scheduled_start_date, started_at, status')
          .in('workflow_id', workflowIds)
          .eq('assigned_to_name', viewerName),
      'previewJobModalStages steps',
    )) as {
      id: string
      name: string
      workflow_id: string
      scheduled_start_date: string | null
      started_at: string | null
      status: string
    }[] | null

    const pn = projectName ?? '—'
    const stages: PreviewJobModalStepLite[] = (stepRows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      project_id: projectId,
      project_name: pn,
      scheduled_start_date: row.scheduled_start_date,
      started_at: row.started_at,
      status: row.status,
    }))

    return { data: { projectName, stages }, error: null }
  } catch (e) {
    return { data: null, error: formatErrorMessage(e) }
  }
}
