/**
 * A workflow's projections, for the Workflow page: the list, the Add / Edit
 * window's fields, and the reads and writes behind them.
 *
 * The page calls this and hands the results to the Projections & Ledger
 * panel, the stage list (money markers, Money drawer, ledger rail) and the
 * page-level edit window — all three open the window, and two read the list.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import {
  nextProjectionSequence,
  projectionSaveProblem,
  projectionWriteFields,
  seedEditingProjection,
  type EditingProjection,
  type ProjectionPlacement,
} from '../lib/workflow/projectionEdit'

export type WorkflowProjection = Database['public']['Tables']['workflow_projections']['Row']
export type EditingWorkflowProjection = EditingProjection<WorkflowProjection>

export type UseWorkflowProjectionsArgs = {
  /** The loaded workflow's id, once the page has it. */
  workflowId: string | null | undefined
  projectId: string | undefined
  userRole: string | null
  /** The page's find-or-create for the project's workflow — the fallback when `workflowId` is not in hand yet. */
  ensureWorkflow: (projectId: string) => Promise<string | null>
  onError: (message: string) => void
}

export type WorkflowProjections = {
  projections: WorkflowProjection[]
  editingProjection: EditingWorkflowProjection | null
  setEditingProjection: (next: EditingWorkflowProjection | null) => void
  openEditProjection: (
    item: WorkflowProjection | null,
    seed?: { step_id?: string; placement?: ProjectionPlacement },
  ) => void
  saveProjection: (
    item: WorkflowProjection | null,
    stageName: string,
    memo: string,
    amount: string,
    anchor?: { step_id: string; placement: ProjectionPlacement },
  ) => Promise<void>
  deleteProjection: (itemId: string) => Promise<void>
}

/**
 * Projections are dev / master only: for anyone else nothing is read and the
 * list is empty. The first read waits 100 ms after the workflow and the role
 * are known, to spread the page's opening reads.
 */
export function useWorkflowProjections({
  workflowId: loadedWorkflowId,
  projectId,
  userRole,
  ensureWorkflow,
  onError,
}: UseWorkflowProjectionsArgs): WorkflowProjections {
  const [projections, setProjections] = useState<WorkflowProjection[]>([])
  const [editingProjection, setEditingProjection] = useState<EditingWorkflowProjection | null>(null)

  async function loadProjections(workflowId: string) {
    if (userRole !== 'dev' && userRole !== 'master_technician') return
    const { data: items, error } = await supabase
      .from('workflow_projections')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('sequence_order', { ascending: true })
    if (error) {
      onError(`Failed to load projections: ${error.message}`)
      return
    }
    if (items) {
      setProjections(items as WorkflowProjection[])
    }
  }

  // Load projections when workflow and userRole are available (staggered)
  useEffect(() => {
    if (loadedWorkflowId && (userRole === 'dev' || userRole === 'master_technician')) {
      const t = setTimeout(() => loadProjections(loadedWorkflowId), 100)
      return () => clearTimeout(t)
    } else {
      setProjections([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as on the page: re-run on the workflow or the role, not on every render's loader
  }, [loadedWorkflowId, userRole])

  // Ensure we have a workflow_id - fetch from DB if state isn't ready
  async function resolveWorkflowId(): Promise<string | null> {
    let workflowId: string | null = loadedWorkflowId ?? null
    if (!workflowId && projectId) {
      workflowId = await ensureWorkflow(projectId)
    }
    if (!workflowId) {
      onError('Workflow not found. Please refresh the page.')
      return null
    }
    return workflowId
  }

  async function saveProjection(
    item: WorkflowProjection | null,
    stageName: string,
    memo: string,
    amount: string,
    anchor?: { step_id: string; placement: ProjectionPlacement },
  ) {
    const workflowId = await resolveWorkflowId()
    if (!workflowId) return

    const problem = projectionSaveProblem(stageName, memo)
    if (problem) {
      onError(problem)
      return
    }

    const fields = projectionWriteFields(stageName, memo, amount, anchor)
    if (item) {
      // Update existing
      const { error } = await supabase.from('workflow_projections').update(fields).eq('id', item.id)
      if (error) {
        onError(`Failed to update projection: ${error.message}`)
        return
      }
    } else {
      // Create new
      const { error } = await supabase
        .from('workflow_projections')
        .insert({ workflow_id: workflowId, ...fields, sequence_order: nextProjectionSequence(projections) })
      if (error) {
        onError(`Failed to insert projection: ${error.message}`)
        return
      }
    }
    setEditingProjection(null)
    await loadProjections(workflowId)
  }

  /** The delete's own error is not checked — the re-read shows what is left. */
  async function deleteProjection(itemId: string) {
    const workflowId = await resolveWorkflowId()
    if (!workflowId) return
    await supabase.from('workflow_projections').delete().eq('id', itemId)
    await loadProjections(workflowId)
  }

  function openEditProjection(
    item: WorkflowProjection | null,
    seed?: { step_id?: string; placement?: ProjectionPlacement },
  ) {
    setEditingProjection(seedEditingProjection(item, seed))
  }

  return { projections, editingProjection, setEditingProjection, openEditProjection, saveProjection, deleteProjection }
}
