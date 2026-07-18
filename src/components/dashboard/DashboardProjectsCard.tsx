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

/**
 * Dashboard "Projects" group card: Assigned Stages (+ Complete sub-list) and
 * Subscribed Stages, plus the workflow-step action engine and the reject/skip/
 * set-start step modals (extraction-series refactor; no behavior change).
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

  async function recordAction(stepId: string, actionType: 'started' | 'completed' | 'approved' | 'rejected' | 'reopened' | 'skipped', notes?: string | null) {
    const performedBy = await getCurrentUserName()
    const performedAt = new Date().toISOString()
    await supabase
      .from('project_workflow_step_actions')
      .insert({
        step_id: stepId,
        action_type: actionType,
        performed_by: performedBy,
        performed_at: performedAt,
        notes: notes || null,
      })
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

  async function markStarted(step: AssignedStep, startDateTime?: string) {
    const startedAt = startDateTime ? fromDatetimeLocal(startDateTime) : new Date().toISOString()
    const st = await supabase
      .from('project_workflow_steps')
      .update({ started_at: startedAt, status: 'in_progress' })
      .eq('id', step.id)
      .select('id')
    const stRows = Array.isArray(st.data) ? st.data.length : 0
    if (st.error || stRows === 0) {
      showToast(st.error?.message ?? 'Could not start this stage. Try again or contact the office.', 'error')
      return
    }
    await recordAction(step.id, 'started')
    await loadAssignedSteps()
  }

  async function submitSetStart() {
    if (!setStartStep) return
    await markStarted(setStartStep.step, setStartStep.startDateTime)
    setSetStartStep(null)
  }

  async function markCompleted(step: AssignedStep) {
    const upd1 = await supabase
      .from('project_workflow_steps')
      .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
    })
      .eq('id', step.id)
      .select('id')
    const rowsAffected = Array.isArray(upd1.data) ? upd1.data.length : upd1.data ? 1 : 0
    if (upd1.error || rowsAffected === 0) {
      showToast(
        upd1.error?.message ?? 'Could not mark this stage complete. Try again or contact the office.',
        'error',
      )
      return
    }
    await recordAction(step.id, 'completed')

    // Check if next step is rejected and reopen it
    const nextStep = await findNextStep(step)
    if (nextStep && nextStep.status === 'rejected') {
      // Clear the notice and rejection reason from current step if they were set
      if (step.next_step_rejected_notice) {
        await supabase.from('project_workflow_steps').update({
          next_step_rejected_notice: null,
          next_step_rejection_reason: null,
        }).eq('id', step.id)
      }
      // Reopen the rejected next step
      await supabase.from('project_workflow_steps').update({
        status: 'pending',
        rejection_reason: null,
        ended_at: null,
      }).eq('id', nextStep.id)
      await recordAction(nextStep.id, 'reopened', 'Previous step was re-completed')
    }

    await loadAssignedSteps()
  }

  async function markApproved(step: AssignedStep) {
    const approvedByName = await getCurrentUserName()
    const approvedAt = new Date().toISOString()
    await supabase.from('project_workflow_steps').update({
      status: 'approved',
      ended_at: approvedAt,
      approved_by: approvedByName,
      approved_at: approvedAt,
    }).eq('id', step.id)
    await recordAction(step.id, 'approved')

    // Check if next step is rejected and reopen it
    const nextStep = await findNextStep(step)
    if (nextStep && nextStep.status === 'rejected') {
      // Clear the notice and rejection reason from current step if they were set
      if (step.next_step_rejected_notice) {
        await supabase.from('project_workflow_steps').update({
          next_step_rejected_notice: null,
          next_step_rejection_reason: null,
        }).eq('id', step.id)
      }
      // Reopen the rejected next step
      await supabase.from('project_workflow_steps').update({
        status: 'pending',
        rejection_reason: null,
        ended_at: null,
      }).eq('id', nextStep.id)
      await recordAction(nextStep.id, 'reopened', 'Previous step was re-approved')
    }

    await loadAssignedSteps()
  }

  async function submitReject() {
    if (!rejectStep) return
    await supabase.from('project_workflow_steps').update({
      status: 'rejected',
      rejection_reason: rejectStep.reason.trim() || null,
      ended_at: new Date().toISOString(),
    }).eq('id', rejectStep.step.id)
    await recordAction(rejectStep.step.id, 'rejected', rejectStep.reason.trim() || null)

    // Find previous step and reopen it if it's completed/approved, or set notice if already pending/in_progress
    const previousStep = await findPreviousStep(rejectStep.step)
    const rejectionReason = rejectStep.reason.trim() || null
    if (previousStep) {
      if (previousStep.status === 'completed' || previousStep.status === 'approved') {
        // Reopen the previous step with notice and rejection reason
        await supabase.from('project_workflow_steps').update({
          status: 'pending',
          ended_at: null,
          approved_by: null,
          approved_at: null,
          next_step_rejected_notice: rejectStep.step.name,
          next_step_rejection_reason: rejectionReason,
        }).eq('id', previousStep.id)
        await recordAction(previousStep.id, 'reopened', `Next step "${rejectStep.step.name}" was rejected`)
      } else if (previousStep.status === 'pending' || previousStep.status === 'in_progress') {
        // Previous step is already pending/in_progress, just set the notice and rejection reason
        await supabase.from('project_workflow_steps').update({
          next_step_rejected_notice: rejectStep.step.name,
          next_step_rejection_reason: rejectionReason,
        }).eq('id', previousStep.id)
      }
    }

    setRejectStep(null)
    await loadAssignedSteps()
  }

  async function submitSkip() {
    if (!skipStep || !skipStep.reason.trim()) return
    await supabase.from('project_workflow_steps').update({
      status: 'skipped',
      skipped_reason: skipStep.reason.trim(),
      ended_at: new Date().toISOString(),
    }).eq('id', skipStep.step.id)
    await recordAction(skipStep.step.id, 'skipped', skipStep.reason.trim())
    setSkipStep(null)
    await loadAssignedSteps()
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
              Assigned Stages ({assignedSteps.length})
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
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
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
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Skip stage: {skipStep.step.name}</h3>
            <label style={{ display: 'block', marginBottom: 4 }}>Why is this stage being skipped?</label>
            <textarea
              value={skipStep.reason}
              onChange={(e) => setSkipStep((r) => r ? { ...r, reason: e.target.value } : null)}
              rows={4}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
              placeholder="e.g. Client waived inspection, combined with prior stage, not applicable..."
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
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
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
              Subscribed Stages ({subscribedSteps.length})
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
