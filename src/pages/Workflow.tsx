import { useEffect, useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToastContext } from '../contexts/ToastContext'
import { useEditProjectModal } from '../contexts/EditProjectModalContext'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { canCreateJobsLedgerRow } from '../lib/jobsLedgerCreateRole'
import { formatProjectNumberLabel } from '../lib/projectNumberLabel'
import {
  addInvoiceToStep as addInvoiceToStepRow,
  addPOToStep as addPOToStepRow,
  deleteLineItemRow,
  importPastedLineItems,
  loadFinalizedPOOptions,
  loadInvoiceDetail,
  loadPODetail,
  loadSupplyHouseInvoiceOptions,
  saveLineItem as saveLineItemRow,
  type AvailableInvoiceOption,
  type AvailablePOOption,
  type InvoiceDetail,
  type PODetail,
} from '../lib/projectsForecastStageLineItems'
import { getStepStatusStyle } from '../lib/workflow/stepStatusStyle'
import { useProjectSuperintendents } from '../hooks/useProjectSuperintendents'
import { WorkflowSuperintendentsStrip } from '../components/workflow/WorkflowSuperintendentsStrip'
import { useProjectJobs } from '../hooks/useProjectJobs'
import { useWorkflowProjections } from '../hooks/useWorkflowProjections'
import { WorkflowJobsStrip } from '../components/workflow/WorkflowJobsStrip'
import { WorkflowSubsStrip } from '../components/workflow/WorkflowSubsStrip'
import { WorkflowLineItemModals } from '../components/workflow/WorkflowLineItemModals'
import { WorkflowFinancialsPanel } from '../components/workflow/WorkflowFinancialsPanel'
import { WorkflowStepLifecycleModals, type ExpectedDatesWindow } from '../components/workflow/WorkflowStepLifecycleModals'
import { WorkflowStagesList } from '../components/workflow/WorkflowStagesList'
import { useWorkflowTemplates } from '../hooks/useWorkflowTemplates'
import { isStepEmpty as isStepEmptyOf } from '../lib/workflow/stageCardDefaults'
import { seedExpectedDates } from '../lib/workflow/expectedDatesLinkage'
import { planStepTransition } from '../lib/workflow/stepLifecycle'
import { buildProjectSubRoster } from '../lib/workflow/projectSubRoster'
import { notifyAssignedDefaultsOnAssign, NOTIFY_ASSIGNED_ALL_ON } from '../lib/workflow/stepAssignment'
import { useWorkflowRoster } from '../hooks/useWorkflowRoster'
import { useWorkflowStepsEngine } from '../hooks/useWorkflowStepsEngine'
import { useWorkflowStepWrites } from '../hooks/useWorkflowStepWrites'
import { StepFormModal } from '../components/workflow/StepFormModal'
import type { PersonContactInfo } from '../components/workflow/PersonDisplayWithContact'
import { toDatetimeLocal, fromDatetimeLocal } from '../utils/datetimeLocal'
import type { Database } from '../types/database'
import { telHrefFor } from '../lib/phoneContact'

type Step = Database['public']['Tables']['project_workflow_steps']['Row']
type Workflow = Database['public']['Tables']['project_workflows']['Row']
type LineItem = Database['public']['Tables']['workflow_step_line_items']['Row']

export default function Workflow() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const editProjectModal = useEditProjectModal()
  const { user: authUser } = useAuth()
  const rosterApi = useWorkflowRoster(authUser?.id)
  const { userRole, currentUserName, roster, subIdentity } = rosterApi
  const engine = useWorkflowStepsEngine({ projectId, authUserId: authUser?.id, userRole, currentUserName })
  const {
    project,
    workflow,
    setWorkflow,
    steps,
    setSteps,
    loading,
    error,
    setError,
    lineItems,
    ensureWorkflow,
    loadProject,
    loadLineItemsForSteps,
    refreshSteps,
    executeLifecyclePlan,
    findPreviousStep,
  } = engine
  const { showToast } = useToastContext()

  const [stepForm, setStepForm] = useState<{ open: boolean; step: Step | null; depends_on_step_id?: string | null; insertAfterStepId?: string | null }>({ open: false, step: null })
  const [rejectStep, setRejectStep] = useState<{ step: Step; reason: string } | null>(null)
  const [skipStep, setSkipStep] = useState<{ step: Step; reason: string } | null>(null)
  const [setStartStep, setSetStartStep] = useState<{ step: Step; startDateTime: string } | null>(null)
  const [assignPersonStep, setAssignPersonStep] = useState<Step | null>(null)
  const [assignPersonFilter, setAssignPersonFilter] = useState('')
  const [personContactModal, setPersonContactModal] = useState<PersonContactInfo | null>(null)
  const [expectedDatesStep, setExpectedDatesStep] = useState<ExpectedDatesWindow | null>(null)

  const [editingLineItem, setEditingLineItem] = useState<{
    stepId: string
    item: LineItem | null
    link: string
    memo: string
    amount: string
    itemDate: string
  } | null>(null)
  const [confirmDeleteLineItem, setConfirmDeleteLineItem] = useState<{ item: LineItem; stepName: string } | null>(null)
  const [confirmDeleteStep, setConfirmDeleteStep] = useState<Step | null>(null)
  const [deleteStepConfirmText, setDeleteStepConfirmText] = useState('')
  const [viewingPO, setViewingPO] = useState<PODetail | null>(null)
  const [addingPOToStep, setAddingPOToStep] = useState<string | null>(null)
  const [availablePOs, setAvailablePOs] = useState<AvailablePOOption[]>([])
  const [addingInvoiceToStep, setAddingInvoiceToStep] = useState<string | null>(null)
  const [availableInvoices, setAvailableInvoices] = useState<AvailableInvoiceOption[]>([])
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceDetail | null>(null)
  const [rowCollapsed, setRowCollapsed] = useState<Record<string, boolean>>({})
  const [oldStagesCollapsed, setOldStagesCollapsed] = useState(false)
  const stepWrites = useWorkflowStepWrites(engine, { authUserId: authUser?.id, showToast, onApproved: onStepApproved })
  const { markStarted, deleteStep, assignPerson } = stepWrites

  const canManageStages = userRole === 'dev' || userRole === 'master_technician' || isAssistantLike(userRole) || userRole === 'superintendent'
  const isDevOrMaster = userRole === 'dev' || userRole === 'master_technician'
  const canSeePrivateNotesAndApprove = userRole === 'dev' || userRole === 'master_technician' || isAssistantLike(userRole) || userRole === 'superintendent'
  const canAssignSuperintendents = userRole === 'dev' || userRole === 'master_technician' || isAssistantLike(userRole)
  const projectionsApi =
    useWorkflowProjections({ workflowId: workflow?.id, projectId, userRole, ensureWorkflow, onError: setError })
  const { projections, editingProjection, setEditingProjection, openEditProjection, saveProjection, deleteProjection } = projectionsApi
  const templatesApi = useWorkflowTemplates(engine, projectId)
  const superintendents = useProjectSuperintendents(projectId, canAssignSuperintendents, setError)
  // "+ Create Job" was a dead door for superintendents (v2.2848): the jobs_ledger INSERT policy refuses them.
  const canCreateJobs = canCreateJobsLedgerRow(userRole)
  const projectJobs = useProjectJobs(projectId)

  function isStepEmpty(step: Step): boolean {
    return isStepEmptyOf(step, lineItems[step.id]?.length ?? 0)
  }

  async function loadFinalizedPOs() {
    if (userRole !== 'dev' && userRole !== 'master_technician') return
    const { options, error } = await loadFinalizedPOOptions()
    if (error) {
      console.error('Error loading POs:', error)
      return
    }
    setAvailablePOs(options)
  }

  async function loadSupplyHouseInvoices() {
    if (userRole !== 'dev' && userRole !== 'master_technician') return
    const { options, error } = await loadSupplyHouseInvoiceOptions()
    if (error) {
      console.error('Error loading supply house invoices:', error)
      setAvailableInvoices([])
      return
    }
    setAvailableInvoices(options)
  }

  async function loadPODetails(poId: string) {
    const { detail, error } = await loadPODetail(poId)
    if (error || !detail) {
      setError(error)
      return
    }
    setViewingPO(detail)
  }

  async function loadInvoiceDetails(invoiceId: string) {
    const { detail, error } = await loadInvoiceDetail(invoiceId)
    if (error || !detail) {
      setError(error)
      return
    }
    setViewingInvoice(detail)
  }

  // After a line-item write: the steps, then the line items for the roles that see them.
  async function reloadAfterLineItemWrite() {
    await refreshSteps()
    if (steps.length > 0 && (userRole === 'dev' || userRole === 'master_technician' || isAssistantLike(userRole) || userRole === 'superintendent')) {
      const stepIds = steps.map(s => s.id)
      await loadLineItemsForSteps(stepIds)
    }
  }

  async function addPOToStep(stepId: string, poId: string) {
    setError(null)
    const error = await addPOToStepRow(stepId, poId, lineItems[stepId] || [])
    if (error) {
      setError(error)
    } else {
      setAddingPOToStep(null)
      await reloadAfterLineItemWrite()
    }
  }

  async function addInvoiceToStep(stepId: string, invoiceId: string) {
    setError(null)
    const error = await addInvoiceToStepRow(stepId, invoiceId, lineItems[stepId] || [])
    if (error) {
      setError(error)
    } else {
      setAddingInvoiceToStep(null)
      await reloadAfterLineItemWrite()
    }
  }

  // Load finalized purchase orders and supply house invoices for adding to steps (staggered to run after projections)
  useEffect(() => {
    if (userRole === 'dev' || userRole === 'master_technician') {
      const t = setTimeout(() => {
        loadFinalizedPOs()
        loadSupplyHouseInvoices()
      }, 200)
      return () => clearTimeout(t)
    }
  }, [userRole])

  // Scroll to step when steps are loaded and hash is present
  useEffect(() => {
    if (steps.length > 0 && !loading) {
      const hash = window.location.hash
      if (hash && hash.startsWith('#step-')) {
        setTimeout(() => {
          const element = document.getElementById(hash.substring(1))
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 100)
      }
    }
  }, [steps, loading])

  async function openAddStep(insertAfterStepId?: string) {
    setStepForm({ open: true, step: null, insertAfterStepId: insertAfterStepId ?? null })
  }

  async function openEditStep(step: Step) {
    const { data: deps } = await supabase.from('workflow_step_dependencies').select('depends_on_step_id').eq('step_id', step.id).limit(1)
    const depends_on_step_id = (deps as { depends_on_step_id: string }[] | null)?.[0]?.depends_on_step_id ?? null
    setStepForm({ open: true, step, depends_on_step_id })
  }

  function closeStepForm() {
    setStepForm({ open: false, step: null, insertAfterStepId: null })
  }

  async function copyStep(step: Step) {
    // Ensure we have a workflow_id - fetch from DB if state isn't ready
    let workflowId: string | null = workflow?.id ?? null
    if (!workflowId && projectId) {
      workflowId = await ensureWorkflow(projectId)
    }
    if (!workflowId) {
      setError('Workflow not found. Please refresh the page.')
      return
    }
    // Find the current step's position
    const currentStep = steps.find((s) => s.id === step.id)
    if (!currentStep) return
    
    // Calculate new sequence_order (insert after current step)
    const newOrder = currentStep.sequence_order + 1
    
    // Increment sequence_order for all steps that come after
    const stepsToUpdate = steps.filter((s) => s.sequence_order >= newOrder)
    for (const s of stepsToUpdate) {
      await supabase
        .from('project_workflow_steps')
        .update({ sequence_order: s.sequence_order + 1 })
        .eq('id', s.id)
    }
    
    // Create new step with copied data (but reset status and timestamps)
    const { data: newStep, error: err } = await supabase
      .from('project_workflow_steps')
      .insert({
        workflow_id: workflowId,
        sequence_order: newOrder,
        name: step.name,
        assigned_to_name: step.assigned_to_name,
        ...(step.assigned_person_id ? { assigned_person_id: step.assigned_person_id } : {}),
        step_type: step.step_type,
        assigned_skill: step.assigned_skill,
        status: 'pending', // Reset status for copy
        started_at: null, // Reset timestamps for copy
        ended_at: null,
        notes: step.notes,
        // Don't copy private_notes, inspection_notes, rejection_reason
      })
      .select('id')
      .single()
    
    if (err || !newStep) {
      setError(err?.message || 'Failed to copy step')
      return
    }
    
    // Copy dependencies if any
    if (step.id) {
      const { data: deps } = await supabase
        .from('workflow_step_dependencies')
        .select('depends_on_step_id')
        .eq('step_id', step.id)
      
      if (deps && deps.length > 0) {
        for (const dep of deps) {
          await supabase
            .from('workflow_step_dependencies')
            .insert({
              step_id: (newStep as { id: string }).id,
              depends_on_step_id: dep.depends_on_step_id,
            })
        }
      }
    }
    
    await refreshSteps()
    closeStepForm()
  }

  async function saveStep(p: { name: string; assigned_to_name: string; assigned_person_id?: string | null; started_at: string | null; ended_at: string | null; depends_on_step_id?: string | null; insertAfterStepId?: string | null }) {
    // Ensure we have a workflow_id - fetch from DB if state isn't ready
    let workflowId: string | null = workflow?.id ?? null
    if (!workflowId && projectId) {
      workflowId = await ensureWorkflow(projectId)
      console.log(`saveStep: Using workflow_id ${workflowId} from ensureWorkflow for project ${projectId}`)
      // Ensure workflow state matches the returned workflow_id
      if (workflowId && workflow?.id !== workflowId) {
        // State might be out of sync, reload workflow to ensure consistency
        const { data: wf } = await supabase.from('project_workflows').select('*').eq('id', workflowId).single()
        if (wf) {
          setWorkflow(wf as Workflow)
          console.log(`saveStep: Updated workflow state to match workflow_id ${workflowId}`)
        }
      }
    } else {
      console.log(`saveStep: Using workflow_id ${workflowId} from state for project ${projectId}`)
    }
    if (!workflowId) {
      setError('Workflow not found. Please refresh the page.')
      return
    }
    setError(null)
    if (stepForm.step) {
      const { error: upErr } = await supabase.from('project_workflow_steps').update({
        name: p.name.trim(),
        assigned_to_name: p.assigned_to_name.trim() || null,
        // Only write an explicitly picked id — omitting the field lets the
        // set_assigned_person_id_on_write trigger resolve from the name, and
        // an explicit null would strip an id the trigger could re-derive.
        ...(p.assigned_person_id ? { assigned_person_id: p.assigned_person_id } : {}),
        // First assignee → notify toggles on (J31-4 P2, v2.2900); reassignments keep the office's choice.
        ...(notifyAssignedDefaultsOnAssign(stepForm.step.assigned_to_name, p.assigned_to_name) ?? {}),
        started_at: p.started_at,
        ended_at: p.ended_at,
      }).eq('id', stepForm.step.id)
      if (upErr) {
        setError(upErr.message)
        return
      }
      const { error: delDepsErr } = await supabase.from('workflow_step_dependencies').delete().eq('step_id', stepForm.step.id)
      if (delDepsErr) {
        setError(delDepsErr.message)
        return
      }
      if (p.depends_on_step_id) {
        const { error: insDepErr } = await supabase.from('workflow_step_dependencies').insert({ step_id: stepForm.step.id, depends_on_step_id: p.depends_on_step_id })
        if (insDepErr) {
          setError(insDepErr.message)
          return
        }
      }
    } else {
      // Calculate sequence_order based on insertAfterStepId
      let newOrder: number
      if (p.insertAfterStepId === '__beginning__') {
        // Add at the beginning
        newOrder = 1
        // Increment sequence_order for all existing steps
        for (const s of steps) {
          const { error: bumpErr } = await supabase
            .from('project_workflow_steps')
            .update({ sequence_order: s.sequence_order + 1 })
            .eq('id', s.id)
          if (bumpErr) {
            setError(bumpErr.message)
            return
          }
        }
      } else if (p.insertAfterStepId) {
        const afterStep = steps.find((s) => s.id === p.insertAfterStepId)
        if (afterStep) {
          newOrder = afterStep.sequence_order + 1
          // Increment sequence_order for all steps that come after
          const stepsToUpdate = steps.filter((s) => s.sequence_order >= newOrder)
          for (const s of stepsToUpdate) {
            const { error: bumpErr } = await supabase
              .from('project_workflow_steps')
              .update({ sequence_order: s.sequence_order + 1 })
              .eq('id', s.id)
            if (bumpErr) {
              setError(bumpErr.message)
              return
            }
          }
        } else {
          // Fallback to end if step not found
          const maxOrder = steps.length === 0 ? 0 : Math.max(...steps.map((s) => s.sequence_order))
          newOrder = maxOrder + 1
        }
      } else {
        // Add at the end
        const maxOrder = steps.length === 0 ? 0 : Math.max(...steps.map((s) => s.sequence_order))
        newOrder = maxOrder + 1
      }
      
      console.log(`saveStep: Inserting step "${p.name.trim()}" with workflow_id ${workflowId}`)
      const { data: inserted, error: insErr } = await supabase.from('project_workflow_steps').insert({
        workflow_id: workflowId,
        sequence_order: newOrder,
        name: p.name.trim(),
        assigned_to_name: p.assigned_to_name.trim() || null,
        ...(p.assigned_person_id ? { assigned_person_id: p.assigned_person_id } : {}),
        started_at: p.started_at,
        ended_at: p.ended_at,
        status: 'pending',
        // New steps start with the assignee notify toggles on (J31-4 P2, v2.2900) —
        // the DB default is false, which meant a fresh assignment nudged nobody.
        ...NOTIFY_ASSIGNED_ALL_ON,
      }).select('id')
      if (insErr) {
        setError(`Failed to insert step: ${insErr.message}`)
        return
      }
      if (inserted && inserted.length > 0) {
        const firstInserted = inserted[0] as { id: string }
        console.log(`saveStep: Step inserted with ID ${firstInserted.id} for workflow_id ${workflowId}`)
      }
    }
    const refreshErr = await refreshSteps()
    if (refreshErr) {
      setError(`Step saved but failed to refresh: ${refreshErr}`)
    } else {
      closeStepForm()
    }
  }

  async function submitSetStart() {
    if (!setStartStep) return
    await markStarted(setStartStep.step, setStartStep.startDateTime)
    setSetStartStep(null)
  }

  function openExpectedDates(step: Step) {
    const seed = seedExpectedDates(steps, step)
    setExpectedDatesStep({
      step,
      expectedStart: seed.expectedStart,
      expectedEnd: seed.expectedEnd,
      lengthDays: seed.lengthDays,
      updateNextStage: seed.hasNextStage,
      hasNextStage: seed.hasNextStage,
      seededFromPrior: seed.seededFromPrior,
    })
  }

  async function submitExpectedDates() {
    if (!expectedDatesStep) return
    const { step, expectedStart, expectedEnd, updateNextStage } = expectedDatesStep
    const startVal = expectedStart.trim() || null
    const endVal = expectedEnd.trim() || null

    const { error } = await supabase
      .from('project_workflow_steps')
      .update({
        scheduled_start_date: startVal,
        scheduled_end_date: endVal,
      })
      .eq('id', step.id)
    if (error) {
      showToast(`Failed to save expected dates: ${error.message}`, 'error')
      return
    }

    setSteps((prev) =>
      prev.map((s) =>
        s.id === step.id
          ? { ...s, scheduled_start_date: startVal, scheduled_end_date: endVal }
          : s
      )
    )

    const idx = steps.findIndex((s) => s.id === step.id)
    const nextStep = idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : null
    if (updateNextStage && endVal && nextStep) {
      const { error: nextError } = await supabase
        .from('project_workflow_steps')
        .update({ scheduled_start_date: endVal })
        .eq('id', nextStep.id)
      if (nextError) {
        showToast(`Saved this step; failed to update next step: ${nextError.message}`, 'error')
      } else {
        setSteps((prev) =>
          prev.map((s) =>
            s.id === nextStep.id ? { ...s, scheduled_start_date: endVal } : s
          )
        )
      }
    }

    setExpectedDatesStep(null)
  }

  async function clearExpectedDates() {
    if (!expectedDatesStep) return
    const { step } = expectedDatesStep
    const { error } = await supabase
      .from('project_workflow_steps')
      .update({ scheduled_start_date: null, scheduled_end_date: null })
      .eq('id', step.id)
    if (error) {
      showToast(`Failed to clear expected dates: ${error.message}`, 'error')
      return
    }
    setSteps((prev) =>
      prev.map((s) =>
        s.id === step.id
          ? { ...s, scheduled_start_date: null, scheduled_end_date: null }
          : s
      )
    )
    setExpectedDatesStep(null)
  }

  async function saveLineItem(stepId: string, item: LineItem | null, link: string, memo: string, amount: string, itemDate: string) {
    const error = await saveLineItemRow({ stepId, item, link, memo, amount, itemDate, existing: lineItems[stepId] || [] })
    if (error) {
      setError(error)
      return
    }
    setEditingLineItem(null)
    // Reload line items to ensure UI updates for assistants
    await reloadAfterLineItemWrite()
  }

  async function importLineItemsFromPaste(stepId: string, text: string) {
    const error = await importPastedLineItems(stepId, text, lineItems[stepId] || [])
    if (error) {
      setError(error)
      return
    }
    setEditingLineItem(null)
    setError(null)
    await reloadAfterLineItemWrite()
  }

  async function deleteLineItem(itemId: string) {
    const error = await deleteLineItemRow(itemId)
    if (error) {
      setError(error)
    } else {
      // Reload line items to ensure UI updates for assistants
      await reloadAfterLineItemWrite()
    }
  }

  function openEditLineItem(stepId: string, item: LineItem | null) {
    setEditingLineItem({
      stepId,
      item,
      link: item?.link || '',
      memo: item?.memo || '',
      amount: item?.amount?.toString() || '',
      itemDate: item?.item_date ? String(item.item_date).slice(0, 10) : '',
    })
  }

  async function submitReject() {
    if (!rejectStep) return
    const previousStep = findPreviousStep(rejectStep.step)
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
    if (ok) await refreshSteps()
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
    if (ok) await refreshSteps()
  }

  // v2.1189: after approving, tuck this card away and take the user to the
  // next stage — collapse the approved card (explicit, in case it was
  // manually expanded), expand the next card (pending defaults collapsed),
  // and scroll it into view once the refreshed list has painted.
  function onStepApproved(step: Step, nextStep: Step | null) {
    setRowCollapsed((prev) => ({
      ...prev,
      [step.id]: true,
      ...(nextStep ? { [nextStep.id]: false } : {}),
    }))
    if (nextStep) {
      const nextStepId = nextStep.id
      window.setTimeout(() => {
        document.getElementById(`step-${nextStepId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 120)
    }
  }

  // The picker closes first, then the assignment runs (optimistic, reverted on a refusal).
  function assignPersonFromPicker(step: Step, name: string | null, personId?: string | null) {
    setAssignPersonStep(null)
    return assignPerson(step, name, personId)
  }

  const projectSubRoster = useMemo(
    () => buildProjectSubRoster(steps, subIdentity.ids, subIdentity.namesLower),
    [steps, subIdentity],
  )

  if (loading) return <p>Loading...</p>
  if (error) return <p style={{ color: 'var(--text-red-700)' }}>{error}</p>
  if (!project || !workflow) return <p>Project or workflow not found.</p>

  return (
    <div className="workflow">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <Link to="/projects">{"\u2190"} Projects</Link>
        <button
          type="button"
          onClick={() => {
            editProjectModal?.openEditProjectModal(project.id, {
              onSaved: () => {
                void loadProject(project.id)
              },
              onDeleted: () => navigate('/projects'),
            })
          }}
          style={{
            fontSize: '0.875rem',
            padding: '0.25rem 0.5rem',
            background: 'var(--bg-blue-tint)',
            color: 'var(--text-blue-700)',
            borderRadius: 4,
            textDecoration: 'none',
            fontWeight: 500,
            display: 'inline-block',
            border: 'none',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          {formatProjectNumberLabel(project.project_number)
            ? `${formatProjectNumberLabel(project.project_number)} \u00b7 ${project.name}`
            : `Project: ${project.name}`}
        </button>
      </div>
      <div style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ marginBottom: '0.5rem' }}>{project.name}{" \u2013 "}Workflow</h1>
            {canAssignSuperintendents && (
              <WorkflowSuperintendentsStrip
                projectSuperintendents={superintendents.projectSuperintendents}
                allSuperintendents={superintendents.allSuperintendents}
                saving={superintendents.saving}
                onAdd={superintendents.addProjectSuperintendent}
                onRemove={superintendents.removeProjectSuperintendent}
              />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
            <WorkflowJobsStrip projectId={projectId} projectJobs={projectJobs} canCreateJobs={canCreateJobs} />
            {canManageStages && projectSubRoster.length > 0 && (
              <WorkflowSubsStrip entries={projectSubRoster} />
            )}
            {canManageStages && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {(steps.filter(s => s.status === 'completed' || s.status === 'approved' || s.status === 'skipped').length >= 2) && (
                  <button
                    type="button"
                    onClick={() => setOldStagesCollapsed(v => !v)}
                    className="wf-btn-ghost"
                    style={{ fontSize: '0.8125rem' }}
                  >
                    {oldStagesCollapsed ? 'Show Old Steps' : 'Hide Old Steps'}
                  </button>
                )}
                <button type="button" onClick={() => openAddStep()} className="wf-btn-primary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                  Add step
                </button>
              </span>
            )}
          </div>
        </div>
        {steps.length > 0 && (
          <div
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              marginTop: '0.5rem',
              overflowWrap: 'break-word',
              paddingBottom: '0.25rem',
              lineHeight: 1.4,
            }}
          >
            <span>
            {steps.map((s, i) => {
              const { color, fontWeight } = getStepStatusStyle(s.status)
              const scrollToStep = () => {
                const element = document.getElementById(`step-${s.id}`)
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              }
              return (
                <span key={s.id}>
                  <span
                    onClick={scrollToStep}
                    style={{ color, fontWeight, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {s.name}
                  </span>
                  {i < steps.length - 1 && <span> → </span>}
                </span>
              )
            })}
            </span>
          </div>
        )}
      </div>

      {/* Projections + Ledger - Summary bar and unified table */}
      {(isDevOrMaster || canManageStages) && (
        <WorkflowFinancialsPanel
          projections={projections}
          steps={steps}
          lineItems={lineItems}
          isDevOrMaster={isDevOrMaster}
          canManageStages={canManageStages}
          onAddProjection={() => openEditProjection(null)}
          onEditProjection={openEditProjection}
          onDeleteProjection={deleteProjection}
        />
      )}

      <WorkflowStagesList
        engine={engine}
        writes={stepWrites}
        projections={projectionsApi}
        roster={rosterApi}
        templates={templatesApi}
        project={project}
        canManageStages={canManageStages}
        canSeePrivateNotesAndApprove={canSeePrivateNotesAndApprove}
        isDevOrMaster={isDevOrMaster}
        oldStagesCollapsed={oldStagesCollapsed}
        setOldStagesCollapsed={setOldStagesCollapsed}
        rowCollapsed={rowCollapsed}
        setRowCollapsed={setRowCollapsed}
        openAddStep={openAddStep}
        openEditStep={openEditStep}
        openExpectedDates={openExpectedDates}
        setAssignPersonStep={setAssignPersonStep}
        setRejectStep={setRejectStep}
        setSkipStep={setSkipStep}
        setSetStartStep={setSetStartStep}
        setConfirmDeleteStep={setConfirmDeleteStep}
        setDeleteStepConfirmText={setDeleteStepConfirmText}
        setPersonContactModal={setPersonContactModal}
        openEditLineItem={openEditLineItem}
        setConfirmDeleteLineItem={setConfirmDeleteLineItem}
        setAddingPOToStep={setAddingPOToStep}
        setAddingInvoiceToStep={setAddingInvoiceToStep}
        loadPODetails={loadPODetails}
        loadInvoiceDetails={loadInvoiceDetails}
        availablePOs={availablePOs}
        availableInvoices={availableInvoices}
      />

      {stepForm.open && (
        <StepFormModal
          viewerRole={userRole}
          step={stepForm.step}
          dependsOnStepId={stepForm.depends_on_step_id ?? null}
          insertAfterStepId={stepForm.insertAfterStepId ?? null}
          steps={steps}
          onSave={saveStep}
          onClose={closeStepForm}
          onCopy={stepForm.step ? () => copyStep(stepForm.step!) : undefined}
          toDatetimeLocal={toDatetimeLocal}
          fromDatetimeLocal={fromDatetimeLocal}
        />
      )}

      <WorkflowStepLifecycleModals
        confirmDeleteStep={confirmDeleteStep}
        setConfirmDeleteStep={setConfirmDeleteStep}
        deleteStepConfirmText={deleteStepConfirmText}
        setDeleteStepConfirmText={setDeleteStepConfirmText}
        isStepEmpty={isStepEmpty}
        deleteStep={deleteStep}
        rejectStep={rejectStep}
        setRejectStep={setRejectStep}
        submitReject={submitReject}
        skipStep={skipStep}
        setSkipStep={setSkipStep}
        submitSkip={submitSkip}
        setStartStep={setStartStep}
        setSetStartStep={setSetStartStep}
        submitSetStart={submitSetStart}
        expectedDatesStep={expectedDatesStep}
        setExpectedDatesStep={setExpectedDatesStep}
        submitExpectedDates={submitExpectedDates}
        clearExpectedDates={clearExpectedDates}
        assignPersonStep={assignPersonStep}
        setAssignPersonStep={setAssignPersonStep}
        assignPersonFilter={assignPersonFilter}
        setAssignPersonFilter={setAssignPersonFilter}
        assignPersonFromPicker={assignPersonFromPicker}
        roster={roster}
        currentUserName={currentUserName}
      />

      {editingProjection && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>{editingProjection.item ? 'Edit' : 'Add'} Projection</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveProjection(editingProjection.item, editingProjection.stage_name, editingProjection.memo, editingProjection.amount, {
                  step_id: editingProjection.step_id,
                  placement: editingProjection.placement,
                })
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="projection-stage" style={{ display: 'block', marginBottom: 4 }}>Label *</label>
                <input
                  id="projection-stage"
                  type="text"
                  value={editingProjection.stage_name}
                  onChange={(e) => setEditingProjection({ ...editingProjection, stage_name: e.target.value })}
                  required
                  placeholder="e.g. Rough In, Trim, Inspection"
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="projection-step" style={{ display: 'block', marginBottom: 4 }}>Attach to step (optional)</label>
                <select
                  id="projection-step"
                  value={editingProjection.step_id}
                  onChange={(e) => setEditingProjection({ ...editingProjection, step_id: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="">Not attached (top panel only)</option>
                  {[...steps].sort((a, b) => a.sequence_order - b.sequence_order).map((st) => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
                {editingProjection.step_id ? (
                  <div style={{ display: 'flex', gap: '1rem', marginTop: 8, fontSize: '0.875rem' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="projection-placement"
                        checked={editingProjection.placement === 'before'}
                        onChange={() => setEditingProjection({ ...editingProjection, placement: 'before' })}
                      />
                      Before the step
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="projection-placement"
                        checked={editingProjection.placement === 'after'}
                        onChange={() => setEditingProjection({ ...editingProjection, placement: 'after' })}
                      />
                      After the step
                    </label>
                  </div>
                ) : null}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="projection-memo" style={{ display: 'block', marginBottom: 4 }}>Memo *</label>
                <input
                  id="projection-memo"
                  type="text"
                  value={editingProjection.memo}
                  onChange={(e) => setEditingProjection({ ...editingProjection, memo: e.target.value })}
                  required
                  placeholder="e.g. Materials, Labor, Equipment"
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="projection-amount" style={{ display: 'block', marginBottom: 4 }}>Amount *</label>
                <input
                  id="projection-amount"
                  type="number"
                  step="0.01"
                  value={editingProjection.amount}
                  onChange={(e) => setEditingProjection({ ...editingProjection, amount: e.target.value })}
                  required
                  placeholder="0.00 (negative allowed)"
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="wf-btn-modal-primary">Save</button>
                <button type="button" onClick={() => setEditingProjection(null)} className="wf-btn-modal-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <WorkflowLineItemModals
        confirmDeleteLineItem={confirmDeleteLineItem}
        onDeleteLineItem={deleteLineItem}
        onCloseDeleteLineItem={() => setConfirmDeleteLineItem(null)}
        editingLineItem={editingLineItem}
        onChangeEditingLineItem={setEditingLineItem}
        onSaveLineItem={saveLineItem}
        onImportPastedLineItems={importLineItemsFromPaste}
        onError={setError}
        addingPOToStep={addingPOToStep}
        availablePOs={availablePOs}
        onAddPOToStep={addPOToStep}
        onCloseAddPO={() => setAddingPOToStep(null)}
        addingInvoiceToStep={addingInvoiceToStep}
        availableInvoices={availableInvoices}
        onAddInvoiceToStep={addInvoiceToStep}
        onCloseAddInvoice={() => setAddingInvoiceToStep(null)}
        viewingPO={viewingPO}
        onCloseViewPO={() => setViewingPO(null)}
        viewingInvoice={viewingInvoice}
        onCloseViewInvoice={() => setViewingInvoice(null)}
      />

      {/* Person Contact Info Modal */}
      {personContactModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Contact information for ${personContactModal.name}`}
          onClick={() => setPersonContactModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: '90%' }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '0.25rem' }}>{personContactModal.name}</h3>
            {!personContactModal.isUser && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Not a user</div>
            )}
            <div style={{ fontSize: '0.9375rem', display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>Email:</span>
                {personContactModal.email ? (
                  <a href={`mailto:${personContactModal.email}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                    {personContactModal.email}
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-faint)' }}>—</span>
                )}
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>Phone:</span>
                {personContactModal.phone ? (
                  <a href={telHrefFor(personContactModal.phone)} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                    {personContactModal.phone}
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-faint)' }}>—</span>
                )}
              </div>
              {!personContactModal.email && !personContactModal.phone && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  No contact information on file.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setPersonContactModal(null)}
                className="wf-btn-modal-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
