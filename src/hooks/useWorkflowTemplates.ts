/**
 * The Workflow page's "Create from template" card, shown on a workflow with
 * no steps: the templates to pick from, the pick, and the create — one step
 * per template step, in the template's order, then a re-read.
 *
 * The page calls this (not the stage list), so the templates are read on
 * mount, as before, and are in hand when an empty workflow first paints.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { WorkflowStepsEngine } from './useWorkflowStepsEngine'
import { NO_WORKFLOW_TO_SAVE_ON } from '../lib/workflow/workflowStart'

export function useWorkflowTemplates(engine: WorkflowStepsEngine) {
  const { workflow, setError, refreshSteps } = engine
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('workflow_templates').select('id, name').order('name')
      setTemplates((data as { id: string; name: string }[]) ?? [])
    })()
  }, [])

  async function createFromTemplate() {
    if (!selectedTemplateId) return
    // The card is drawn on a workflow with no steps, so there is always one in hand.
    const workflowId = workflow?.id ?? null
    if (!workflowId) {
      setError(NO_WORKFLOW_TO_SAVE_ON)
      return
    }
    setCreatingFromTemplate(true)
    setError(null)
    const { data: tSteps, error: tStepsErr } = await supabase
      .from('workflow_template_steps')
      .select('sequence_order, name')
      .eq('template_id', selectedTemplateId)
      .order('sequence_order', { ascending: true })
    if (tStepsErr) {
      setError(`Failed to load template steps: ${tStepsErr.message}`)
      setCreatingFromTemplate(false)
      return
    }
    if (tSteps && tSteps.length > 0) {
      let insertedCount = 0
      for (const t of tSteps as { sequence_order: number; name: string }[]) {
        const { data: inserted, error: insErr } = await supabase.from('project_workflow_steps').insert({
          workflow_id: workflowId,
          sequence_order: t.sequence_order,
          name: t.name,
          status: 'pending',
        }).select('id')
        if (insErr) {
          setError(`Failed to insert step "${t.name}": ${insErr.message}`)
          setCreatingFromTemplate(false)
          return
        }
        if (inserted && inserted.length > 0) {
          insertedCount++
        }
      }
      console.log(`Created ${insertedCount} steps from template`)
    }
    setCreatingFromTemplate(false)
    const refreshErr = await refreshSteps()
    if (refreshErr) {
      setError(`Steps created but failed to refresh: ${refreshErr}`)
    }
  }

  return { templates, selectedTemplateId, setSelectedTemplateId, creatingFromTemplate, createFromTemplate }
}

export type WorkflowTemplates = ReturnType<typeof useWorkflowTemplates>
