import { supabase } from '../supabase'
import type { StepNotifyActionType } from './stepLifecycle'

/**
 * Shared sender for workflow-step lifecycle notifications (RUN_SUBS_PLAN
 * Phase 0, PR 0.1). Ported verbatim from Workflow.tsx's sendNotification +
 * sendWorkflowNotifications so the Dashboard Projects card can fire the same
 * emails/pushes — before this, only the Workflow page notified.
 *
 * Everything is best-effort: failures log to console and never surface to the
 * user. Recipient resolution goes assigned_person_id-first (v2.1733, identity
 * Phase D) with the legacy name path (users by exact trimmed name, then
 * active people) as fallback.
 */

export type NotifiableStep = {
  id: string
  workflow_id: string
  name: string
  assigned_to_name: string | null
  assigned_person_id?: string | null
  rejection_reason?: string | null
  notify_assigned_when_started?: boolean | null
  notify_assigned_when_complete?: boolean | null
  notify_assigned_when_reopened?: boolean | null
  notify_next_assignee_when_complete_or_approved?: boolean | null
  notify_prior_assignee_when_rejected?: boolean | null
}

async function getContactForName(name: string | null, personId?: string | null): Promise<{ email: string | null; userId: string | null }> {
  // Id-first (identity Phase D): assigned_person_id names the contact even
  // when the display name is stale; an account-linked person notifies their
  // user. RLS may hide people from field roles — then the name path runs.
  if (personId) {
    const { data: person } = await supabase
      .from('people')
      .select('email, account_user_id')
      .eq('id', personId)
      .maybeSingle()
    if (person?.account_user_id) {
      const { data: acctUser } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', person.account_user_id)
        .maybeSingle()
      if (acctUser?.email) return { email: acctUser.email, userId: acctUser.id }
    }
    if (person?.email) return { email: person.email, userId: null }
  }

  if (!name) return { email: null, userId: null }
  const trimmedName = name.trim()

  // Check users table first (most reliable - has both email and id)
  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('name', trimmedName)
    .maybeSingle()
  if (user?.email) return { email: user.email, userId: user.id }

  // Check people table (may be limited by RLS, but try anyway)
  const { data: people } = await supabase
    .from('people')
    .select('email')
    .is('archived_at', null)
    .eq('name', trimmedName)
    .limit(1)
  if (people && people.length > 0 && people[0]?.email) {
    return { email: people[0].email, userId: null }
  }

  return { email: null, userId: null }
}

async function sendOne(args: {
  templateType: string
  step: NotifiableStep
  projectId: string
  projectName: string
  recipientName: string
  recipientEmail: string
  additionalVariables?: Record<string, string>
  recipientUserId?: string
  pushTitle?: string
  pushBody?: string
}): Promise<void> {
  const { templateType, step, projectId, projectName, recipientName, recipientEmail } = args
  if (!recipientEmail) return

  const workflowLink = `${window.location.origin}/workflows/${projectId}#step-${step.id}`

  const variables: Record<string, string> = {
    name: recipientName,
    email: recipientEmail,
    project_name: projectName,
    stage_name: step.name,
    assigned_to_name: step.assigned_to_name || '',
    workflow_link: workflowLink,
    ...args.additionalVariables,
  }

  try {
    const { error: eFn } = await supabase.functions.invoke('send-workflow-notification', {
      body: {
        template_type: templateType,
        step_id: step.id,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        recipient_user_id: args.recipientUserId,
        push_title: args.pushTitle,
        push_body: args.pushBody,
        push_url: workflowLink,
        variables,
      },
    })
    if (eFn) {
      console.error('Failed to send notification:', { error: eFn, message: eFn.message })
      // Don't show error to user - notifications are best-effort
    }
  } catch (error) {
    console.error('Error sending notification:', {
      error,
      message: error instanceof Error ? error.message : String(error),
    })
    // Don't show error to user - notifications are best-effort
  }
}

async function notifySubscribers(args: {
  step: NotifiableStep
  projectId: string
  projectName: string
  flagColumn: 'notify_when_started' | 'notify_when_complete' | 'notify_when_reopened'
  templateType: string
}): Promise<void> {
  const { data: subscriptions } = await supabase
    .from('step_subscriptions')
    .select(`user_id, ${args.flagColumn}`)
    .eq('step_id', args.step.id)
    .eq(args.flagColumn, true)

  if (!subscriptions) return
  for (const sub of subscriptions as Array<{ user_id: string }>) {
    const { data: user } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', sub.user_id)
      .single()
    if (user?.email) {
      await sendOne({
        templateType: args.templateType,
        step: args.step,
        projectId: args.projectId,
        projectName: args.projectName,
        recipientName: user.name || user.email,
        recipientEmail: user.email,
        recipientUserId: sub.user_id ?? undefined,
      })
    }
  }
}

/**
 * Fire every notification the given lifecycle action calls for. Mirrors the
 * legacy dispatcher table: assignee + subscribers on started/complete/reopened,
 * the next assignee's "Your turn" push on complete/approve, the prior
 * assignee on reject. Skip never notifies (no call for it exists).
 *
 * `currentUserId` gates the subscriber lookups exactly like the legacy
 * `authUser?.id` guard: pass the session user id, or null to skip subscriber
 * notifications; pass undefined to have the sender resolve the session itself.
 */
export async function sendStepLifecycleNotifications(args: {
  step: NotifiableStep
  actionType: StepNotifyActionType
  projectId: string
  projectName: string
  currentUserId?: string | null
}): Promise<void> {
  const { step, actionType, projectId, projectName } = args
  if (!projectId || !projectName) return

  let currentUserId = args.currentUserId
  if (currentUserId === undefined) {
    const { data } = await supabase.auth.getUser()
    currentUserId = data.user?.id ?? null
  }

  // Get all steps in workflow to find next/previous
  const { data: allSteps } = await supabase
    .from('project_workflow_steps')
    .select('id, sequence_order, name, assigned_to_name, assigned_person_id')
    .eq('workflow_id', step.workflow_id)
    .order('sequence_order', { ascending: true })

  const sortedSteps = (allSteps as Array<{ id: string; sequence_order: number; name: string; assigned_to_name: string | null; assigned_person_id: string | null }>) || []
  const currentIndex = sortedSteps.findIndex((s) => s.id === step.id)
  const nextStep = currentIndex >= 0 && currentIndex < sortedSteps.length - 1 ? sortedSteps[currentIndex + 1] : null
  const previousStep = currentIndex > 0 ? sortedSteps[currentIndex - 1] : null

  if (actionType === 'started') {
    if (step.notify_assigned_when_started && step.assigned_to_name) {
      const { email, userId } = await getContactForName(step.assigned_to_name, step.assigned_person_id)
      if (email) {
        await sendOne({
          templateType: 'stage_assigned_started',
          step,
          projectId,
          projectName,
          recipientName: step.assigned_to_name,
          recipientEmail: email,
          recipientUserId: userId ?? undefined,
        })
      }
    }
    if (currentUserId) {
      await notifySubscribers({ step, projectId, projectName, flagColumn: 'notify_when_started', templateType: 'stage_me_started' })
    }
  } else if (actionType === 'completed' || actionType === 'approved') {
    if (step.notify_assigned_when_complete && step.assigned_to_name) {
      const { email, userId } = await getContactForName(step.assigned_to_name, step.assigned_person_id)
      if (email) {
        await sendOne({
          templateType: 'stage_assigned_complete',
          step,
          projectId,
          projectName,
          recipientName: step.assigned_to_name,
          recipientEmail: email,
          recipientUserId: userId ?? undefined,
        })
      }
    }
    if (currentUserId) {
      await notifySubscribers({ step, projectId, projectName, flagColumn: 'notify_when_complete', templateType: 'stage_me_complete' })
    }
    // Cross-step: Notify next assignee (primary handoff - include push title/body)
    if (step.notify_next_assignee_when_complete_or_approved && nextStep?.assigned_to_name) {
      const { email, userId } = await getContactForName(nextStep.assigned_to_name, nextStep.assigned_person_id)
      if (email) {
        const nextStepForNotification: NotifiableStep = {
          ...step,
          id: nextStep.id,
          name: nextStep.name,
          assigned_to_name: nextStep.assigned_to_name,
        }
        await sendOne({
          templateType: 'stage_next_complete_or_approved',
          step: nextStepForNotification,
          projectId,
          projectName,
          recipientName: nextStep.assigned_to_name,
          recipientEmail: email,
          additionalVariables: { previous_stage_name: step.name },
          recipientUserId: userId ?? undefined,
          pushTitle: 'Your turn: Step completed',
          pushBody: `${step.name} has been completed. You're up next for ${nextStep.name}.`,
        })
      }
    }
  } else if (actionType === 'rejected') {
    // Cross-step: Notify prior assignee
    if (step.notify_prior_assignee_when_rejected && previousStep?.assigned_to_name) {
      const { email, userId } = await getContactForName(previousStep.assigned_to_name, previousStep.assigned_person_id)
      if (email) {
        const previousStepForNotification: NotifiableStep = {
          ...step,
          id: previousStep.id,
          name: previousStep.name,
          assigned_to_name: previousStep.assigned_to_name,
        }
        await sendOne({
          templateType: 'stage_prior_rejected',
          step: previousStepForNotification,
          projectId,
          projectName,
          recipientName: previousStep.assigned_to_name,
          recipientEmail: email,
          additionalVariables: {
            previous_stage_name: previousStep.name,
            rejection_reason: step.rejection_reason || '',
          },
          recipientUserId: userId ?? undefined,
        })
      }
    }
  } else if (actionType === 'reopened') {
    if (step.notify_assigned_when_reopened && step.assigned_to_name) {
      const { email, userId } = await getContactForName(step.assigned_to_name, step.assigned_person_id)
      if (email) {
        await sendOne({
          templateType: 'stage_assigned_reopened',
          step,
          projectId,
          projectName,
          recipientName: step.assigned_to_name,
          recipientEmail: email,
          recipientUserId: userId ?? undefined,
        })
      }
    }
    if (currentUserId) {
      await notifySubscribers({ step, projectId, projectName, flagColumn: 'notify_when_reopened', templateType: 'stage_me_reopened' })
    }
  }
}
