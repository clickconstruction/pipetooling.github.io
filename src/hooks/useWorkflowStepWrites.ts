/**
 * The Workflow page's step writes that belong to no window: start, complete,
 * approve and reopen (the lifecycle, planned by \`planStepTransition\`), the
 * percent-complete cell, the three notify tables, the two notes, delete, and
 * assign. Moved verbatim from the page and run against the steps engine.
 *
 * Two hand-offs back to the page: \`onApproved(step, nextStep)\` after an
 * approval has been written and re-read (the page folds the card and opens
 * the next), and the Assign picker closing itself before \`assignPerson\`
 * runs. The writes bound to a window's own state — Set Start, Send Back,
 * Skip, the Expected dates save and clear, the step form's save and copy,
 * create-from-template — stay with their windows.
 */
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { planStepTransition } from '../lib/workflow/stepLifecycle'
import { notifyAssignedDefaultsOnAssign } from '../lib/workflow/stepAssignment'
import { fromDatetimeLocal } from '../utils/datetimeLocal'
import type { WorkflowStepsEngine } from './useWorkflowStepsEngine'

type Step = Database['public']['Tables']['project_workflow_steps']['Row']

export type UseWorkflowStepWritesArgs = {
  authUserId: string | undefined
  showToast: (message: string, kind: 'error' | 'success' | 'info') => void
  /** After an approval is written and the steps re-read. */
  onApproved?: (step: Step, nextStep: Step | null) => void
}

export function useWorkflowStepWrites(engine: WorkflowStepsEngine, { authUserId, showToast, onApproved }: UseWorkflowStepWritesArgs) {
  const {
    setSteps,
    setError,
    userSubscriptions,
    setUserSubscriptions,
    refreshSteps,
    getCurrentUserName,
    executeLifecyclePlan,
    findNextStep,
  } = engine

  async function markStarted(step: Step, startDateTime?: string) {
    const plan = planStepTransition({
      transition: 'start',
      step,
      nowIso: new Date().toISOString(),
      startedAtIso: (startDateTime ? fromDatetimeLocal(startDateTime) : undefined) ?? undefined,
    })
    if (!(await executeLifecyclePlan(plan, new Map([[step.id, step]])))) return
    await refreshSteps()
  }

  // Persist an inline percent-complete edit from the expanded stage card. Mirrors
  // `submitExpectedDates` (single-column update + optimistic `setSteps` merge). The Forecast
  // Specific tab has its own equivalent — both surfaces commit identically because the
  // user's keystrokes flow through the shared `parsePercentCompleteInput` helper before
  // landing here.
  async function updatePercentComplete(step: Step, value: number | null) {
    const { error } = await supabase
      .from('project_workflow_steps')
      .update({ percent_complete: value })
      .eq('id', step.id)
    if (error) {
      showToast(`Failed to save % complete: ${error.message}`, 'error')
      return
    }
    setSteps((prev) =>
      prev.map((s) => (s.id === step.id ? { ...s, percent_complete: value } : s)),
    )
  }

  async function markCompleted(step: Step) {
    const nextStep = findNextStep(step)
    const plan = planStepTransition({ transition: 'complete', step, nextStep, nowIso: new Date().toISOString() })
    const stepsById = new Map([[step.id, step]])
    if (nextStep) stepsById.set(nextStep.id, nextStep)
    if (!(await executeLifecyclePlan(plan, stepsById))) return
    await refreshSteps()
  }

  async function markApproved(step: Step) {
    const approvedByName = await getCurrentUserName()
    const nextStep = findNextStep(step)
    const plan = planStepTransition({
      transition: 'approve',
      step,
      nextStep,
      approvedByName,
      nowIso: new Date().toISOString(),
    })
    const stepsById = new Map([[step.id, step]])
    if (nextStep) stepsById.set(nextStep.id, nextStep)
    if (!(await executeLifecyclePlan(plan, stepsById))) return

    await refreshSteps()

    // v2.1189: the list folds this card and opens the next (see the page's onApproved).
    onApproved?.(step, nextStep)
  }

  async function markReopened(step: Step) {
    const plan = planStepTransition({ transition: 'reopen', step, nowIso: new Date().toISOString() })
    if (!(await executeLifecyclePlan(plan, new Map([[step.id, step]])))) return
    await refreshSteps()
  }

  async function updateNotifyAssigned(step: Step, field: 'notify_assigned_when_started' | 'notify_assigned_when_complete' | 'notify_assigned_when_reopened', value: boolean) {
    const { error } = await supabase.from('project_workflow_steps').update({ [field]: value }).eq('id', step.id)
    if (error) {
      setError(`Failed to update notification setting: ${error.message}`)
      return
    }
    await refreshSteps()
  }

  async function updateCrossStepNotify(step: Step, field: 'notify_next_assignee_when_complete_or_approved' | 'notify_prior_assignee_when_rejected', value: boolean) {
    const { error } = await supabase.from('project_workflow_steps').update({ [field]: value }).eq('id', step.id)
    if (error) {
      setError(`Failed to update notification setting: ${error.message}`)
      return
    }
    await refreshSteps()
  }

  async function updateNotifyMe(step: Step, field: 'notify_when_started' | 'notify_when_complete' | 'notify_when_reopened', value: boolean) {
    if (!authUserId) return
    const current = userSubscriptions[step.id]
    const payload = {
      step_id: step.id,
      user_id: authUserId,
      notify_when_started: field === 'notify_when_started' ? value : (current?.notify_when_started ?? false),
      notify_when_complete: field === 'notify_when_complete' ? value : (current?.notify_when_complete ?? false),
      notify_when_reopened: field === 'notify_when_reopened' ? value : (current?.notify_when_reopened ?? false),
    }
    if (current) {
      await supabase.from('step_subscriptions').update(payload).eq('step_id', step.id).eq('user_id', authUserId)
    } else {
      await supabase.from('step_subscriptions').insert(payload)
    }
    setUserSubscriptions((prev) => ({ ...prev, [step.id]: payload }))
  }

  async function updateNotes(step: Step, notes: string) {
    const trimmed = notes.trim() || null
    let err = (await supabase.rpc('update_step_notes', { p_step_id: step.id, p_notes: trimmed ?? '' })).error
    if (err?.message?.includes('Could not find the function')) {
      err = (await supabase.from('project_workflow_steps').update({ notes: trimmed }).eq('id', step.id)).error
    }
    if (err) {
      setError(`Failed to update notes: ${err.message}`)
      return
    }
    await refreshSteps()
  }

  async function updatePrivateNotes(step: Step, privateNotes: string) {
    const trimmed = privateNotes.trim() || null
    let err = (await supabase.rpc('update_step_private_notes', { p_step_id: step.id, p_private_notes: trimmed ?? '' })).error
    if (err?.message?.includes('Could not find the function')) {
      err = (await supabase.from('project_workflow_steps').update({ private_notes: trimmed }).eq('id', step.id)).error
    }
    if (err) {
      setError(`Failed to update private notes: ${err.message}`)
      return
    }
    await refreshSteps()
  }


  async function deleteStep(step: Step) {
    setError(null)
    
    try {
      // Delete dependencies where this step is the source
      const { error: depErr1 } = await supabase
        .from('workflow_step_dependencies')
        .delete()
        .eq('step_id', step.id)
      
      if (depErr1) {
        throw new Error(`Failed to delete step dependencies: ${depErr1.message}`)
      }
      
      // Delete dependencies where this step is the target
      const { error: depErr2 } = await supabase
        .from('workflow_step_dependencies')
        .delete()
        .eq('depends_on_step_id', step.id)
      
      if (depErr2) {
        throw new Error(`Failed to delete reverse dependencies: ${depErr2.message}`)
      }
      
      // Delete the step itself
      const { error: delErr } = await supabase
        .from('project_workflow_steps')
        .delete()
        .eq('id', step.id)
      
      if (delErr) {
        throw new Error(`Failed to delete step: ${delErr.message}`)
      }
      
      await refreshSteps()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete step')
    }
  }

  async function assignPerson(step: Step, name: string | null, personId?: string | null) {
    const previousName = step.assigned_to_name
    setSteps((prev) =>
      prev.map((s) => (s.id === step.id ? { ...s, assigned_to_name: name } : s))
    )
    // Prefer the 3-arg RPC (writes assigned_person_id too; explicit id wins for
    // duplicate roster names). Fall back to the legacy RPC, then the direct
    // update — the DB trigger resolves the person id on both fallbacks.
    let err: { message: string } | null = null
    const rpcRes = await supabase.rpc('update_step_assignment', {
      p_step_id: step.id,
      p_assigned_to_name: name ?? '',
      p_person_id: personId ?? undefined,
    })
    err = rpcRes.error
    if (err?.message?.includes('Could not find the function')) {
      const legacyRes = await supabase.rpc('update_step_assigned_to', {
        p_step_id: step.id,
        p_assigned_to_name: name ?? '',
      })
      err = legacyRes.error
    }
    if (err?.message?.includes('Could not find the function')) {
      const directRes = await supabase.from('project_workflow_steps').update({ assigned_to_name: name ?? '' }).eq('id', step.id)
      err = directRes.error
    }
    if (err) {
      setSteps((prev) =>
        prev.map((s) => (s.id === step.id ? { ...s, assigned_to_name: previousName } : s))
      )
      setError(`Failed to assign person: ${err.message}`)
      return
    }
    // First assignee on this step → the three "notify the assigned person"
    // toggles turn on (J31-4 P2, v2.2900). Best-effort: the assignment already
    // landed, so a refused toggle write is not an assignment failure.
    const notifyPatch = notifyAssignedDefaultsOnAssign(previousName, name)
    if (notifyPatch) {
      await supabase.from('project_workflow_steps').update(notifyPatch).eq('id', step.id)
    }
    refreshSteps()
  }

  return {
    markStarted,
    markCompleted,
    markApproved,
    markReopened,
    updatePercentComplete,
    updateNotifyAssigned,
    updateCrossStepNotify,
    updateNotifyMe,
    updateNotes,
    updatePrivateNotes,
    deleteStep,
    assignPerson,
  }
}

export type WorkflowStepWrites = ReturnType<typeof useWorkflowStepWrites>
