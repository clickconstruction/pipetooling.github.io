import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { UserRole } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useEditProjectModal } from '../../contexts/EditProjectModalContext'
import { toDatetimeLocal, fromDatetimeLocal } from '../../utils/datetimeLocal'
import { formatProjectNumberLabel } from '../../lib/projectNumberLabel'
import AssignedStageCard from '../AssignedStageCard'
import { DashboardGroupCard } from './DashboardGroupCard'
import { AssignedSkeleton, SubscribedSkeleton } from './DashboardSkeletons'
import type { AssignedStep, Step, SubscribedStep } from '../../lib/dashboardBootTypes'
import { daysOpen, formatDatetime, personDisplay } from '../../lib/dashboardProjectsCard'
import { planStepTransition, type StepLifecyclePlan } from '../../lib/workflow/stepLifecycle'
import { formatWorkOrderAmount } from '../../lib/workflow/workOrderNotifications'
import { sendStepLifecycleNotifications } from '../../lib/workflow/stepLifecycleNotifications'

/**
 * Dashboard "Projects" group card: Assigned Stages (+ Complete sub-list) and
 * Subscribed Stages, plus the reject/skip/set-start step modals. Step
 * transitions run through the shared lifecycle kernel (planStepTransition +
 * sendStepLifecycleNotifications) — the same engine as the Workflow page, so
 * this surface sends the same notifications and uses the same reject cascade
 * (previous step reopens to in_progress).
 *
 * The parent gates the render on `projectsCardVisible` — the three step modals
 * live INSIDE that conditional (as before the extraction), so they cannot render
 * when the card is hidden. Safe today: they are only openable from within the card.
 *
 * Step data comes from the parent's `useDashboardBoot` seam (`assignedSteps` /
 * `subscribedSteps` / `userNames` / `loadAssignedSteps`). Identity is by user
 * NAME (`get_assigned_steps_*(p_user_name)` / `performed_by`) — do not change.
 * `getCurrentUserName` stays parent-owned (also used by the My Inbox
 * checklist-completion notifications).
 */
export function DashboardProjectsCard({
  assignedSteps,
  subscribedSteps,
  assignedLoading,
  subscribedLoading,
  userLoading,
  showAssigned,
  showSubscribed,
  userNames,
  role,
  getCurrentUserName,
  loadAssignedSteps,
}: {
  assignedSteps: AssignedStep[]
  subscribedSteps: SubscribedStep[]
  assignedLoading: boolean
  subscribedLoading: boolean
  userLoading: boolean
  showAssigned: boolean
  showSubscribed: boolean
  userNames: Set<string>
  role: UserRole | null
  getCurrentUserName: () => Promise<string>
  loadAssignedSteps: () => Promise<void>
}) {
  const { showToast } = useToastContext()
  const editProjectModal = useEditProjectModal()

  const [rejectStep, setRejectStep] = useState<{ step: AssignedStep; reason: string } | null>(null)
  const [skipStep, setSkipStep] = useState<{ step: AssignedStep; reason: string } | null>(null)
  const [setStartStep, setSetStartStep] = useState<{ step: AssignedStep; startDateTime: string } | null>(null)
  const [assignedStagesExpanded, setAssignedStagesExpanded] = useState(true)
  const [assignedStagesCompleteExpanded, setAssignedStagesCompleteExpanded] = useState(false)
  const [subscribedStagesExpanded, setSubscribedStagesExpanded] = useState(true)
  /** One-time expand/collapse heuristic after initial assigned roster load — do not overwrite user toggle on refresh. */
  const assignedStagesExpandedDefaultAppliedRef = useRef(false)

  const activeAssignedSteps = useMemo(
    () => assignedSteps.filter((s) => s.status !== 'completed'),
    [assignedSteps],
  )
  const completedAssignedSteps = useMemo(
    () => assignedSteps.filter((s) => s.status === 'completed'),
    [assignedSteps],
  )

  useEffect(() => {
    if (assignedStagesExpandedDefaultAppliedRef.current) return
    if (assignedLoading) return
    assignedStagesExpandedDefaultAppliedRef.current = true
    const hasInProgress = assignedSteps.some((s) => s.status === 'in_progress')
    setAssignedStagesExpanded(hasInProgress)
  }, [assignedLoading, assignedSteps])

  const [commitmentChipByStep, setCommitmentChipByStep] = useState<Record<string, string>>({})

  // Work-order chip per assigned step (RUN_SUBS_PLAN PR 4.6). RLS scopes rows
  // (a sub sees only their own); fail-soft pre-migration.
  useEffect(() => {
    const stepIds = [...new Set(assignedSteps.map((s) => s.id))]
    if (stepIds.length === 0) {
      setCommitmentChipByStep({})
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('step_commitments')
        .select('step_id, amount, status')
        .in('step_id', stepIds)
        .in('status', ['offered', 'accepted', 'approved', 'settled'])
      if (cancelled || error) return
      const byStep: Record<string, Array<{ amount: number; status: string }>> = {}
      for (const row of (data ?? []) as Array<{ step_id: string; amount: number; status: string }>) {
        ;(byStep[row.step_id] ??= []).push({ amount: Number(row.amount), status: row.status })
      }
      const chips: Record<string, string> = {}
      for (const [stepId, rows] of Object.entries(byStep)) {
        if (rows.length === 1) {
          chips[stepId] = `${formatWorkOrderAmount(rows[0]!.amount)} · ${rows[0]!.status}`
        } else {
          const total = rows.reduce((sum, r) => sum + r.amount, 0)
          chips[stepId] = `${rows.length} work orders · ${formatWorkOrderAmount(total)}`
        }
      }
      setCommitmentChipByStep(chips)
    })()
    return () => {
      cancelled = true
    }
  }, [assignedSteps])

  async function recordAction(stepId: string, actionType: 'started' | 'completed' | 'approved' | 'rejected' | 'reopened' | 'skipped', notes?: string | null) {
    const performedBy = await getCurrentUserName()
    const performedAt = new Date().toISOString()
    const { error } = await supabase
      .from('project_workflow_step_actions')
      .insert({
        step_id: stepId,
        action_type: actionType,
        performed_by: performedBy,
        performed_at: performedAt,
        notes: notes || null,
      })
    if (error) {
      console.error('Failed to record step action', actionType, error)
    }
  }

  async function findPreviousStep(step: AssignedStep): Promise<AssignedStep | null> {
    const { data: allStepsData } = await supabase
      .from('project_workflow_steps')
      .select('*')
      .eq('workflow_id', step.workflow_id)
      .order('sequence_order', { ascending: true })
    const allSteps = (allStepsData ?? []) as Step[]
    if (allSteps.length === 0) return null

    const sortedSteps = allSteps.sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
    const currentIndex = sortedSteps.findIndex((s) => s.id === step.id)
    if (currentIndex <= 0) return null

    const previousStep = sortedSteps[currentIndex - 1]
    // Find the project info for the previous step
    const { data: workflow } = await supabase
      .from('project_workflows')
      .select('project_id')
      .eq('id', step.workflow_id)
      .single()

    if (workflow) {
      const { data: project } = await supabase
        .from('projects')
        .select('id, name, address, plans_link')
        .eq('id', workflow.project_id)
        .single()

      if (project) {
        return {
          ...previousStep,
          project_id: project.id,
          project_name: project.name,
          project_address: project.address,
          project_plans_link: project.plans_link,
          project_superintendent_names: null,
          workflow_id: step.workflow_id,
        } as AssignedStep
      }
    }

    return null
  }

  async function findNextStep(step: AssignedStep): Promise<AssignedStep | null> {
    const { data: allStepsData } = await supabase
      .from('project_workflow_steps')
      .select('*')
      .eq('workflow_id', step.workflow_id)
      .order('sequence_order', { ascending: true })
    const allSteps = (allStepsData ?? []) as Step[]
    if (allSteps.length === 0) return null

    const sortedSteps = allSteps.sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
    const currentIndex = sortedSteps.findIndex((s) => s.id === step.id)
    if (currentIndex < 0 || currentIndex >= sortedSteps.length - 1) return null

    const nextStep = sortedSteps[currentIndex + 1]
    // Find the project info for the next step
    const { data: workflow } = await supabase
      .from('project_workflows')
      .select('project_id')
      .eq('id', step.workflow_id)
      .single()

    if (workflow) {
      const { data: project } = await supabase
        .from('projects')
        .select('id, name, address, plans_link')
        .eq('id', workflow.project_id)
        .single()

      if (project) {
        return {
          ...nextStep,
          project_id: project.id,
          project_name: project.name,
          project_address: project.address,
          project_plans_link: project.plans_link,
          project_superintendent_names: null,
          workflow_id: step.workflow_id,
        } as AssignedStep
      }
    }

    return null
  }

  // Run a planned lifecycle transition (shared kernel with the Workflow page,
  // RUN_SUBS_PLAN PR 0.1). The first update is load-bearing: a failure or zero
  // rows affected (RLS) surfaces as a toast and aborts. Cascade updates log
  // only, matching the legacy fire-and-continue behavior. Notifications are
  // new on this surface — the card previously sent none.
  async function executeLifecyclePlan(plan: StepLifecyclePlan, stepsById: Map<string, AssignedStep>): Promise<boolean> {
    let first = true
    for (const u of plan.updates) {
      const res = await supabase.from('project_workflow_steps').update(u.update).eq('id', u.stepId).select('id')
      const rows = Array.isArray(res.data) ? res.data.length : 0
      if (res.error || rows === 0) {
        if (first) {
          showToast(res.error?.message ?? 'Could not update this step. Try again or contact the office.', 'error')
          return false
        }
        console.error('Failed to update step in lifecycle cascade', u.stepId, res.error)
      }
      first = false
    }
    for (const a of plan.actions) {
      await recordAction(a.stepId, a.actionType, a.notes)
    }
    for (const n of plan.notifications) {
      const s = stepsById.get(n.stepId)
      if (s) {
        void sendStepLifecycleNotifications({
          step: { ...s, ...(n.stepOverrides ?? {}) },
          actionType: n.actionType,
          projectId: s.project_id,
          projectName: s.project_name,
        })
      }
    }
    return true
  }

  async function markStarted(step: AssignedStep, startDateTime?: string) {
    const plan = planStepTransition({
      transition: 'start',
      step,
      nowIso: new Date().toISOString(),
      startedAtIso: (startDateTime ? fromDatetimeLocal(startDateTime) : undefined) ?? undefined,
    })
    if (!(await executeLifecyclePlan(plan, new Map([[step.id, step]])))) return
    await loadAssignedSteps()
  }

  async function submitSetStart() {
    if (!setStartStep) return
    await markStarted(setStartStep.step, setStartStep.startDateTime)
    setSetStartStep(null)
  }

  async function markCompleted(step: AssignedStep) {
    const nextStep = await findNextStep(step)
    const plan = planStepTransition({ transition: 'complete', step, nextStep, nowIso: new Date().toISOString() })
    const stepsById = new Map([[step.id, step]])
    if (nextStep) stepsById.set(nextStep.id, nextStep)
    if (!(await executeLifecyclePlan(plan, stepsById))) return
    await loadAssignedSteps()
  }

  async function markApproved(step: AssignedStep) {
    const approvedByName = await getCurrentUserName()
    const nextStep = await findNextStep(step)
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
    await loadAssignedSteps()
  }

  async function submitReject() {
    if (!rejectStep) return
    const previousStep = await findPreviousStep(rejectStep.step)
    const plan = planStepTransition({
      transition: 'reject',
      step: rejectStep.step,
      prevStep: previousStep,
      reason: rejectStep.reason,
      nowIso: new Date().toISOString(),
    })
    const stepsById = new Map([[rejectStep.step.id, rejectStep.step]])
    if (previousStep) stepsById.set(previousStep.id, previousStep)
    const ok = await executeLifecyclePlan(plan, stepsById)
    setRejectStep(null)
    if (ok) await loadAssignedSteps()
  }

  async function submitSkip() {
    if (!skipStep || !skipStep.reason.trim()) return
    const plan = planStepTransition({
      transition: 'skip',
      step: skipStep.step,
      reason: skipStep.reason,
      nowIso: new Date().toISOString(),
    })
    const ok = await executeLifecyclePlan(plan, new Map([[skipStep.step.id, skipStep.step]]))
    setSkipStep(null)
    if (ok) await loadAssignedSteps()
  }

  return (
    <DashboardGroupCard id="dash-projects" title="Projects">
      {(userLoading || showAssigned) && (
        <div>
          <button
            type="button"
            onClick={() => setAssignedStagesExpanded((prev) => !prev)}
            aria-expanded={assignedStagesExpanded}
            aria-controls="dashboard-assigned-stages-panel"
            style={{
              margin: 0,
              padding: 0,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: assignedStagesExpanded ? '0.75rem' : 0,
            }}
          >
            <span aria-hidden>{assignedStagesExpanded ? '\u25BC' : '\u25B6'}</span>
            <h3 id="dashboard-assigned-stages-heading" style={{ fontSize: '1rem', margin: 0 }}>
              Assigned Steps ({assignedSteps.length})
            </h3>
          </button>
          {assignedStagesExpanded &&
            (assignedLoading && assignedSteps.length === 0 ? (
              <div
                id="dashboard-assigned-stages-panel"
                role="region"
                aria-labelledby="dashboard-assigned-stages-heading"
              >
                <AssignedSkeleton />
              </div>
            ) : (
              <div id="dashboard-assigned-stages-panel" role="region" aria-labelledby="dashboard-assigned-stages-heading">
                {activeAssignedSteps.map((s) => (
                  <AssignedStageCard
                    commitmentChip={commitmentChipByStep[s.id] ?? null}
                    key={s.id}
                    step={s}
                    userNames={userNames}
                    role={role}
                    onSetStart={() => setSetStartStep({ step: s, startDateTime: toDatetimeLocal(new Date().toISOString()) })}
                    onMarkComplete={() => markCompleted(s)}
                    onMarkApproved={() => markApproved(s)}
                    onReject={() => setRejectStep({ step: s, reason: '' })}
                    onSkip={() => setSkipStep({ step: s, reason: '' })}
                    formatDatetime={formatDatetime}
                    daysOpen={daysOpen}
                    personDisplay={personDisplay}
                  />
                ))}
                {completedAssignedSteps.length > 0 && (
                  <div style={{ marginTop: activeAssignedSteps.length > 0 ? '1.25rem' : 0, paddingLeft: '1.25rem' }}>
                    <button
                      type="button"
                      onClick={() => setAssignedStagesCompleteExpanded((prev) => !prev)}
                      aria-expanded={assignedStagesCompleteExpanded}
                      style={{
                        margin: 0,
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: assignedStagesCompleteExpanded ? '0.75rem' : 0,
                      }}
                    >
                      <span aria-hidden>{assignedStagesCompleteExpanded ? '\u25BC' : '\u25B6'}</span>
                      <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: 600 }}>
                        Complete ({completedAssignedSteps.length})
                      </h3>
                    </button>
                    {assignedStagesCompleteExpanded &&
                      completedAssignedSteps.map((s) => (
                        <AssignedStageCard
                          commitmentChip={commitmentChipByStep[s.id] ?? null}
                          key={s.id}
                          step={s}
                          userNames={userNames}
                          role={role}
                          onSetStart={() => setSetStartStep({ step: s, startDateTime: toDatetimeLocal(new Date().toISOString()) })}
                          onMarkComplete={() => markCompleted(s)}
                          onMarkApproved={() => markApproved(s)}
                          onReject={() => setRejectStep({ step: s, reason: '' })}
                          onSkip={() => setSkipStep({ step: s, reason: '' })}
                          formatDatetime={formatDatetime}
                          daysOpen={daysOpen}
                          personDisplay={personDisplay}
                        />
                      ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Previous work incomplete: {rejectStep.step.name}</h3>
            <label style={{ display: 'block', marginBottom: 4 }}>Reason and Proposed Remedy</label>
            <textarea
              value={rejectStep.reason}
              onChange={(e) => setRejectStep((r) => r ? { ...r, reason: e.target.value } : null)}
              rows={3}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
              placeholder="What is wrong and how should it be fixed (optional)"
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={submitReject} style={{ padding: '0.5rem 1rem', color: '#E87600' }}>Send Back: Previous Work Incomplete</button>
              <button type="button" onClick={() => setRejectStep(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Skip Modal */}
      {skipStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Skip step: {skipStep.step.name}</h3>
            <label style={{ display: 'block', marginBottom: 4 }}>Why is this step being skipped?</label>
            <textarea
              value={skipStep.reason}
              onChange={(e) => setSkipStep((r) => r ? { ...r, reason: e.target.value } : null)}
              rows={4}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
              placeholder="e.g. Client waived inspection, combined with prior step, not applicable..."
            />
            <div style={{ marginBottom: '1rem' }}>
              <button type="button" onClick={() => setSkipStep((s) => s ? { ...s, reason: 'Not relevant' } : null)} style={{ fontSize: '0.8125rem', padding: '0.25rem 0.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}>
                Not relevant
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={submitSkip} disabled={!skipStep.reason.trim()} style={{ padding: '0.5rem 1rem', color: 'var(--text-amber-800)', ...(!skipStep.reason.trim() && { opacity: 0.5, cursor: 'not-allowed' }) }}>Skip</button>
              <button type="button" onClick={() => setSkipStep(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Set Start Modal */}
      {setStartStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Set Start Time: {setStartStep.step.name}</h3>
            <label htmlFor="start-datetime" style={{ display: 'block', marginBottom: 4 }}>Start Date & Time</label>
            <input
              id="start-datetime"
              type="datetime-local"
              value={setStartStep.startDateTime}
              onChange={(e) => setSetStartStep({ step: setStartStep.step, startDateTime: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={submitSetStart} style={{ padding: '0.5rem 1rem' }}>Set Start</button>
              <button type="button" onClick={() => setSetStartStep(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showSubscribed && (subscribedLoading || subscribedSteps.length > 0) && (
        <div style={{ marginTop: (userLoading || showAssigned) ? '1.5rem' : 0 }}>
          <button
            type="button"
            onClick={() => setSubscribedStagesExpanded((prev) => !prev)}
            aria-expanded={subscribedStagesExpanded}
            aria-controls="dashboard-subscribed-stages-panel"
            style={{
              margin: 0,
              padding: 0,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: subscribedStagesExpanded ? '0.75rem' : 0,
            }}
          >
            <span aria-hidden>{subscribedStagesExpanded ? '\u25BC' : '\u25B6'}</span>
            <h3 id="dashboard-subscribed-stages-heading" style={{ fontSize: '1rem', margin: 0 }}>
              Subscribed Steps ({subscribedSteps.length})
            </h3>
          </button>
          {subscribedStagesExpanded ? (
            <div
              id="dashboard-subscribed-stages-panel"
              role="region"
              aria-labelledby="dashboard-subscribed-stages-heading"
            >
              {subscribedLoading && subscribedSteps.length === 0 ? (
                <SubscribedSkeleton />
              ) : subscribedSteps.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                  No subscribed stages. Go to a workflow and enable &quot;Notify when started&quot;, &quot;Notify when complete&quot;, or &quot;Notify when re-opened&quot; for steps you want to track here.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {subscribedSteps.map((sub) => {
                    const notifications = []
                    if (sub.notify_when_started) notifications.push('started')
                    if (sub.notify_when_complete) notifications.push('complete')
                    if (sub.notify_when_reopened) notifications.push('re-opened')
                    return (
                      <li
                        key={sub.step_id}
                        style={{
                          padding: '0.75rem 0',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <div>
                          <Link to={`/workflows/${sub.project_id}#step-${sub.step_id}`} style={{ fontWeight: 500 }}>
                            {sub.step_name}
                          </Link>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {formatProjectNumberLabel(sub.project_number) ?? 'Project'}:{' '}
                            <button
                              type="button"
                              onClick={() => {
                                editProjectModal?.openEditProjectModal(sub.project_id)
                              }}
                              style={{
                                color: 'var(--text-link)',
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                font: 'inherit',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                            >
                              {sub.project_name}
                            </button>
                          </div>
                          {notifications.length > 0 && (
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              Notify when: {notifications.join(', ')}
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      )}
    </DashboardGroupCard>
  )
}
