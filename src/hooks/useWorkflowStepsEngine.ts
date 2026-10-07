/**
 * The Workflow page's steps engine, data half: the project, its workflow, its
 * steps and everything read beside them (line items, the action ledger, the
 * viewer's own notify subscriptions, sub work orders), the loaders and the two
 * load effects, and the shared helpers the page's writes run through —
 * `refreshSteps`, `recordAction`, `executeLifecyclePlan`, the neighbour
 * finders. Moved verbatim from the page; the page's writes (lifecycle,
 * structure, notes, dates, assignment) still live there and use the setters
 * this returns.
 *
 * Refresh model: no realtime. A write either calls `refreshSteps()` or merges
 * into `steps` through `setSteps`.
 */
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import type { WorkflowViewerRole } from './useWorkflowRoster'
import { isAssistantLike, isSubcontractorLikeRole } from '../lib/subcontractorLikeRole'
import type { StepLifecyclePlan } from '../lib/workflow/stepLifecycle'
import type { StepCommitmentRow } from '../lib/workflow/stepCommitments'
import { sendStepLifecycleNotifications } from '../lib/workflow/stepLifecycleNotifications'

type Step = Database['public']['Tables']['project_workflow_steps']['Row']
type Project = Database['public']['Tables']['projects']['Row']
type Workflow = Database['public']['Tables']['project_workflows']['Row']
type StepAction = Database['public']['Tables']['project_workflow_step_actions']['Row']
type LineItem = Database['public']['Tables']['workflow_step_line_items']['Row']

export type UseWorkflowStepsEngineArgs = {
  projectId: string | undefined
  authUserId: string | undefined
  /** From `useWorkflowRoster`: null until the viewer's row is read. */
  userRole: WorkflowViewerRole | null
  currentUserName: string | null
}

export function useWorkflowStepsEngine({ projectId, authUserId, userRole, currentUserName }: UseWorkflowStepsEngineArgs) {
  const [project, setProject] = useState<Project | null>(null)
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [commitmentsByStep, setCommitmentsByStep] = useState<Record<string, StepCommitmentRow[]>>({})
  const [commitmentPaymentsByLaborJobId, setCommitmentPaymentsByLaborJobId] = useState<Record<string, Array<{ amount: number }>>>({})
  const [userSubscriptions, setUserSubscriptions] = useState<Record<string, { notify_when_started: boolean; notify_when_complete: boolean; notify_when_reopened: boolean }>>({})
  const [stepActions, setStepActions] = useState<Record<string, StepAction[]>>({})
  const [lineItems, setLineItems] = useState<Record<string, LineItem[]>>({})
  /** Set when the project is a GC project (v2.4846): it gets no plumbing workflow, and the page says where it lives. */
  const [gcProjectId, setGcProjectId] = useState<string | null>(null)

  const canManageStages = userRole === 'dev' || userRole === 'master_technician' || isAssistantLike(userRole) || userRole === 'superintendent'

  // Mutex to prevent concurrent ensureWorkflow calls for the same project
  const ensureWorkflowPromises = useRef<Map<string, Promise<string | null>>>(new Map())
  
  // Track which workflow_id we've already loaded steps for to prevent redundant loads
  const lastLoadedWorkflowId = useRef<string | null>(null)

  async function ensureWorkflow(pid: string) {
    // Check if there's already a pending call for this project
    const existingPromise = ensureWorkflowPromises.current.get(pid)
    if (existingPromise) {
      console.log(`Waiting for existing ensureWorkflow call for project ${pid}`)
      return existingPromise
    }
    
    // Create new promise and store it
    const promise = (async (): Promise<string | null> => {
      try {
        // First, try to find existing workflow. A GC project is read alongside (v2.4846): opening one
        // here must not file it as a plumbing job with an empty workflow. RLS shows the gc_projects
        // row to the GC team only, and no other role reaches a GC project's projects row.
        const [{ data: wfs, error: queryError }, { data: gcRow }] = await Promise.all([
          supabase.from('project_workflows').select('*').eq('project_id', pid),
          supabase.from('gc_projects').select('project_id').eq('project_id', pid).maybeSingle(),
        ])
        if (queryError) {
          console.error('Error querying workflows:', queryError)
          setError(`Failed to load workflow: ${queryError.message}`)
          return null
        }
        if (wfs && wfs.length > 0) {
          // Use the first workflow found (should only be one per project)
          const existingWorkflow = wfs[0] as Workflow
          setWorkflow(existingWorkflow)
          console.log(`Found existing workflow ${existingWorkflow.id} for project ${pid}`)
          return existingWorkflow.id
        }
        if (gcRow) {
          setGcProjectId(pid)
          return null
        }
        // No workflow exists, create one
        const { data: proj, error: projError } = await supabase.from('projects').select('name').eq('id', pid).single()
        if (projError) {
          console.error('Error loading project:', projError)
          setError(`Failed to load project: ${projError.message}`)
          return null
        }
        const name = (proj as { name?: string } | null)?.name ? `${(proj as { name: string }).name} workflow` : 'Workflow'
        const { data: inserted, error: insertError } = await supabase.from('project_workflows').insert({ project_id: pid, name, status: 'draft' }).select().single()
        if (insertError) {
          // If insert failed, it might be because another call created it concurrently
          // Query again to find the existing workflow
          console.log(`Insert failed for project ${pid}, querying again:`, insertError.message)
          const { data: wfsRetry, error: retryError } = await supabase.from('project_workflows').select('*').eq('project_id', pid)
          if (retryError) {
            console.error('Error querying workflows on retry:', retryError)
            setError(`Failed to create workflow: ${insertError.message}`)
            return null
          }
          if (wfsRetry && wfsRetry.length > 0) {
            // Found it! Another call must have created it
            const existingWorkflow = wfsRetry[0] as Workflow
            setWorkflow(existingWorkflow)
            console.log(`Found existing workflow ${existingWorkflow.id} for project ${pid} (after insert conflict)`)
            return existingWorkflow.id
          }
          // Still not found, return error
          console.error('Error creating workflow:', insertError)
          setError(`Failed to create workflow: ${insertError.message}`)
          return null
        }
        const w = inserted as Workflow
        setWorkflow(w)
        console.log(`Created new workflow ${w.id} for project ${pid}`)
        return w.id
      } finally {
        // Remove from map when done (success or failure)
        ensureWorkflowPromises.current.delete(pid)
      }
    })()
    
    ensureWorkflowPromises.current.set(pid, promise)
    return promise
  }

  async function loadProject(pid: string): Promise<boolean> {
    const { data, error: e } = await supabase
      .from('projects')
      .select('*')
      .eq('id', pid)
      .single()
    if (e) {
      setError(e.message)
      setLoading(false)
      return false
    }

    const projectData = data as Project
    setProject(projectData)
    return true
  }

  async function loadSteps(wfId: string) {
    console.log(`loadSteps: Loading steps for workflow_id ${wfId}`)
    // Only subcontractors are filtered to assigned steps
    // Assistants see all stages (RLS handles access control via master adoption)
    let query = supabase
      .from('project_workflow_steps')
      .select('*')
      .eq('workflow_id', wfId)
    
    // Only subcontractors are filtered to assigned steps
    // Assistants see all stages (RLS handles access control via master adoption)
    if (isSubcontractorLikeRole(userRole) && currentUserName) {
      query = query.eq('assigned_to_name', currentUserName)
    }
    
    const { data, error: e } = await query.order('sequence_order', { ascending: true })
    if (e) {
      setError(`Failed to load steps: ${e.message}`)
      console.error('Error loading steps:', e)
      return
    }
    const stepData = (data as Step[]) ?? []
    console.log(`Loaded ${stepData.length} steps for workflow ${wfId}`)
    
    // Only subcontractors need this check (assistants see all stages if they have project access)
    if (isSubcontractorLikeRole(userRole) && stepData.length === 0) {
      setError('You do not have access to this workflow. You can only view workflows where you are assigned to at least one step.')
      setSteps([])
      // Track that we've loaded steps for this workflow_id (even if empty)
      lastLoadedWorkflowId.current = wfId
      return
    }
    
    setSteps(stepData)
    
    // Track that we've loaded steps for this workflow_id
    lastLoadedWorkflowId.current = wfId
    
    if (stepData.length > 0) {
      const stepIds = stepData.map((s) => s.id)
      
      // Load user subscriptions for these steps
      if (authUserId) {
        const { data: subs } = await supabase
          .from('step_subscriptions')
          .select('step_id, notify_when_started, notify_when_complete, notify_when_reopened')
          .eq('user_id', authUserId)
          .in('step_id', stepIds)
        if (subs) {
          const subsMap: Record<string, { notify_when_started: boolean; notify_when_complete: boolean; notify_when_reopened: boolean }> = {}
          subs.forEach((sub) => {
            subsMap[sub.step_id] = {
              notify_when_started: sub.notify_when_started ?? false,
              notify_when_complete: sub.notify_when_complete ?? false,
              notify_when_reopened: sub.notify_when_reopened ?? false,
            }
          })
          setUserSubscriptions(subsMap)
        }
      }
      
      // Load actions for these steps (limit to prevent huge result sets)
      const { data: actions } = await supabase
        .from('project_workflow_step_actions')
        .select('*')
        .in('step_id', stepIds)
        .order('performed_at', { ascending: false })
        .limit(100)
      if (actions) {
        const actionsMap: Record<string, StepAction[]> = {}
        actions.forEach((action) => {
          if (action && action.step_id) {
            const stepId = action.step_id
            if (!actionsMap[stepId]) {
              actionsMap[stepId] = []
            }
            actionsMap[stepId].push(action)
          }
        })
        setStepActions(actionsMap)
      }
      
    }
  }

  // Step commitments (RUN_SUBS_PLAN PR 2.2). Fail-soft: before the 2.1
  // migration is pushed the select errors and the panel simply never renders.
  async function loadCommitmentsForSteps(stepIds: string[]) {
    if (!canManageStages) return
    if (stepIds.length === 0) {
      setCommitmentsByStep({})
      return
    }
    const { data, error } = await supabase.from('step_commitments').select('*').in('step_id', stepIds)
    if (error) return
    const rows = (data ?? []) as StepCommitmentRow[]
    const byStep: Record<string, StepCommitmentRow[]> = {}
    const laborJobIds: string[] = []
    rows.forEach((r) => {
      // Sheet-anchored work orders (v2.2785) have no step; the `.in('step_id')` query never returns them.
      if (!r.step_id) return
      ;(byStep[r.step_id] ??= []).push(r)
      if (r.labor_job_id) laborJobIds.push(r.labor_job_id)
    })
    setCommitmentsByStep(byStep)
    if (laborJobIds.length > 0) {
      const { data: pays } = await supabase
        .from('people_labor_job_payments')
        .select('job_id, amount')
        .in('job_id', laborJobIds)
      const byJob: Record<string, Array<{ amount: number }>> = {}
      for (const p of (pays ?? []) as Array<{ job_id: string; amount: number }>) {
        ;(byJob[p.job_id] ??= []).push({ amount: Number(p.amount) })
      }
      setCommitmentPaymentsByLaborJobId(byJob)
    } else {
      setCommitmentPaymentsByLaborJobId({})
    }
  }

  async function loadLineItemsForSteps(stepIds: string[]) {
    if (userRole !== 'dev' && userRole !== 'master_technician' && !isAssistantLike(userRole) && userRole !== 'superintendent') return
    if (stepIds.length === 0) {
      setLineItems({})
      return
    }
    
    try {
      const { data: items, error } = await supabase
        .from('workflow_step_line_items')
        .select('*')
        .in('step_id', stepIds)
        .order('sequence_order', { ascending: true })
      
      if (error) {
        console.error('Error loading line items:', error)
        // Don't show error to user for RLS/permission issues, just log and continue
        if (error.code !== 'PGRST116' && error.message && !error.message.includes('permission')) {
          setError(`Failed to load line items: ${error.message}`)
        }
        setLineItems({})
        return
      }
      
      if (items) {
        const itemsMap: Record<string, LineItem[]> = {}
        items.forEach((item) => {
          if (item && item.step_id) {
            const stepId = item.step_id
            if (!itemsMap[stepId]) {
              itemsMap[stepId] = []
            }
            itemsMap[stepId].push(item as LineItem)
          }
        })
        setLineItems(itemsMap)
      } else {
        setLineItems({})
      }
    } catch (err) {
      console.error('Exception loading line items:', err)
      setLineItems({})
    }
  }

  useEffect(() => {
    if (!projectId) {
      setLoading(false)
      lastLoadedWorkflowId.current = null
      return
    }
    // Skip redundant run: we already have project, workflow, and steps for this project.
    // Exception: subcontractors must re-run when userRole becomes available (filter by assigned steps).
    if (project?.id === projectId && workflow?.id && lastLoadedWorkflowId.current === workflow.id && !isSubcontractorLikeRole(userRole)) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      // Reset tracking when projectId changes (new project = need to load)
      if (project?.id !== projectId) lastLoadedWorkflowId.current = null
      // Run loadProject and ensureWorkflow in parallel (saves ~1 round-trip)
      const [projectOk, wfIdOrNull] = await Promise.all([
        loadProject(projectId),
        workflow?.id ? Promise.resolve(workflow.id) : ensureWorkflow(projectId),
      ])
      if (cancelled) return
      if (!projectOk) return
      const wfId = wfIdOrNull
      if (cancelled) return
      if (!wfId) {
        setLoading(false)
        return
      }
      // Skip loadSteps if we've already loaded for this workflow_id
      if (lastLoadedWorkflowId.current !== wfId) {
        await loadSteps(wfId)
      }
      if (!cancelled) {
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, userRole, currentUserName, workflow?.id])

  // Load line items when steps and userRole are available (staggered to reduce concurrent DB load)
  useEffect(() => {
    if (steps.length > 0 && (userRole === 'dev' || userRole === 'master_technician' || isAssistantLike(userRole) || userRole === 'superintendent')) {
      const stepIds = steps.map(s => s.id)
      const t = setTimeout(() => { loadLineItemsForSteps(stepIds); void loadCommitmentsForSteps(stepIds) }, 50)
      return () => clearTimeout(t)
    } else {
      setLineItems({})
    }
  }, [steps, userRole])

  async function refreshSteps(): Promise<string | null> {
    let workflowId: string | null = workflow?.id ?? null
    if (!workflowId && projectId) {
      workflowId = await ensureWorkflow(projectId)
      console.log(`refreshSteps: Using workflow_id ${workflowId} from ensureWorkflow for project ${projectId}`)
      // Ensure workflow state matches the returned workflow_id
      if (workflowId && workflow?.id !== workflowId) {
        // State might be out of sync, reload workflow to ensure consistency
        const { data: wf } = await supabase.from('project_workflows').select('*').eq('id', workflowId).single()
        if (wf) {
          setWorkflow(wf as Workflow)
          console.log(`refreshSteps: Updated workflow state to match workflow_id ${workflowId}`)
        }
      }
    } else {
      console.log(`refreshSteps: Using workflow_id ${workflowId} from state for project ${projectId}`)
    }
    if (!workflowId) {
      return 'No workflow ID'
    }
    // Force reload by resetting tracking - refreshSteps should always reload
    lastLoadedWorkflowId.current = null
    await loadSteps(workflowId)
    return null
  }

  async function getCurrentUserName(): Promise<string> {
    if (!authUserId) return 'Unknown'
    const { data: userData } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', authUserId)
      .single()
    if (userData) {
      return (userData as { name: string | null; email: string | null }).name || (userData as { name: string | null; email: string | null }).email || 'Unknown'
    }
    return 'Unknown'
  }

  async function recordAction(stepId: string, actionType: 'started' | 'completed' | 'approved' | 'rejected' | 'reopened' | 'skipped', notes?: string | null) {
    const performedBy = await getCurrentUserName()
    const performedAt = new Date().toISOString()
    const { data, error } = await supabase
      .from('project_workflow_step_actions')
      .insert({
        step_id: stepId,
        action_type: actionType,
        performed_by: performedBy,
        performed_at: performedAt,
        notes: notes || null,
      })
      .select()
      .single()
    if (error) {
      console.error('Failed to record step action', actionType, error)
    }
    if (!error && data) {
      // Update local state
      setStepActions((prev) => {
        const current = prev[stepId] || []
        return { ...prev, [stepId]: [data as StepAction, ...current] }
      })
    }
  }

  // Lifecycle notifications live in the shared sender (RUN_SUBS_PLAN PR 0.1);
  // this wrapper pins the page's project/workflow guard and session identity.
  async function sendWorkflowNotifications(
    step: Step,
    actionType: 'started' | 'completed' | 'approved' | 'rejected' | 'reopened'
  ) {
    if (!project || !workflow) return
    await sendStepLifecycleNotifications({
      step,
      actionType,
      projectId: project.id,
      projectName: project.name,
      currentUserId: authUserId ?? null,
    })
  }

  // Run a planned lifecycle transition: sequential column updates (first
  // failure aborts and surfaces), action-ledger rows, then fire-and-forget
  // notifications resolved against the in-memory step objects.
  async function executeLifecyclePlan(plan: StepLifecyclePlan, stepsById: Map<string, Step>): Promise<boolean> {
    for (const u of plan.updates) {
      const { error } = await supabase.from('project_workflow_steps').update(u.update).eq('id', u.stepId)
      if (error) {
        setError(`Failed to update step: ${error.message}`)
        return false
      }
    }
    for (const a of plan.actions) {
      await recordAction(a.stepId, a.actionType, a.notes)
    }
    for (const n of plan.notifications) {
      const s = stepsById.get(n.stepId)
      if (s) void sendWorkflowNotifications({ ...s, ...(n.stepOverrides ?? {}) } as Step, n.actionType)
    }
    return true
  }

  function findPreviousStep(step: Step): Step | null {
    const sortedSteps = [...steps].sort((a, b) => a.sequence_order - b.sequence_order)
    const currentIndex = sortedSteps.findIndex((s) => s.id === step.id)
    return currentIndex > 0 ? (sortedSteps[currentIndex - 1] ?? null) : null
  }

  function findNextStep(step: Step): Step | null {
    const sortedSteps = [...steps].sort((a, b) => a.sequence_order - b.sequence_order)
    const currentIndex = sortedSteps.findIndex((s) => s.id === step.id)
    return currentIndex >= 0 && currentIndex < sortedSteps.length - 1 ? (sortedSteps[currentIndex + 1] ?? null) : null
  }

  return {
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
    setUserSubscriptions,
    commitmentsByStep,
    commitmentPaymentsByLaborJobId,
    ensureWorkflow,
    gcProjectId,
    loadProject,
    loadLineItemsForSteps,
    loadCommitmentsForSteps,
    refreshSteps,
    getCurrentUserName,
    recordAction,
    executeLifecyclePlan,
    findPreviousStep,
    findNextStep,
  }
}

export type WorkflowStepsEngine = ReturnType<typeof useWorkflowStepsEngine>
