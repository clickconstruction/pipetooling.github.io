import { useEffect, useState, useMemo, type ReactNode } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { parsePercentCompleteInput } from '../lib/parsePercentCompleteInput'
import { useAuth } from '../hooks/useAuth'
import { useToastContext } from '../contexts/ToastContext'
import { useEditProjectModal } from '../contexts/EditProjectModalContext'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { canCreateJobsLedgerRow } from '../lib/jobsLedgerCreateRole'
import { formatProjectNumberLabel } from '../lib/projectNumberLabel'
import { buildWorkflowMoneyFlow, type WorkflowMoneyMarker } from '../lib/workflowMoneyFlow'
import {
  balanceColor,
  formatSignedWholeDollars as railAmount,
  itemsTotalByStep,
  ledgerTotalForSteps,
  sumAmounts,
  workflowMoneyTotals,
} from '../lib/workflowMoneyTotals'
import {
  addInvoiceToStep as addInvoiceToStepRow,
  addPOToStep as addPOToStepRow,
  deleteLineItemRow,
  formatLineItemDate,
  importPastedLineItems,
  loadFinalizedPOOptions,
  loadInvoiceDetail,
  loadPODetail,
  loadSupplyHouseInvoiceOptions,
  normalizeUrl,
  saveLineItem as saveLineItemRow,
  type AvailableInvoiceOption,
  type AvailablePOOption,
  type InvoiceDetail,
  type PODetail,
} from '../lib/projectsForecastStageLineItems'
import {
  daysBetween,
  daysOpen,
  expectedDueState,
  formatAmount,
  formatDateShort,
  formatDatetime,
  formatScheduledDateShort,
} from '../lib/workflow/workflowFormat'
import { getStepStatusStyle } from '../lib/workflow/stepStatusStyle'
import { useProjectSuperintendents } from '../hooks/useProjectSuperintendents'
import { WorkflowSuperintendentsStrip } from '../components/workflow/WorkflowSuperintendentsStrip'
import { useProjectJobs } from '../hooks/useProjectJobs'
import { useWorkflowProjections, type WorkflowProjection as Projection } from '../hooks/useWorkflowProjections'
import { WorkflowJobsStrip } from '../components/workflow/WorkflowJobsStrip'
import { WorkflowSubsStrip } from '../components/workflow/WorkflowSubsStrip'
import { WorkflowLineItemModals } from '../components/workflow/WorkflowLineItemModals'
import { WorkflowFinancialsPanel } from '../components/workflow/WorkflowFinancialsPanel'
import { WorkflowStepLifecycleModals, type ExpectedDatesWindow } from '../components/workflow/WorkflowStepLifecycleModals'
import { isRowDefaultCollapsed, isSectionDefaultExpanded, isStepEmpty as isStepEmptyOf } from '../lib/workflow/stageCardDefaults'
import { buildStageDisplayItems } from '../lib/workflow/stageDisplayItems'
import { stageCardPills, wordCount } from '../lib/workflow/stageCardPills'
import { seedExpectedDates } from '../lib/workflow/expectedDatesLinkage'
import { planStepTransition } from '../lib/workflow/stepLifecycle'
import { buildProjectSubRoster } from '../lib/workflow/projectSubRoster'
import { notifyAssignedDefaultsOnAssign, NOTIFY_ASSIGNED_ALL_ON } from '../lib/workflow/stepAssignment'
import { useWorkflowRoster } from '../hooks/useWorkflowRoster'
import { useWorkflowStepsEngine } from '../hooks/useWorkflowStepsEngine'
import { useWorkflowStepWrites } from '../hooks/useWorkflowStepWrites'
import { StepCommitmentPanel } from '../components/workflow/StepCommitmentPanel'
import { StepFormModal } from '../components/workflow/StepFormModal'
import { PersonDisplayWithContact, type PersonContactInfo } from '../components/workflow/PersonDisplayWithContact'
import { toDatetimeLocal, fromDatetimeLocal } from '../utils/datetimeLocal'
import { ymdDaysBetween, ymdFromDateLike } from '../utils/dateUtils'
import { ageChipStyle } from '../lib/ageState'
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
  const { userRole, currentUserName, roster, userNames, personContacts, subIdentity } = useWorkflowRoster(authUser?.id)
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
    stepActions,
    userSubscriptions,
    commitmentsByStep,
    commitmentPaymentsByLaborJobId,
    ensureWorkflow,
    loadProject,
    loadLineItemsForSteps,
    loadCommitmentsForSteps,
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

  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false)
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
  /** Inline money markers (v2.1194): projection ids whose between-card row is expanded. */
  const [expandedProjectionIds, setExpandedProjectionIds] = useState<Set<string>>(new Set())
  /** Ledger rail (v2.1195): the left balance column needs real horizontal room. */
  const [wideForLedger, setWideForLedger] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1100)
  useEffect(() => {
    const onResize = () => setWideForLedger(window.innerWidth >= 1100)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>({})
  const [rowCollapsed, setRowCollapsed] = useState<Record<string, boolean>>({})
  const [oldStagesCollapsed, setOldStagesCollapsed] = useState(false)
  const {
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
  } = useWorkflowStepWrites(engine, { authUserId: authUser?.id, showToast, onApproved: onStepApproved })

  const canManageStages = userRole === 'dev' || userRole === 'master_technician' || isAssistantLike(userRole) || userRole === 'superintendent'
  const isDevOrMaster = userRole === 'dev' || userRole === 'master_technician'
  const canSeePrivateNotesAndApprove = userRole === 'dev' || userRole === 'master_technician' || isAssistantLike(userRole) || userRole === 'superintendent'
  const canAssignSuperintendents = userRole === 'dev' || userRole === 'master_technician' || isAssistantLike(userRole)
  const { projections, editingProjection, setEditingProjection, openEditProjection, saveProjection, deleteProjection } =
    useWorkflowProjections({ workflowId: workflow?.id, projectId, userRole, ensureWorkflow, onError: setError })
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

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('workflow_templates').select('id, name').order('name')
      setTemplates((data as { id: string; name: string }[]) ?? [])
    })()
  }, [])

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

  async function createFromTemplate() {
    if (!selectedTemplateId) return
    // Ensure we have a workflow_id - fetch from DB if state isn't ready
    let workflowId: string | null = workflow?.id ?? null
    if (!workflowId && projectId) {
      workflowId = await ensureWorkflow(projectId)
    }
    if (!workflowId) {
      setError('Workflow not found. Please refresh the page.')
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'center' }}>
        {steps.length === 0 ? (
          <div>
            {canManageStages ? (
              <>
                <p style={{ marginBottom: '1rem' }}>No steps yet. Add a step or create from a template.</p>
                {templates.length > 0 && (
                  <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 8, marginBottom: '1rem', maxWidth: 400 }}>
                    <strong style={{ display: 'block', marginBottom: 8 }}>Create from template</strong>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        style={{ padding: '0.5rem', flex: 1, minWidth: 160 }}
                      >
                        <option value="">Select a template</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={createFromTemplate}
                        disabled={!selectedTemplateId || creatingFromTemplate}
                        title={!selectedTemplateId ? 'Select a template' : undefined}
                        className="wf-btn-primary"
                      >
                        {creatingFromTemplate ? 'Creating...' : 'Create from template'}
                      </button>
                      {!selectedTemplateId && !creatingFromTemplate && (
                        <span style={{ fontSize: '0.8rem', color: '#FF6600', marginLeft: '0.5rem' }}>Select a template</span>
                      )}
                    </div>
                  </div>
                )}
                <p>Or <button type="button" onClick={() => openAddStep()} className="wf-btn-link">add a step</button> to build from scratch.</p>
              </>
            ) : (
              <p style={{ marginBottom: '1rem' }}>No steps assigned to you in this workflow.</p>
            )}
          </div>
        ) : (() => {
          const displayItems = buildStageDisplayItems(steps, oldStagesCollapsed)
          // Money flow (v2.1194): projections anchored to steps render as inline
          // markers with running projected/spent totals. Dev/master only — same
          // visibility as the top Projections panel.
          const orderedStepIds = [...steps].sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0)).map((st) => st.id)
          const itemsTotalByStepId = itemsTotalByStep(orderedStepIds, lineItems)
          const moneyFlow = isDevOrMaster
            ? buildWorkflowMoneyFlow(orderedStepIds, projections, itemsTotalByStepId)
            : { beforeByStep: {}, afterByStep: {}, stepProjectedTotal: {}, stepBalance: {} }
          // Ledger rail (v2.1195): a left balance column aligned to every card and
          // marker, plus a sticky margin/balance summary. Wide viewports only —
          // narrow screens keep the marker pills.
          const {
            projectionsTotal,
            ledgerTotal,
            marginPct,
            balance: balanceNow,
            hasMoney,
          } = workflowMoneyTotals(sumAmounts(projections), ledgerTotalForSteps(orderedStepIds, itemsTotalByStepId))
          const showLedgerRail = isDevOrMaster && wideForLedger && hasMoney
          const RAIL_W = 150
          const railGutter = (value: number | null) =>
            showLedgerRail ? (
              <div
                style={{
                  width: RAIL_W,
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  textAlign: 'right',
                  paddingRight: 14,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                  color: value == null ? 'var(--text-faint)' : balanceColor(value),
                  borderRight: '2px solid var(--border)',
                  alignSelf: 'stretch',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                }}
              >
                {value == null ? '' : railAmount(value)}
              </div>
            ) : null
          const railRow = (value: number | null, content: ReactNode, centerContent = false, key?: string) =>
            showLedgerRail ? (
              <div key={key} style={{ display: 'flex', width: '100%', alignItems: 'stretch' }}>
                {railGutter(value)}
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: centerContent ? 'center' : 'stretch',
                    justifyContent: 'center',
                  }}
                >
                  {content}
                </div>
              </div>
            ) : (
              content
            )
          const stickyLedgerCard = showLedgerRail ? (
            <div key="ledger-sticky" style={{ alignSelf: 'flex-start', position: 'sticky', top: 60, zIndex: 5, marginBottom: 8 }}>
              <div
                style={{
                  width: RAIL_W - 16,
                  boxSizing: 'border-box',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 8,
                  background: 'var(--surface)',
                  padding: '0.5rem 0.65rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
              >
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Project margin</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: marginPct == null ? 'var(--text-muted)' : balanceColor(marginPct) }}>
                  {marginPct == null ? '—' : `${marginPct.toFixed(1)}%`}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>Balance</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: balanceColor(balanceNow), fontVariantNumeric: 'tabular-nums' }}>
                  {railAmount(balanceNow)}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                  proj {railAmount(projectionsTotal)}
                  <br />
                  spent {railAmount(-ledgerTotal)}
                </div>
              </div>
            </div>
          ) : null
          const renderMoneyMarker = (m: WorkflowMoneyMarker<Projection>) => {
            const p = m.projection
            const expanded = expandedProjectionIds.has(p.id)
            const toggle = () =>
              setExpandedProjectionIds((prev) => {
                const next = new Set(prev)
                if (next.has(p.id)) next.delete(p.id)
                else next.add(p.id)
                return next
              })
            const anchorStep = steps.find((st) => st.id === p.step_id)
            return (
              <div key={p.id} style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '0.25rem' }}>
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={expanded}
                  title="Projection — click for details"
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '0.45rem',
                    maxWidth: 'min(100%, 640px)',
                    padding: '0.2rem 0.6rem',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.8125rem',
                    color: 'var(--text-700)',
                  }}
                >
                  <span aria-hidden style={{ fontWeight: 700, color: 'var(--text-green-700)' }}>$</span>
                  <span style={{ color: 'var(--text-muted)' }}>Projection · {p.memo}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-green-700)', whiteSpace: 'nowrap' }}>{formatAmount(p.amount)}</span>
                  <span style={{ padding: '0.1rem 0.5rem', borderRadius: 999, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', fontSize: '0.6875rem', whiteSpace: 'nowrap' }}>
                    projected to here {formatAmount(m.runningProjected)}
                  </span>
                  <span style={{ padding: '0.1rem 0.5rem', borderRadius: 999, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.6875rem', whiteSpace: 'nowrap' }}>
                    spent {formatAmount(m.runningSpent)}
                  </span>
                  <span aria-hidden style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{expanded ? '▼' : '▶'}</span>
                </button>
                {expanded && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', maxWidth: 'min(100%, 480px)', width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontWeight: 600 }}>
                      <span>{p.stage_name}{p.memo ? ` — ${p.memo}` : ''}</span>
                      <span style={{ color: 'var(--text-green-700)', whiteSpace: 'nowrap' }}>{formatAmount(p.amount)}</span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                      {p.placement === 'before' ? 'before' : 'after'} · {anchorStep?.name ?? 'step'}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: 6 }}>
                      <button type="button" onClick={() => openEditProjection(p)} className="wf-btn-ghost" style={{ fontSize: '0.75rem' }}>Edit</button>
                      <button type="button" onClick={() => deleteProjection(p.id)} className="wf-btn-danger" style={{ fontSize: '0.75rem' }}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            )
          }
          return (<>
          {stickyLedgerCard}
          {displayItems.map((item, index) => {
            if (item.type === 'summary') {
              return (
                <div key="old-stages-summary" id="old-stages-summary">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setOldStagesCollapsed(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setOldStagesCollapsed(false)}
                    style={{
                      padding: '0.5rem 0',
                      marginBottom: '0.25rem',
                      fontSize: '0.8125rem',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    {item.count} previous {item.count === 1 ? 'step' : 'steps'} · Started {formatDateShort(item.firstStarted)}
                  </div>
                </div>
              )
            }
            const s = item.step
            const isCollapsed = rowCollapsed[s.id] ?? isRowDefaultCollapsed(s)
            const stepBal = moneyFlow.stepBalance[s.id]
            const stepBalValue = showLedgerRail && stepBal ? stepBal.projected - stepBal.spent : null
            return (
            <div
              key={s.id}
              id={`step-${s.id}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: showLedgerRail ? 'stretch' : isCollapsed ? 'center' : 'stretch',
                alignSelf: showLedgerRail ? 'stretch' : isCollapsed ? 'center' : 'stretch',
                width: showLedgerRail ? '100%' : isCollapsed ? 'fit-content' : '100%',
              }}
            >
              {(moneyFlow.beforeByStep[s.id] ?? []).map((m) =>
                railRow(m.runningProjected - m.runningSpent, renderMoneyMarker(m), true, `rail-${m.projection.id}`),
              )}
              {railRow(stepBalValue, (
              <div
                style={{
                  border: '1px solid var(--border-sky)',
                  borderRadius: 8,
                  padding: '0.5rem 0.75rem',
                  marginBottom: '0.25rem',
                  background: 'var(--surface)',
                  ...(isCollapsed && { display: 'inline-block', width: 'fit-content', maxWidth: 'min(100%, 520px)', borderLeft: `9px solid ${getStepStatusStyle(s.status).color}` }),
                  ...(!isCollapsed && s.status === 'in_progress' && { background: 'var(--bg-orange-tint)', borderLeft: '4px solid #E87600' }),
                }}
              >
                {(() => {
                  const toggleRow = () => setRowCollapsed((p) => ({ ...p, [s.id]: !(p[s.id] ?? isRowDefaultCollapsed(s)) }))
                  return (
                    <>
                {/* Row 1: Chevron · Title · status · Assigned [Assign] [Notify] */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { if (!(e.target as HTMLElement).closest('button, [data-stop]')) toggleRow() }}
                      onKeyDown={(e) => e.key === 'Enter' && toggleRow()}
                      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: 4, fontSize: '0.8125rem', cursor: 'pointer', ...(isCollapsed && { minWidth: 0 }) }}
                    >
                      <span style={{ fontSize: '0.75rem', minWidth: 16 }}>{isCollapsed ? '\u25B6' : '\u25BC'}</span>
                      <span style={{ fontWeight: isCollapsed ? getStepStatusStyle(s.status).fontWeight : 600, color: isCollapsed ? getStepStatusStyle(s.status).color : 'var(--text-strong)' }}>{s.name}</span>
                      <span style={{ color: 'var(--text-faint)' }}>·</span>
                      <span style={{ color: s.status === 'rejected' ? '#b91c1c' : s.status === 'skipped' ? 'var(--text-muted)' : 'var(--text-700)', fontWeight: s.status === 'rejected' ? 500 : 'normal' }}>
                        {s.status === 'rejected' ? 'Previous work incomplete' : s.status === 'skipped' ? 'Skipped' : s.status}{s.status === 'rejected' && s.rejection_reason ? ` - ${s.rejection_reason}` : ''}{s.status === 'skipped' && s.skipped_reason ? ` - ${s.skipped_reason}` : ''}{s.status === 'in_progress' && (() => {
                          const d = daysOpen(s.started_at, s.ended_at)
                          return d != null ? ` · ${d === 1 ? '1 day' : `${d} days`} open` : null
                        })()}
                      </span>
                      <span style={{ color: 'var(--text-faint)' }}>·</span>
                      <span style={{ color: 'var(--text-700)' }}>
                        <PersonDisplayWithContact name={s.assigned_to_name} contacts={personContacts} userNames={userNames} onOpenContact={setPersonContactModal} />
                      </span>
                      {canManageStages && !isCollapsed && (
                        <button type="button" data-stop onClick={(e) => { e.stopPropagation(); setAssignPersonStep(s) }} className="wf-btn-ghost">Assign</button>
                      )}
                      {((canManageStages || s.assigned_to_name === currentUserName) || (stepActions[s.id]?.length ?? 0) > 0) && !isCollapsed && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                          {(canManageStages || s.assigned_to_name === currentUserName) && (() => {
                            const key = `${s.id}-notify`
                            const defaultExpanded = isSectionDefaultExpanded(s, 'notify')
                            const isExpanded = sectionExpanded[key] ?? defaultExpanded
                            return (
                              <span
                                role="button"
                                tabIndex={0}
                                data-stop
                                onClick={(e) => { e.stopPropagation(); setSectionExpanded((p) => ({ ...p, [key]: !isExpanded })) }}
                                onKeyDown={(e) => e.key === 'Enter' && setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500, cursor: 'pointer', color: 'var(--text-muted)' }}
                              >
                                <span style={{ fontSize: '0.75rem', minWidth: 14 }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                                <span>Notify</span>
                              </span>
                            )
                          })()}
                          {stepActions[s.id] && stepActions[s.id]!.length > 0 && (() => {
                            const key = `${s.id}-actionLedger`
                            const isExpanded = sectionExpanded[key] ?? false
                            const count = stepActions[s.id]!.length
                            return (
                              <span
                                role="button"
                                tabIndex={0}
                                data-stop
                                onClick={(e) => { e.stopPropagation(); setSectionExpanded((p) => ({ ...p, [key]: !isExpanded })) }}
                                onKeyDown={(e) => e.key === 'Enter' && setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500, cursor: 'pointer', color: 'var(--text-muted)' }}
                              >
                                <span style={{ fontSize: '0.75rem', minWidth: 14 }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                                <span>Action Ledger ({count})</span>
                              </span>
                            )
                          })()}
                        </span>
                      )}
                      {isCollapsed && (() => {
                        const pillStyle = { display: 'inline-flex' as const, alignItems: 'center' as const, padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-muted)' }
                        const expectedPillStyle = { ...pillStyle, background: 'var(--bg-blue-tint)', color: '#1e3a8a' }
                        const {
                          itemCount: count,
                          itemsTotal: total,
                          notesWords,
                          privateWords,
                          daysPrefix,
                          hasExpected,
                        } = stageCardPills(s, lineItems[s.id] || [])
                        // Expected dates against today (journey-map #40 / J31-5): a window months
                        // past no longer reads calm blue — red "N days late", amber on the due day.
                        const due = hasExpected ? expectedDueState(s) : null
                        const duePillStyle = due && due.state !== 'fresh'
                          ? { ...pillStyle, ...ageChipStyle(due.state), fontWeight: 600 }
                          : expectedPillStyle
                        return (
                          <div style={{ flexBasis: '100%', minWidth: 0, marginTop: 4, marginLeft: 20, display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', alignSelf: 'flex-start' }}>
                            <span style={pillStyle}>
                              {daysPrefix}{formatDateShort(s.started_at)} → {formatDateShort(s.ended_at)}
                            </span>
                            {hasExpected && (
                              <span style={duePillStyle} title={due?.label ? `Expected start → Expected end · ${due.label}` : 'Expected start → Expected end'}>
                                Exp: {formatScheduledDateShort(s.scheduled_start_date)} → {formatScheduledDateShort(s.scheduled_end_date)}
                                {due?.label ? ` · ${due.label}` : null}
                              </span>
                            )}
                            {canManageStages && count > 0 && (
                              <span style={pillStyle}>
                                {count} {count === 1 ? 'item' : 'items'} · {formatAmount(total)}
                              </span>
                            )}
                            {notesWords > 0 && (
                              <span style={pillStyle}>Notes: {notesWords}</span>
                            )}
                            {canSeePrivateNotesAndApprove && privateWords > 0 && (
                              <span style={pillStyle}>Office: {privateWords}</span>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                {/* Row 2: Action buttons - only visible when expanded and user can act */}
                {((canManageStages || s.assigned_to_name === currentUserName) && !isCollapsed) && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                    {(s.status === 'pending' || s.status === 'in_progress') && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Technician:</span>
                        {s.status === 'pending' && (
                          <button type="button" onClick={() => setSetStartStep({ step: s, startDateTime: toDatetimeLocal(new Date().toISOString()) })} className="wf-btn-info">
                            Set Start
                          </button>
                        )}
                        <button type="button" onClick={() => markCompleted(s)} className="wf-btn-success">
                          Mark Complete
                        </button>
                      </span>
                    )}
                    {canSeePrivateNotesAndApprove && (s.status === 'pending' || s.status === 'in_progress') && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 12, paddingLeft: 12, borderLeft: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Office:</span>
                        <button type="button" onClick={() => markApproved(s)} className="wf-btn-info">
                          Approve
                        </button>
                        <button type="button" onClick={() => setRejectStep({ step: s, reason: '' })} className="wf-btn-danger">
                          Send Back: Previous Work Incomplete
                        </button>
                        <button type="button" onClick={() => setSkipStep({ step: s, reason: '' })} className="wf-btn-secondary" style={{ color: 'var(--text-amber-800)' }}>
                          Skip
                        </button>
                      </span>
                    )}
                    {!isCollapsed && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Start: {formatDateShort(s.started_at)}{' \u00B7 '}End: {formatDateShort(s.ended_at)}
                        {s.status === 'in_progress' ? null : (() => {
                          const d = daysBetween(s.started_at, s.ended_at)
                          return d != null ? ` · open for ${d === 1 ? '1 day' : `${d} days`}` : null
                        })()}
                      </span>
                    )}
                  </div>
                )}
                {/* Row 2b: Expected (planned) start/end - always visible when expanded */}
                {!isCollapsed && (() => {
                  const canEditExpected = canManageStages || s.assigned_to_name === currentUserName
                  const startYmd = ymdFromDateLike(s.scheduled_start_date)
                  const endYmd = ymdFromDateLike(s.scheduled_end_date)
                  const lengthDays = startYmd && endYmd ? ymdDaysBetween(startYmd, endYmd) : null
                  const lengthLabel = lengthDays != null
                    ? lengthDays === 1
                      ? '1 day planned'
                      : `${lengthDays} days planned`
                    : null
                  const linkButtonStyle = {
                    padding: 0,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-link)',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    font: 'inherit',
                  } as const
                  const renderField = (ymd: string, label: string) => {
                    if (ymd) {
                      const text = formatScheduledDateShort(ymd)
                      return canEditExpected ? (
                        <button
                          type="button"
                          onClick={() => openExpectedDates(s)}
                          style={linkButtonStyle}
                          title={`Edit expected ${label}`}
                          aria-label={`Edit expected ${label}`}
                        >
                          {text}
                        </button>
                      ) : (
                        <span>{text}</span>
                      )
                    }
                    return canEditExpected ? (
                      <button
                        type="button"
                        onClick={() => openExpectedDates(s)}
                        style={linkButtonStyle}
                        title={`Set expected ${label}`}
                        aria-label={`Set expected ${label}`}
                      >
                        set
                      </button>
                    ) : (
                      <span>{'\u2014'}</span>
                    )
                  }
                  const due = startYmd || endYmd ? expectedDueState(s) : null
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span style={{ marginLeft: 'auto' }}>
                        Expected: Start {renderField(startYmd, 'start')}
                        {' \u00B7 '}
                        End {renderField(endYmd, 'end')}
                        {lengthLabel ? ` · ${lengthLabel}` : null}
                        {due?.label ? (
                          <span style={{ marginLeft: 4, fontWeight: 600, color: due.state === 'red' ? 'var(--text-red-700)' : 'var(--text-amber-800)' }}>
                            · {due.label}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  )
                })()}
                {/* Row 2c: Percent complete - same edit gate as Expected dates (assignee
                    or manager). Uncontrolled input re-keys off the persisted value so a
                    Forecast Specific edit elsewhere propagates here automatically. Empty
                    field == null in the DB (== "not tracked"). */}
                {!isCollapsed && (() => {
                  const canEditPct = canManageStages || s.assigned_to_name === currentUserName
                  const pct = s.percent_complete ?? null
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Complete:{' '}
                        {canEditPct ? (
                          <>
                            <input
                              key={`pct-workflow-${s.id}-${pct ?? 'null'}`}
                              type="number"
                              // `no-spinner` matches the Forecast Specific gutter cell —
                              // hides the browser's up/down stepper arrows for a quieter
                              // input that fits the small `Complete:` row.
                              className="no-spinner"
                              min={0}
                              max={100}
                              inputMode="numeric"
                              defaultValue={pct == null ? '' : String(pct)}
                              placeholder="—"
                              aria-label={`Percent complete for ${s.name}`}
                              title="Optional 0-100 progress estimate. Leave empty when not tracked."
                              onBlur={(e) => {
                                const next = parsePercentCompleteInput(e.currentTarget.value)
                                if (next === pct) return
                                void updatePercentComplete(s, next)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
                              }}
                              style={{
                                width: '3rem',
                                padding: '0.1rem 0.25rem',
                                fontSize: '0.75rem',
                                textAlign: 'right',
                                border: 'none',
                                borderBottom: '1px solid var(--border-strong)',
                                borderRadius: 0,
                                background: 'transparent',
                                color: 'var(--text-slate-900)',
                              }}
                            />
                            <span style={{ color: 'var(--text-muted)' }}>%</span>
                          </>
                        ) : (
                          <span style={{ color: pct == null ? 'var(--text-slate-400)' : 'var(--text-slate-900)' }}>
                            {pct == null ? '\u2014' : `${pct}%`}
                          </span>
                        )}
                      </span>
                    </div>
                  )
                })()}
                {/* Collapsed body - hidden when collapsed */}
                {!isCollapsed && (
                <>
                {s.next_step_rejected_notice && (s.status === 'pending' || s.status === 'in_progress') && (
                  <div style={{
                    background: '#b91c1c',
                    marginLeft: '-0.75rem',
                    marginRight: '-0.75rem',
                    padding: '0.5rem calc(1.5rem + 0.75rem)',
                    marginBottom: 4,
                    fontSize: '0.8125rem',
                    color: '#ffffff',
                    fontStyle: 'italic',
                    textAlign: 'center',
                  }}>
                    Next stage <strong style={{ textDecoration: 'underline' }}>{s.next_step_rejected_notice}</strong> rejected, this stage must be re-completed.
                    {s.next_step_rejection_reason && (
                      <div style={{ marginTop: 2, fontWeight: 600, fontStyle: 'normal', color: '#ffffff' }}>Reason: {s.next_step_rejection_reason}</div>
                    )}
                  </div>
                )}
                {/* Notify expanded content */}
                {(canManageStages || s.assigned_to_name === currentUserName) && (() => {
                  const key = `${s.id}-notify`
                  const defaultExpanded = isSectionDefaultExpanded(s, 'notify')
                  const isExpanded = sectionExpanded[key] ?? defaultExpanded
                  return isExpanded ? (
                              <>
                      <table style={{ borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', fontWeight: 500 }}></th>
                            {canManageStages && (
                              <th style={{ textAlign: 'center', padding: '0.25rem 0.5rem', fontWeight: 500 }}>ASSIGNED</th>
                            )}
                            <th style={{ textAlign: 'center', padding: '0.25rem 0.5rem', fontWeight: 500 }}>ME</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>started</td>
                            {canManageStages && (
                              <td style={{ padding: '0.25rem 0.5rem', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={!!s.notify_assigned_when_started}
                                  onChange={(e) => updateNotifyAssigned(s, 'notify_assigned_when_started', e.target.checked)}
                                  style={{ cursor: 'pointer' }}
                                />
                              </td>
                            )}
                            <td style={{ padding: '0.25rem 0.5rem', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={!!userSubscriptions[s.id]?.notify_when_started}
                                onChange={(e) => updateNotifyMe(s, 'notify_when_started', e.target.checked)}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>complete</td>
                            {canManageStages && (
                              <td style={{ padding: '0.25rem 0.5rem', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={!!s.notify_assigned_when_complete}
                                  onChange={(e) => updateNotifyAssigned(s, 'notify_assigned_when_complete', e.target.checked)}
                                  style={{ cursor: 'pointer' }}
                                />
                              </td>
                            )}
                            <td style={{ padding: '0.25rem 0.5rem', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={!!userSubscriptions[s.id]?.notify_when_complete}
                                onChange={(e) => updateNotifyMe(s, 'notify_when_complete', e.target.checked)}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>re-opened</td>
                            {canManageStages && (
                              <td style={{ padding: '0.25rem 0.5rem', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={!!s.notify_assigned_when_reopened}
                                  onChange={(e) => updateNotifyAssigned(s, 'notify_assigned_when_reopened', e.target.checked)}
                                  style={{ cursor: 'pointer' }}
                                />
                              </td>
                            )}
                            <td style={{ padding: '0.25rem 0.5rem', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={!!userSubscriptions[s.id]?.notify_when_reopened}
                                onChange={(e) => updateNotifyMe(s, 'notify_when_reopened', e.target.checked)}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      {canManageStages && (
                        <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={s.notify_next_assignee_when_complete_or_approved !== false}
                              onChange={(e) => updateCrossStepNotify(s, 'notify_next_assignee_when_complete_or_approved', e.target.checked)}
                              style={{ cursor: 'pointer' }}
                            />
                            Notify next card assignee when complete or approved
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.25rem' }}>
                            <input
                              type="checkbox"
                              checked={s.notify_prior_assignee_when_rejected !== false}
                              onChange={(e) => updateCrossStepNotify(s, 'notify_prior_assignee_when_rejected', e.target.checked)}
                              style={{ cursor: 'pointer' }}
                            />
                            Notify prior card assignee when marked incomplete
                          </label>
                        </div>
                      )}
                              </>
                    ) : null
                  })()}
                {s.status === 'approved' && s.approved_by && s.approved_at && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-green-600)', marginBottom: 4, fontWeight: 500 }}>
                    Approved by {s.approved_by} on {formatDatetime(s.approved_at)}
                  </div>
                )}
                {stepActions[s.id] && stepActions[s.id]!.length > 0 && (() => {
                  const key = `${s.id}-actionLedger`
                  const isExpanded = sectionExpanded[key] ?? false
                  return isExpanded ? (
                    <div style={{ marginBottom: 4, padding: '0.5rem 0.6rem', background: 'var(--bg-subtle)', borderRadius: 4, border: '1px solid var(--border)' }}>
                      {stepActions[s.id]!.map((action) => (
                        <div key={action.id} style={{ marginBottom: '0.25rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          <span style={{ fontWeight: 500, textTransform: 'capitalize', color: 'var(--text-700)' }}>{action.action_type === 'rejected' ? 'Previous work incomplete' : action.action_type === 'skipped' ? 'Skipped' : action.action_type}</span>
                          {' by '}
                          <span style={{ fontWeight: 500 }}>{action.performed_by}</span>
                          {' on '}
                          <span>{formatDatetime(action.performed_at)}</span>
                          {action.notes && (
                            <div style={{ marginTop: 2, marginLeft: '1rem', fontStyle: 'italic', color: 'var(--text-faint)' }}>
                              {action.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null
                })()}
                <div style={{ marginBottom: 4 }}>
                  {(() => {
                    const key = `${s.id}-notes`
                    const defaultExpanded = isSectionDefaultExpanded(s, 'notes')
                    const stored = sectionExpanded[key]
                    const isExpanded = stored ?? defaultExpanded
                    return (
                      <>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                          onKeyDown={(e) => e.key === 'Enter' && setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 2, fontWeight: 500, cursor: 'pointer', fontSize: '0.8125rem' }}
                        >
                          <span style={{ fontSize: '0.75rem', minWidth: 16 }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                          <span>Notes for Tech ({wordCount(s.notes)} words)</span>
                        </div>
                        {isExpanded && (
                          <textarea
                            id={`notes-${s.id}`}
                            key={`notes-${s.id}-${s.notes ?? ''}`}
                            defaultValue={s.notes ?? ''}
                            onBlur={(e) => updateNotes(s, e.target.value)}
                            placeholder="Add notes (visible to everyone who can see this step, including the assigned technician)"
                            rows={2}
                            style={{ width: '100%', padding: '0.35rem', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 4 }}
                          />
                        )}
                      </>
                    )
                  })()}
                </div>
                {/* Notes for Office - dev/master/assistant/superintendent */}
                {canSeePrivateNotesAndApprove && (
                  <div style={{ marginBottom: 4 }}>
                    {(() => {
                      const key = `${s.id}-privateNotes`
                      const defaultExpanded = isSectionDefaultExpanded(s, 'privateNotes')
                      const isExpanded = sectionExpanded[key] ?? defaultExpanded
                      return (
                        <>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                            onKeyDown={(e) => e.key === 'Enter' && setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 2, fontWeight: 500, color: 'var(--text-sky-700)', cursor: 'pointer', fontSize: '0.8125rem' }}
                          >
                            <span style={{ fontSize: '0.75rem', minWidth: 16, color: 'var(--text-strong)' }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                            <span>Notes for Office ({wordCount(s.private_notes)} words)</span>
                          </div>
                          {isExpanded && (
                            <textarea
                              id={`private-notes-${s.id}`}
                              key={`private-notes-${s.id}-${s.private_notes ?? ''}`}
                              defaultValue={s.private_notes ?? ''}
                              onBlur={(e) => updatePrivateNotes(s, e.target.value)}
                              placeholder="Add private notes visible to masters, assistants, and superintendents..."
                              rows={2}
                              style={{ width: '100%', padding: '0.35rem', fontSize: '0.8125rem', border: '1px solid var(--border-sky)', borderRadius: 4, background: 'var(--surface)' }}
                            />
                          )}
                        </>
                      )
                    })()}
                  </div>
                )}
                
                {/* Money drawer (v2.1194) - dev/master: this step's anchored projections + actual items */}
                {isDevOrMaster && (() => {
                  const key = `${s.id}-money`
                  const isExpanded = sectionExpanded[key] ?? false
                  const beforeProjs = (moneyFlow.beforeByStep[s.id] ?? []).map((m) => m.projection)
                  const afterProjs = (moneyFlow.afterByStep[s.id] ?? []).map((m) => m.projection)
                  const projectedTotal = moneyFlow.stepProjectedTotal[s.id] ?? 0
                  const itemsTotal = itemsTotalByStepId[s.id] ?? 0
                  return (
                    <div style={{ marginBottom: 4 }}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                        onKeyDown={(e) => e.key === 'Enter' && setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 2, cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}>
                          <span style={{ fontSize: '0.75rem', minWidth: 16 }}>{isExpanded ? '▼' : '▶'}</span>
                          <span style={{ fontWeight: 500, color: 'var(--text-green-700)' }}>
                            Money
                            {projectedTotal !== 0 && <> · {formatAmount(projectedTotal)} projected</>}
                            {itemsTotal !== 0 && <> · {formatAmount(itemsTotal)} items</>}
                          </span>
                        </div>
                      </div>
                      {isExpanded && (
                        <div style={{ fontSize: '0.8125rem', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {beforeProjs.length === 0 && afterProjs.length === 0 && (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No projections attached to this step.</div>
                          )}
                          {[...beforeProjs.map((p) => ({ p, tag: 'before' })), ...afterProjs.map((p) => ({ p, tag: 'after' }))].map(({ p, tag }) => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ color: 'var(--text-muted)', width: 42, flexShrink: 0 }}>{tag}</span>
                              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.memo}</span>
                              <span style={{ fontWeight: 600, color: 'var(--text-green-700)', whiteSpace: 'nowrap' }}>{formatAmount(p.amount)}</span>
                              <button type="button" onClick={() => openEditProjection(p)} className="wf-btn-ghost" style={{ fontSize: '0.75rem' }}>Edit</button>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', borderTop: '1px dashed var(--border)', paddingTop: 4, color: 'var(--text-muted)' }}>
                            <span>Line items (actual)</span>
                            <span>{formatAmount(itemsTotal)}</span>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => openEditProjection(null, { step_id: s.id, placement: 'after' })}
                              className="wf-btn-ghost"
                              style={{ fontSize: '0.75rem' }}
                            >
                              + Add projection here
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Sub work orders (step commitments) - RUN_SUBS_PLAN PR 2.2 */}
                {canManageStages && (
                  <StepCommitmentPanel
                    stepId={s.id}
                    stepStatus={s.status}
                    stepName={s.name}
                    stepScheduledStart={s.scheduled_start_date}
                    stepScheduledEnd={s.scheduled_end_date}
                    projectId={project.id}
                    projectName={project.name}
                    offeredByName={currentUserName ?? 'The office'}
                    commitments={commitmentsByStep[s.id] ?? []}
                    paymentsByLaborJobId={commitmentPaymentsByLaborJobId}
                    roster={roster.filter((r): r is { name: string; personId: string } => !!r.personId)}
                    isSuperintendentOnly={userRole === 'superintendent'}
                    onChanged={() => void loadCommitmentsForSteps(steps.map((st) => st.id))}
                    onError={(m) => setError(m)}
                  />
                )}

                {/* Line Items For Office - dev/master/assistant */}
                {canManageStages && (
                  <div style={{ marginBottom: 4 }}>
                    {(() => {
                      const key = `${s.id}-lineItems`
                      const defaultExpanded = isSectionDefaultExpanded(s, 'lineItems')
                      const stored = sectionExpanded[key]
                      const isExpanded = stored ?? defaultExpanded
                      return (
                        <>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                            onKeyDown={(e) => e.key === 'Enter' && setSectionExpanded((p) => ({ ...p, [key]: !isExpanded }))}
                            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 2, cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}>
                              <span style={{ fontSize: '0.75rem', minWidth: 16 }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                              <span style={{ fontWeight: 500, color: 'var(--text-sky-700)' }}>
                                Line Items For Office
                                {!isExpanded && (
                                  <> | {formatAmount((lineItems[s.id] || []).reduce((sum, item) => sum + (item.amount || 0), 0))}</>
                                )}
                              </span>
                            </div>
                          </div>
                          {isExpanded && (
                            <>
                    {(lineItems[s.id] && lineItems[s.id]!.length > 0 ? (
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={{ fontSize: '0.8125rem', background: 'var(--surface)', border: '1px solid var(--border-sky)', borderRadius: 4, overflow: 'hidden', width: 'fit-content' }} onClick={(e) => e.stopPropagation()}>
                        <table style={{ borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', fontWeight: 600, borderBottom: '1px solid var(--border-sky)' }}>Memo</th>
                              <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', fontWeight: 600, borderBottom: '1px solid var(--border-sky)', whiteSpace: 'nowrap' }}>Date</th>
                              <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem', fontWeight: 600, borderBottom: '1px solid var(--border-sky)' }}>Amount</th>
                              <th style={{ width: 1, padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border-sky)' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {lineItems[s.id]!.map((item, idx) => {
                              const isLast = idx === lineItems[s.id]!.length - 1
                              const rowBorder = isLast ? 'none' : '1px solid var(--border-sky)'
                              return (
                              <tr key={item.id}>
                                <td style={{ padding: '0.35rem 0.5rem', borderBottom: rowBorder, verticalAlign: 'middle' }}>
                                  {item.link && item.link.trim() && normalizeUrl(item.link) ? (
                                    <a
                                      href={normalizeUrl(item.link)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ color: 'var(--text-link)', textDecoration: 'underline' }}
                                      title={item.link}
                                    >
                                      {item.memo}
                                    </a>
                                  ) : (
                                    <span>{item.memo}</span>
                                  )}
                                </td>
                                <td style={{ padding: '0.35rem 0.5rem', borderBottom: rowBorder, verticalAlign: 'middle', fontSize: '0.8125rem', color: 'var(--text-600)', whiteSpace: 'nowrap' }}>
                                  {formatLineItemDate(item.item_date)}
                                </td>
                                <td style={{ padding: '0.35rem 0.5rem', borderBottom: rowBorder, textAlign: 'right', color: (item.amount || 0) < 0 ? 'var(--text-red-700)' : 'var(--text-700)', fontWeight: 500, verticalAlign: 'middle' }}>
                                  {formatAmount(item.amount)}
                                </td>
                                <td style={{ padding: '0.35rem 0.5rem', borderBottom: rowBorder, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', gap: '0.2rem', justifyContent: 'flex-end' }}>
                                    {item.purchase_order_id && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); loadPODetails(item.purchase_order_id!) }}
                                        className="wf-btn-secondary wf-btn-secondary-blue"
                                      >
                                        View PO
                                      </button>
                                    )}
                                    {item.supply_house_invoice_id && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); loadInvoiceDetails(item.supply_house_invoice_id!) }}
                                        className="wf-btn-secondary wf-btn-secondary-blue"
                                      >
                                        View Invoice
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); openEditLineItem(s.id, item) }}
                                      title="Edit"
                                      aria-label="Edit"
                                      style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-700)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                        <path d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z"/>
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteLineItem({ item, stepName: s.name }) }}
                                      title="Delete"
                                      aria-label="Delete"
                                      style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-red-800)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                        <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z"/>
                                      </svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )})}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-amber-800)', margin: 0, fontStyle: 'italic', textAlign: 'center' }}>No line items yet. Click "Add Line Item" to add one.</p>
                    ))}
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => openEditLineItem(s.id, null)}
                                  className="wf-btn-success-soft"
                                >
                                  + Add Line Item
                                </button>
                                {availableInvoices.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setAddingInvoiceToStep(s.id)}
                                    className="wf-btn-success-soft"
                                  >
                                    + Add Supply House Invoice
                                  </button>
                                )}
                                {availablePOs.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setAddingPOToStep(s.id)}
                                    className="wf-btn-success-soft"
                                  >
                                    + Add PO
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  {canManageStages && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => openEditStep(s)} className="wf-btn-ghost">Edit</button>
                      <button type="button" onClick={() => { setConfirmDeleteStep(s); setDeleteStepConfirmText('') }} className="wf-btn-danger">Delete</button>
                    </div>
                  )}
                  {(s.status === 'completed' || s.status === 'approved' || s.status === 'rejected' || s.status === 'skipped') && canManageStages && (
                    <button type="button" onClick={() => markReopened(s)} className="wf-btn-ghost">
                      Re-open
                    </button>
                  )}
                </div>
                </>
                )}
                    </>
                  )
                })()}
              </div>
              ), isCollapsed)}
              {(moneyFlow.afterByStep[s.id] ?? []).map((m) =>
                railRow(m.runningProjected - m.runningSpent, renderMoneyMarker(m), true, `rail-${m.projection.id}`),
              )}
              {index < displayItems.length - 1 &&
                railRow(null, <div style={{ textAlign: 'center', marginBottom: '0.15rem', color: 'var(--text-faint)' }}>{"\u2193"}</div>)}
            </div>
            )
          })}
          </>)
        })()
        }
      </div>

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
