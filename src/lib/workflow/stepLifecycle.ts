/**
 * Pure planner for the workflow-step lifecycle (RUN_SUBS_PLAN Phase 0, PR 0.1).
 *
 * The step lifecycle was implemented twice — src/pages/Workflow.tsx and the
 * Dashboard Projects card — with diverging behavior (the card sent no
 * notifications, and its reject cascade reopened the previous step to
 * 'pending' where the Workflow page uses 'in_progress'). Both surfaces now
 * plan every transition here and stay thin executors: they run the updates,
 * insert the action rows, fire the notification intents, and keep their own
 * refresh/toast/scroll behavior.
 *
 * The planner is I/O-free: callers supply the step (and its neighbor by
 * sequence_order where a cascade can apply) plus timestamps, and get back the
 * ordered column updates, action-ledger rows, and notification intents that
 * the legacy handlers produced.
 */

export type StepActionType = 'started' | 'completed' | 'approved' | 'rejected' | 'reopened' | 'skipped'
export type StepNotifyActionType = 'started' | 'completed' | 'approved' | 'rejected' | 'reopened'

/** The slice of a project_workflow_steps row the planner needs. */
export type LifecycleStepInput = {
  id: string
  name: string
  status: string
  next_step_rejected_notice?: string | null
}

export type StepUpdatePlan = { stepId: string; update: Record<string, unknown> }
export type StepActionPlan = { stepId: string; actionType: StepActionType; notes: string | null }
export type StepNotifyPlan = {
  stepId: string
  actionType: StepNotifyActionType
  /**
   * Values the executor must fold into the step row handed to the
   * notification sender — e.g. the just-set rejection_reason, which the
   * in-memory row does not carry yet.
   */
  stepOverrides?: Record<string, unknown>
}

export type StepLifecyclePlan = {
  /** Ordered; executors apply sequentially and treat the FIRST update as the load-bearing one. */
  updates: StepUpdatePlan[]
  actions: StepActionPlan[]
  notifications: StepNotifyPlan[]
}

export type StepTransitionInput =
  | { transition: 'start'; step: LifecycleStepInput; nowIso: string; startedAtIso?: string }
  | { transition: 'complete'; step: LifecycleStepInput; nextStep: LifecycleStepInput | null; nowIso: string }
  | { transition: 'approve'; step: LifecycleStepInput; nextStep: LifecycleStepInput | null; approvedByName: string; nowIso: string }
  | { transition: 'reject'; step: LifecycleStepInput; prevStep: LifecycleStepInput | null; reason: string; nowIso: string }
  | { transition: 'skip'; step: LifecycleStepInput; reason: string; nowIso: string }
  | { transition: 'reopen'; step: LifecycleStepInput; nowIso: string }

/** Cascade shared by complete/approve: a rejected NEXT step reopens to pending. */
function planFinishCascade(
  plan: StepLifecyclePlan,
  step: LifecycleStepInput,
  nextStep: LifecycleStepInput | null,
  reopenNote: string,
): void {
  if (!nextStep || nextStep.status !== 'rejected') return
  if (step.next_step_rejected_notice) {
    plan.updates.push({
      stepId: step.id,
      update: { next_step_rejected_notice: null, next_step_rejection_reason: null },
    })
  }
  plan.updates.push({
    stepId: nextStep.id,
    update: { status: 'pending', rejection_reason: null, ended_at: null },
  })
  plan.actions.push({ stepId: nextStep.id, actionType: 'reopened', notes: reopenNote })
  plan.notifications.push({ stepId: nextStep.id, actionType: 'reopened' })
}

export function planStepTransition(input: StepTransitionInput): StepLifecyclePlan {
  const plan: StepLifecyclePlan = { updates: [], actions: [], notifications: [] }
  const { step } = input

  switch (input.transition) {
    case 'start': {
      plan.updates.push({
        stepId: step.id,
        update: { started_at: input.startedAtIso ?? input.nowIso, status: 'in_progress' },
      })
      plan.actions.push({ stepId: step.id, actionType: 'started', notes: null })
      plan.notifications.push({ stepId: step.id, actionType: 'started' })
      return plan
    }
    case 'complete': {
      plan.updates.push({
        stepId: step.id,
        update: { status: 'completed', ended_at: input.nowIso },
      })
      plan.actions.push({ stepId: step.id, actionType: 'completed', notes: null })
      plan.notifications.push({ stepId: step.id, actionType: 'completed' })
      planFinishCascade(plan, step, input.nextStep, 'Previous step was re-completed')
      return plan
    }
    case 'approve': {
      plan.updates.push({
        stepId: step.id,
        update: {
          status: 'approved',
          ended_at: input.nowIso,
          approved_by: input.approvedByName,
          approved_at: input.nowIso,
        },
      })
      plan.actions.push({ stepId: step.id, actionType: 'approved', notes: null })
      plan.notifications.push({ stepId: step.id, actionType: 'approved' })
      planFinishCascade(plan, step, input.nextStep, 'Previous step was re-approved')
      return plan
    }
    case 'reject': {
      const reason = input.reason.trim() || null
      plan.updates.push({
        stepId: step.id,
        update: { status: 'rejected', rejection_reason: reason, ended_at: input.nowIso },
      })
      plan.actions.push({ stepId: step.id, actionType: 'rejected', notes: reason })
      plan.notifications.push({
        stepId: step.id,
        actionType: 'rejected',
        stepOverrides: { rejection_reason: reason },
      })
      const prev = input.prevStep
      if (prev) {
        if (prev.status === 'completed' || prev.status === 'approved') {
          plan.updates.push({
            stepId: prev.id,
            update: {
              status: 'in_progress',
              ended_at: null,
              approved_by: null,
              approved_at: null,
              next_step_rejected_notice: step.name,
              next_step_rejection_reason: reason,
            },
          })
          plan.actions.push({
            stepId: prev.id,
            actionType: 'reopened',
            notes: `Next step "${step.name}" was rejected`,
          })
          plan.notifications.push({ stepId: prev.id, actionType: 'reopened' })
        } else if (prev.status === 'pending' || prev.status === 'in_progress') {
          plan.updates.push({
            stepId: prev.id,
            update: {
              next_step_rejected_notice: step.name,
              next_step_rejection_reason: reason,
            },
          })
        }
      }
      return plan
    }
    case 'skip': {
      plan.updates.push({
        stepId: step.id,
        update: { status: 'skipped', skipped_reason: input.reason.trim(), ended_at: input.nowIso },
      })
      plan.actions.push({ stepId: step.id, actionType: 'skipped', notes: input.reason.trim() })
      return plan
    }
    case 'reopen': {
      plan.updates.push({
        stepId: step.id,
        update: {
          status: 'pending',
          ended_at: null,
          rejection_reason: null,
          skipped_reason: null,
          approved_by: null,
          approved_at: null,
          next_step_rejected_notice: null,
          next_step_rejection_reason: null,
        },
      })
      plan.actions.push({ stepId: step.id, actionType: 'reopened', notes: null })
      plan.notifications.push({ stepId: step.id, actionType: 'reopened' })
      return plan
    }
  }
}
