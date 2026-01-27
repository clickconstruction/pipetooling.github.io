import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Database } from '../types/database'

type Step = Database['public']['Tables']['project_workflow_steps']['Row']
type StepStatus = Step['status']
type Project = Database['public']['Tables']['projects']['Row']
type Workflow = Database['public']['Tables']['project_workflows']['Row']
type StepAction = Database['public']['Tables']['project_workflow_step_actions']['Row']
type LineItem = Database['public']['Tables']['workflow_step_line_items']['Row']
type Projection = Database['public']['Tables']['workflow_projections']['Row']
type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row']
type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row']
type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type MaterialPart = Database['public']['Tables']['material_parts']['Row']

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  return new Date(v).toISOString()
}

function formatDatetime(iso: string | null): string {
  if (!iso) return 'unknown'
  const date = new Date(iso)
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
  const dateTime = date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  return `${weekday}, ${dateTime}`
}

function formatAmount(amount: number | null | undefined): string {
  const value = amount || 0
  const absValue = Math.abs(value)
  // Format with commas for thousands
  const formatted = absValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (value < 0) {
    return `($${formatted})`
  }
  return `$${formatted}`
}

function PersonDisplayWithContact({ name, contacts, userNames }: { name: string | null; contacts: Record<string, { email: string | null; phone: string | null }>; userNames: Set<string> }) {
  if (!name || !name.trim()) {
    return <span>Assigned to: unknown</span>
  }
  const trimmedName = name.trim()
  const contact = contacts[trimmedName]
  const hasEmail = contact?.email
  const hasPhone = contact?.phone
  const isUser = userNames.has(trimmedName.toLowerCase())
  
  if (!hasEmail && !hasPhone) {
    return (
      <span>
        {trimmedName}
        {!isUser && <span style={{ fontSize: '0.8125rem', color: '#6b7280', marginLeft: '0.25rem' }}>(not a user)</span>}
      </span>
    )
  }
  
  return (
    <span>
      {trimmedName}
      {!isUser && <span style={{ fontSize: '0.8125rem', color: '#6b7280', marginLeft: '0.25rem' }}>(not a user)</span>}
      <span style={{ fontSize: '0.8125rem', color: '#6b7280', marginLeft: '0.5rem' }}>
        {hasEmail && (
          <>
            <a href={`mailto:${contact.email}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
              {contact.email}
            </a>
            {hasPhone && ' \u00B7 '}
          </>
        )}
        {hasPhone && (
          <a href={`tel:${contact.phone}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
            {contact.phone}
          </a>
        )}
      </span>
    </span>
  )
}

export default function Workflow() {
  const { projectId } = useParams()
  const { user: authUser } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [stepForm, setStepForm] = useState<{ open: boolean; step: Step | null; depends_on_step_id?: string | null; insertAfterStepId?: string | null }>({ open: false, step: null })
  const [rejectStep, setRejectStep] = useState<{ step: Step; reason: string } | null>(null)
  const [setStartStep, setSetStartStep] = useState<{ step: Step; startDateTime: string } | null>(null)
  const [assignPersonStep, setAssignPersonStep] = useState<Step | null>(null)
  const [roster, setRoster] = useState<{ name: string }[]>([])
  const [currentUserName, setCurrentUserName] = useState<string | null>(null)
  const [userSubscriptions, setUserSubscriptions] = useState<Record<string, { notify_when_started: boolean; notify_when_complete: boolean; notify_when_reopened: boolean }>>({})
  const [stepActions, setStepActions] = useState<Record<string, StepAction[]>>({})
  const [personContacts, setPersonContacts] = useState<Record<string, { email: string | null; phone: string | null }>>({})
  const [userNames, setUserNames] = useState<Set<string>>(new Set())

  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false)
  const [userRole, setUserRole] = useState<'dev' | 'master_technician' | 'assistant' | 'subcontractor' | null>(null)
  const [lineItems, setLineItems] = useState<Record<string, LineItem[]>>({})
  const [editingLineItem, setEditingLineItem] = useState<{ stepId: string; item: LineItem | null; link: string; memo: string; amount: string } | null>(null)
  const [projections, setProjections] = useState<Projection[]>([])
  const [viewingPO, setViewingPO] = useState<{ id: string; name: string; items: Array<{ part: { name: string }; quantity: number; supply_house: { name: string } | null; price_at_time: number }> } | null>(null)
  const [addingPOToStep, setAddingPOToStep] = useState<string | null>(null)
  const [availablePOs, setAvailablePOs] = useState<Array<{ id: string; name: string; total: number }>>([])
  const [editingProjection, setEditingProjection] = useState<{ item: Projection | null; stage_name: string; memo: string; amount: string } | null>(null)
  const [projectMaster, setProjectMaster] = useState<{ id: string; name: string | null; email: string | null } | null>(null)

  const canManageStages = userRole === 'dev' || userRole === 'master_technician' || userRole === 'assistant'
  const isDevOrMaster = userRole === 'dev' || userRole === 'master_technician'

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
        // First, try to find existing workflow
        const { data: wfs, error: queryError } = await supabase.from('project_workflows').select('*').eq('project_id', pid)
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

  async function loadProject(pid: string) {
    const { data, error: e } = await supabase
      .from('projects')
      .select('*')
      .eq('id', pid)
      .single()
    if (e) {
      setError(e.message)
      setLoading(false)
      return
    }

    const projectData = data as Project
    setProject(projectData)
    
    // Load master information if master_user_id exists
    if (projectData.master_user_id) {
      const { data: masterData } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('id', projectData.master_user_id)
        .single()
      if (masterData) {
        setProjectMaster(masterData as { id: string; name: string | null; email: string | null })
      } else {
        setProjectMaster(null)
      }
    } else {
      setProjectMaster(null)
    }
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
    if (userRole === 'subcontractor' && currentUserName) {
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
    if (userRole === 'subcontractor' && stepData.length === 0) {
      setError('You do not have access to this workflow. You can only view workflows where you are assigned to at least one stage.')
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
      if (authUser?.id) {
        const { data: subs } = await supabase
          .from('step_subscriptions')
          .select('step_id, notify_when_started, notify_when_complete, notify_when_reopened')
          .eq('user_id', authUser.id)
          .in('step_id', stepIds)
        if (subs) {
          const subsMap: Record<string, { notify_when_started: boolean; notify_when_complete: boolean; notify_when_reopened: boolean }> = {}
          subs.forEach((sub) => {
            subsMap[sub.step_id] = {
              notify_when_started: sub.notify_when_started,
              notify_when_complete: sub.notify_when_complete,
              notify_when_reopened: sub.notify_when_reopened,
            }
          })
          setUserSubscriptions(subsMap)
        }
      }
      
      // Load actions for these steps
      const { data: actions } = await supabase
        .from('project_workflow_step_actions')
        .select('*')
        .in('step_id', stepIds)
        .order('performed_at', { ascending: false })
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

  async function loadFinalizedPOs() {
    if (userRole !== 'dev' && userRole !== 'master_technician') return
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('id, name')
      .eq('status', 'finalized')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error loading POs:', error)
      return
    }

    // Calculate totals for each PO
    const posWithTotals = await Promise.all(
      ((data as Array<{ id: string; name: string }>) ?? []).map(async (po) => {
        const { data: items } = await supabase
          .from('purchase_order_items')
          .select('price_at_time, quantity')
          .eq('purchase_order_id', po.id)
        
        const total = (items ?? []).reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0)
        return { ...po, total }
      })
    )

    setAvailablePOs(posWithTotals)
  }

  async function loadPODetails(poId: string) {
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', poId)
      .single()
    
    if (poError) {
      setError(`Failed to load PO: ${poError.message}`)
      return
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select('*, material_parts(*), supply_houses(*)')
      .eq('purchase_order_id', poId)
      .order('sequence_order', { ascending: true })
    
    if (itemsError) {
      setError(`Failed to load PO items: ${itemsError.message}`)
      return
    }

    const items = (itemsData as Array<PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null }>) ?? []
    setViewingPO({
      id: poId,
      name: (poData as PurchaseOrder).name,
      items: items.map(item => ({
        part: { name: item.material_parts.name },
        quantity: item.quantity,
        supply_house: item.supply_houses,
        price_at_time: item.price_at_time,
      })),
    })
  }

  async function addPOToStep(stepId: string, poId: string) {
    setError(null)
    
    // Load PO details to get total
    const { data: itemsData } = await supabase
      .from('purchase_order_items')
      .select('price_at_time, quantity')
      .eq('purchase_order_id', poId)
    
    const total = (itemsData ?? []).reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0)
    
    const { data: poData } = await supabase
      .from('purchase_orders')
      .select('name')
      .eq('id', poId)
      .single()
    
    const poName = (poData as { name: string } | null)?.name || 'Purchase Order'
    const itemCount = itemsData?.length || 0
    
    // Create line item with PO link
    const maxOrder = Math.max(0, ...(lineItems[stepId] || []).map(li => li.sequence_order))
    const { error } = await supabase
      .from('workflow_step_line_items')
      .insert({
        step_id: stepId,
        memo: `PO: ${poName} - ${itemCount} items, $${total.toFixed(2)} total`,
        amount: total,
        sequence_order: maxOrder + 1,
        purchase_order_id: poId,
      })
    
    if (error) {
      setError(`Failed to add PO to step: ${error.message}`)
    } else {
      setAddingPOToStep(null)
      await refreshSteps()
      if (steps.length > 0 && (userRole === 'dev' || userRole === 'master_technician' || userRole === 'assistant')) {
        const stepIds = steps.map(s => s.id)
        await loadLineItemsForSteps(stepIds)
      }
    }
  }

  async function loadLineItemsForSteps(stepIds: string[]) {
    if (userRole !== 'dev' && userRole !== 'master_technician' && userRole !== 'assistant') return
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
    let cancelled = false
    ;(async () => {
      // Reset tracking when projectId changes (new project = need to load)
      lastLoadedWorkflowId.current = null
      await loadProject(projectId)
      if (cancelled) return
      // Use existing workflow state if available, otherwise ensure it exists
      let wfId: string | null = workflow?.id ?? null
      if (!wfId) {
        wfId = await ensureWorkflow(projectId)
      }
      if (cancelled) return
      // Skip loadSteps if we've already loaded for this workflow_id
      if (wfId && lastLoadedWorkflowId.current !== wfId) {
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

  // Load line items when steps and userRole are available
  useEffect(() => {
    if (steps.length > 0 && (userRole === 'dev' || userRole === 'master_technician' || userRole === 'assistant')) {
      const stepIds = steps.map(s => s.id)
      loadLineItemsForSteps(stepIds)
    } else {
      setLineItems({})
    }
  }, [steps, userRole])

  // Load projections when workflow and userRole are available
  useEffect(() => {
    if (workflow?.id && (userRole === 'dev' || userRole === 'master_technician')) {
      loadProjections(workflow.id)
    } else {
      setProjections([])
    }
  }, [workflow?.id, userRole])

  // Load finalized purchase orders for adding to steps
  useEffect(() => {
    if (userRole === 'dev' || userRole === 'master_technician') {
      loadFinalizedPOs()
    }
  }, [userRole])

  async function loadProjections(workflowId: string) {
    if (userRole !== 'dev' && userRole !== 'master_technician') return
    const { data: items, error } = await supabase
      .from('workflow_projections')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('sequence_order', { ascending: true })
    if (error) {
      setError(`Failed to load projections: ${error.message}`)
      return
    }
    if (items) {
      setProjections(items as Projection[])
    }
  }

  async function saveProjection(item: Projection | null, stageName: string, memo: string, amount: string) {
    // Ensure we have a workflow_id - fetch from DB if state isn't ready
    let workflowId: string | null = workflow?.id ?? null
    if (!workflowId && projectId) {
      workflowId = await ensureWorkflow(projectId)
    }
    if (!workflowId) {
      setError('Workflow not found. Please refresh the page.')
      return
    }
    
    const amountNum = parseFloat(amount) || 0
    if (!stageName.trim() || !memo.trim()) {
      setError('Stage name and memo are required')
      return
    }
    
    if (item) {
      // Update existing
      const { error } = await supabase
        .from('workflow_projections')
        .update({ stage_name: stageName.trim(), memo: memo.trim(), amount: amountNum })
        .eq('id', item.id)
      if (error) {
        setError(`Failed to update projection: ${error.message}`)
        return
      }
    } else {
      // Create new
      const maxOrder = Math.max(0, ...projections.map(p => p.sequence_order))
      const { error } = await supabase
        .from('workflow_projections')
        .insert({ workflow_id: workflowId, stage_name: stageName.trim(), memo: memo.trim(), amount: amountNum, sequence_order: maxOrder + 1 })
      if (error) {
        setError(`Failed to insert projection: ${error.message}`)
        return
      }
    }
    setEditingProjection(null)
    await loadProjections(workflowId)
  }

  async function deleteProjection(itemId: string) {
    // Ensure we have a workflow_id - fetch from DB if state isn't ready
    let workflowId: string | null = workflow?.id ?? null
    if (!workflowId && projectId) {
      workflowId = await ensureWorkflow(projectId)
    }
    if (!workflowId) {
      setError('Workflow not found. Please refresh the page.')
      return
    }
    await supabase.from('workflow_projections').delete().eq('id', itemId)
    await loadProjections(workflowId)
  }

  function openEditProjection(item: Projection | null) {
    setEditingProjection({
      item,
      stage_name: item?.stage_name || '',
      memo: item?.memo || '',
      amount: item?.amount?.toString() || '',
    })
  }

  function calculateProjectionsTotal(): number {
    let total = 0
    projections.forEach((p) => {
      total += p.amount || 0
    })
    return total
  }

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

  useEffect(() => {
    if (!authUser?.id) return
    ;(async () => {
      // Load user role and name
      const { data: userData } = await supabase
        .from('users')
        .select('role, name, email')
        .eq('id', authUser.id)
        .single()
      if (userData) {
        setUserRole((userData as { role: 'dev' | 'master_technician' | 'assistant' | 'subcontractor' }).role)
        const userName = (userData as { name: string | null; email: string | null }).name || (userData as { name: string | null; email: string | null }).email
        setCurrentUserName(userName)
      }
      
      const [peopleRes, usersRes] = await Promise.all([
        supabase.from('people').select('name, email, phone').eq('master_user_id', authUser.id).order('name'),
        supabase.from('users').select('name, email'),
      ])
      const fromPeople = (peopleRes.data as { name: string; email: string | null; phone: string | null }[] | null) ?? []
      const fromUsers = (usersRes.data as { name: string; email: string | null }[] | null) ?? []
      const names = [...fromUsers.map((r) => r.name), ...fromPeople.map((r) => r.name)].filter(Boolean).sort()
      setRoster(names.map((name) => ({ name })))
      
      // Build set of user names (case-insensitive comparison)
      const userNamesSet = new Set<string>()
      fromUsers.forEach((u) => {
        if (u.name) {
          userNamesSet.add(u.name.trim().toLowerCase())
        }
      })
      setUserNames(userNamesSet)
      
      // Build contact map
      const contacts: Record<string, { email: string | null; phone: string | null }> = {}
      fromPeople.forEach((p) => {
        if (p.name) {
          contacts[p.name] = { email: p.email, phone: p.phone }
        }
      })
      fromUsers.forEach((u) => {
        if (u.name) {
          // Only set if not already set (people take precedence)
          if (!contacts[u.name]) {
            contacts[u.name] = { email: u.email, phone: null }
          }
        }
      })
      setPersonContacts(contacts)
    })()
  }, [authUser?.id])

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

  // Normalize URL to ensure it has a proper protocol
  function normalizeUrl(url: string | null | undefined): string {
    if (!url) return ''
    const trimmed = url.trim()
    if (!trimmed) return ''
    
    // First, check if URL already has a valid protocol with colon (most common case)
    // This check must come first to avoid double-processing
    if (trimmed.match(/^https?:\/\//i)) {
      return trimmed
    }
    
    // Fix common issues: if https// or http// (missing colon), fix it
    if (trimmed.match(/^https?\/\//i)) {
      // Replace https// with https:// or http// with http://
      return trimmed.replace(/^(https?)\/\//i, '$1://')
    }
    
    // If it starts with //, add https:
    if (trimmed.startsWith('//')) {
      return `https:${trimmed}`
    }
    
    // Otherwise, add https://
    return `https://${trimmed}`
  }

  // Calculate total from all line items
  function calculateLedgerTotal(): number {
    let total = 0
    Object.values(lineItems).forEach((items) => {
      items.forEach((item) => {
        total += item.amount || 0
      })
    })
    return total
  }

  async function getCurrentUserName(): Promise<string> {
    if (!authUser?.id) return 'Unknown'
    const { data: userData } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', authUser.id)
      .single()
    if (userData) {
      return (userData as { name: string | null; email: string | null }).name || (userData as { name: string | null; email: string | null }).email || 'Unknown'
    }
    return 'Unknown'
  }

  async function recordAction(stepId: string, actionType: 'started' | 'completed' | 'approved' | 'rejected' | 'reopened', notes?: string | null) {
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
    if (!error && data) {
      // Update local state
      setStepActions((prev) => {
        const current = prev[stepId] || []
        return { ...prev, [stepId]: [data as StepAction, ...current] }
      })
    }
  }

  async function sendNotification(
    templateType: string,
    step: Step,
    recipientName: string,
    recipientEmail: string,
    additionalVariables?: Record<string, string>
  ) {
    if (!project || !workflow || !recipientEmail) return

    // Build workflow link
    const workflowLink = `${window.location.origin}/workflows/${project.id}#step-${step.id}`

    // Base variables for all workflow notifications
    const variables: Record<string, string> = {
      name: recipientName,
      email: recipientEmail,
      project_name: project.name,
      stage_name: step.name,
      assigned_to_name: step.assigned_to_name || '',
      workflow_link: workflowLink,
      ...additionalVariables,
    }

    try {
      // Debug: Log the function invocation details
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const functionName = 'send-workflow-notification'
      console.log('Invoking Edge Function:', {
        functionName,
        supabaseUrl,
        expectedUrl: `${supabaseUrl}/functions/v1/${functionName}`,
        templateType,
        recipientEmail,
      })

      const { data, error: eFn } = await supabase.functions.invoke('send-workflow-notification', {
        body: {
          template_type: templateType,
          step_id: step.id,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          variables,
        },
      })

      if (eFn) {
        console.error('Failed to send notification:', {
          error: eFn,
          message: eFn.message,
          status: eFn.status,
          details: eFn,
        })
        // Don't show error to user - notifications are best-effort
      } else {
        console.log('Notification sent successfully:', data)
      }
    } catch (error) {
      console.error('Error sending notification:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      // Don't show error to user - notifications are best-effort
    }
  }

  async function sendWorkflowNotifications(
    step: Step,
    actionType: 'started' | 'completed' | 'approved' | 'rejected' | 'reopened'
  ) {
    if (!project) return

    // Get all steps in workflow to find next/previous
    const { data: allSteps } = await supabase
      .from('project_workflow_steps')
      .select('id, sequence_order, name, assigned_to_name')
      .eq('workflow_id', step.workflow_id)
      .order('sequence_order', { ascending: true })

    const sortedSteps = (allSteps as Array<{ id: string; sequence_order: number; name: string; assigned_to_name: string | null }>) || []
    const currentIndex = sortedSteps.findIndex((s) => s.id === step.id)
    const nextStep = currentIndex >= 0 && currentIndex < sortedSteps.length - 1 ? sortedSteps[currentIndex + 1] : null
    const previousStep = currentIndex > 0 ? sortedSteps[currentIndex - 1] : null

    // Get contact info for people
    const getEmailForName = async (name: string | null): Promise<string | null> => {
      if (!name) return null
      const trimmedName = name.trim()
      
      // Check users table first (most reliable)
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('name', trimmedName)
        .maybeSingle()
      if (user?.email) return user.email

      // Check people table (may be limited by RLS, but try anyway)
      const { data: people } = await supabase
        .from('people')
        .select('email')
        .eq('name', trimmedName)
        .limit(1)
      if (people && people.length > 0 && people[0]?.email) {
        return people[0].email
      }

      return null
    }

    // Handle different action types
    if (actionType === 'started') {
      // Notify assigned person if enabled
      if (step.notify_assigned_when_started && step.assigned_to_name) {
        const email = await getEmailForName(step.assigned_to_name)
        if (email) {
          await sendNotification('stage_assigned_started', step, step.assigned_to_name, email)
        }
      }

      // Notify subscribed users (ME)
      if (authUser?.id) {
        const { data: subscriptions } = await supabase
          .from('step_subscriptions')
          .select('user_id, notify_when_started')
          .eq('step_id', step.id)
          .eq('notify_when_started', true)

        if (subscriptions) {
          for (const sub of subscriptions) {
            const { data: user } = await supabase
              .from('users')
              .select('name, email')
              .eq('id', sub.user_id)
              .single()
            if (user?.email) {
              await sendNotification('stage_me_started', step, user.name || user.email, user.email)
            }
          }
        }
      }
    } else if (actionType === 'completed' || actionType === 'approved') {
      // Notify assigned person if enabled
      if (step.notify_assigned_when_complete && step.assigned_to_name) {
        const email = await getEmailForName(step.assigned_to_name)
        if (email) {
          await sendNotification('stage_assigned_complete', step, step.assigned_to_name, email)
        }
      }

      // Notify subscribed users (ME)
      if (authUser?.id) {
        const { data: subscriptions } = await supabase
          .from('step_subscriptions')
          .select('user_id, notify_when_complete')
          .eq('step_id', step.id)
          .eq('notify_when_complete', true)

        if (subscriptions) {
          for (const sub of subscriptions) {
            const { data: user } = await supabase
              .from('users')
              .select('name, email')
              .eq('id', sub.user_id)
              .single()
            if (user?.email) {
              await sendNotification('stage_me_complete', step, user.name || user.email, user.email)
            }
          }
        }
      }

      // Cross-step: Notify next assignee
      if (step.notify_next_assignee_when_complete_or_approved && nextStep?.assigned_to_name) {
        const email = await getEmailForName(nextStep.assigned_to_name)
        if (email) {
          // Create a minimal step object for the notification
          const nextStepForNotification: Step = {
            ...step, // Use current step as base
            id: nextStep.id,
            name: nextStep.name,
            assigned_to_name: nextStep.assigned_to_name,
          } as Step
          await sendNotification(
            'stage_next_complete_or_approved',
            nextStepForNotification,
            nextStep.assigned_to_name,
            email,
            { previous_stage_name: step.name }
          )
        }
      }
    } else if (actionType === 'rejected') {
      // Cross-step: Notify prior assignee
      if (step.notify_prior_assignee_when_rejected && previousStep?.assigned_to_name) {
        const email = await getEmailForName(previousStep.assigned_to_name)
        if (email) {
          // Create a minimal step object for the notification
          const previousStepForNotification: Step = {
            ...step, // Use current step as base
            id: previousStep.id,
            name: previousStep.name,
            assigned_to_name: previousStep.assigned_to_name,
          } as Step
          await sendNotification(
            'stage_prior_rejected',
            previousStepForNotification,
            previousStep.assigned_to_name,
            email,
            {
              previous_stage_name: previousStep.name,
              rejection_reason: step.rejection_reason || '',
            }
          )
        }
      }
    } else if (actionType === 'reopened') {
      // Notify assigned person if enabled
      if (step.notify_assigned_when_reopened && step.assigned_to_name) {
        const email = await getEmailForName(step.assigned_to_name)
        if (email) {
          await sendNotification('stage_assigned_reopened', step, step.assigned_to_name, email)
        }
      }

      // Notify subscribed users (ME)
      if (authUser?.id) {
        const { data: subscriptions } = await supabase
          .from('step_subscriptions')
          .select('user_id, notify_when_reopened')
          .eq('step_id', step.id)
          .eq('notify_when_reopened', true)

        if (subscriptions) {
          for (const sub of subscriptions) {
            const { data: user } = await supabase
              .from('users')
              .select('name, email')
              .eq('id', sub.user_id)
              .single()
            if (user?.email) {
              await sendNotification('stage_me_reopened', step, user.name || user.email, user.email)
            }
          }
        }
      }
    }
  }

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

  async function saveStep(p: { name: string; assigned_to_name: string; started_at: string | null; ended_at: string | null; depends_on_step_id?: string | null; insertAfterStepId?: string | null }) {
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
        started_at: p.started_at,
        ended_at: p.ended_at,
        status: 'pending',
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

  async function updateStepStatus(step: Step, status: StepStatus, extra?: { ended_at?: string | null; rejection_reason?: string | null; approved_by?: string | null; approved_at?: string | null; next_step_rejected_notice?: string | null; next_step_rejection_reason?: string | null }) {
    const up: Record<string, unknown> = { status }
    if (extra?.ended_at !== undefined) up.ended_at = extra.ended_at
    if (extra?.rejection_reason !== undefined) up.rejection_reason = extra.rejection_reason
    if (extra?.approved_by !== undefined) up.approved_by = extra.approved_by
    if (extra?.approved_at !== undefined) up.approved_at = extra.approved_at
    if (extra?.next_step_rejected_notice !== undefined) up.next_step_rejected_notice = extra.next_step_rejected_notice
    if (extra?.next_step_rejection_reason !== undefined) up.next_step_rejection_reason = extra.next_step_rejection_reason
    const { error } = await supabase.from('project_workflow_steps').update(up).eq('id', step.id)
    if (error) {
      setError(`Failed to update step: ${error.message}`)
      return
    }
    await refreshSteps()
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

  async function markStarted(step: Step, startDateTime?: string) {
    const startedAt = startDateTime ? fromDatetimeLocal(startDateTime) : new Date().toISOString()
    await supabase.from('project_workflow_steps').update({ started_at: startedAt, status: 'in_progress' }).eq('id', step.id)
    await recordAction(step.id, 'started')
    // Send notifications (fire and forget - don't block UI)
    void sendWorkflowNotifications(step, 'started')
    await refreshSteps()
  }

  async function submitSetStart() {
    if (!setStartStep) return
    await markStarted(setStartStep.step, setStartStep.startDateTime)
    setSetStartStep(null)
  }

  async function markCompleted(step: Step) {
    await updateStepStatus(step, 'completed', { ended_at: new Date().toISOString() })
    await recordAction(step.id, 'completed')
    // Send notifications (fire and forget - don't block UI)
    void sendWorkflowNotifications(step, 'completed')
    
    // Check if next step is rejected and reopen it
    const nextStep = findNextStep(step)
    if (nextStep && nextStep.status === 'rejected') {
      // Clear the notice and rejection reason from current step if they were set
      if (step.next_step_rejected_notice) {
        await supabase.from('project_workflow_steps').update({ 
          next_step_rejected_notice: null,
          next_step_rejection_reason: null,
        }).eq('id', step.id)
      }
      // Reopen the rejected next step
      await updateStepStatus(nextStep, 'pending', {
        rejection_reason: null,
        ended_at: null,
      })
      await recordAction(nextStep.id, 'reopened', 'Previous step was re-completed')
      // Send notifications for the next step being reopened (fire and forget)
      void sendWorkflowNotifications(nextStep, 'reopened')
    }
    
    await refreshSteps()
  }

  async function markApproved(step: Step) {
    // Get current user's name
    const approvedByName = await getCurrentUserName()
    const approvedAt = new Date().toISOString()
    await updateStepStatus(step, 'approved', { 
      ended_at: approvedAt,
      approved_by: approvedByName,
      approved_at: approvedAt,
    })
    await recordAction(step.id, 'approved')
    // Send notifications (fire and forget - don't block UI)
    void sendWorkflowNotifications(step, 'approved')
    
    // Check if next step is rejected and reopen it
    const nextStep = findNextStep(step)
    if (nextStep && nextStep.status === 'rejected') {
      // Clear the notice and rejection reason from current step if they were set
      if (step.next_step_rejected_notice) {
        await supabase.from('project_workflow_steps').update({ 
          next_step_rejected_notice: null,
          next_step_rejection_reason: null,
        }).eq('id', step.id)
      }
      // Reopen the rejected next step
      await updateStepStatus(nextStep, 'pending', {
        rejection_reason: null,
        ended_at: null,
      })
      await recordAction(nextStep.id, 'reopened', 'Previous step was re-approved')
      // Send notifications for the next step being reopened (fire and forget)
      void sendWorkflowNotifications(nextStep, 'reopened')
    }
    
    await refreshSteps()
  }

  async function markReopened(step: Step) {
    await updateStepStatus(step, 'pending', { 
      ended_at: null,
      rejection_reason: null,
      approved_by: null,
      approved_at: null,
      next_step_rejected_notice: null,
      next_step_rejection_reason: null,
    })
    await recordAction(step.id, 'reopened')
    // Send notifications (fire and forget - don't block UI)
    void sendWorkflowNotifications(step, 'reopened')
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
    if (!authUser?.id) return
    const current = userSubscriptions[step.id]
    const payload = {
      step_id: step.id,
      user_id: authUser.id,
      notify_when_started: field === 'notify_when_started' ? value : (current?.notify_when_started ?? false),
      notify_when_complete: field === 'notify_when_complete' ? value : (current?.notify_when_complete ?? false),
      notify_when_reopened: field === 'notify_when_reopened' ? value : (current?.notify_when_reopened ?? false),
    }
    if (current) {
      await supabase.from('step_subscriptions').update(payload).eq('step_id', step.id).eq('user_id', authUser.id)
    } else {
      await supabase.from('step_subscriptions').insert(payload)
    }
    setUserSubscriptions((prev) => ({ ...prev, [step.id]: payload }))
  }

  async function updateNotes(step: Step, notes: string) {
    const { error } = await supabase.from('project_workflow_steps').update({ notes: notes.trim() || null }).eq('id', step.id)
    if (error) {
      setError(`Failed to update notes: ${error.message}`)
      return
    }
    await refreshSteps()
  }

  async function updatePrivateNotes(step: Step, privateNotes: string) {
    const { error } = await supabase.from('project_workflow_steps').update({ private_notes: privateNotes.trim() || null }).eq('id', step.id)
    if (error) {
      setError(`Failed to update private notes: ${error.message}`)
      return
    }
    await refreshSteps()
  }


  async function saveLineItem(stepId: string, item: LineItem | null, link: string, memo: string, amount: string) {
    const amountNum = parseFloat(amount) || 0
    if (!memo.trim()) {
      setError('Memo is required')
      return
    }
    
    // Validate link format if provided
    const trimmedLink = link.trim()
    let finalLink: string | null = null
    if (trimmedLink) {
      // Use normalizeUrl for consistency with display logic
      const normalized = normalizeUrl(trimmedLink)
      if (normalized && normalized.trim()) {
        finalLink = normalized
      } else {
        setError('Link must be a valid URL')
        return
      }
    }
    
    if (item) {
      // Update existing
      const { error } = await supabase
        .from('workflow_step_line_items')
        .update({ link: finalLink, memo: memo.trim(), amount: amountNum })
        .eq('id', item.id)
      if (error) {
        setError(`Failed to update line item: ${error.message}`)
        return
      }
    } else {
      // Create new
      const maxOrder = Math.max(0, ...(lineItems[stepId] || []).map(li => li.sequence_order))
      const { error } = await supabase
        .from('workflow_step_line_items')
        .insert({ step_id: stepId, link: finalLink, memo: memo.trim(), amount: amountNum, sequence_order: maxOrder + 1 })
      if (error) {
        setError(`Failed to insert line item: ${error.message}`)
        return
      }
    }
    setEditingLineItem(null)
    await refreshSteps()
    // Reload line items to ensure UI updates for assistants
    if (steps.length > 0 && (userRole === 'dev' || userRole === 'master_technician' || userRole === 'assistant')) {
      const stepIds = steps.map(s => s.id)
      await loadLineItemsForSteps(stepIds)
    }
  }

  async function deleteLineItem(itemId: string) {
    const { error } = await supabase.from('workflow_step_line_items').delete().eq('id', itemId)
    if (error) {
      setError(`Failed to delete line item: ${error.message}`)
    } else {
      await refreshSteps()
      // Reload line items to ensure UI updates for assistants
      if (steps.length > 0 && (userRole === 'dev' || userRole === 'master_technician' || userRole === 'assistant')) {
        const stepIds = steps.map(s => s.id)
        await loadLineItemsForSteps(stepIds)
      }
    }
  }

  function openEditLineItem(stepId: string, item: LineItem | null) {
    setEditingLineItem({
      stepId,
      item,
      link: item?.link || '',
      memo: item?.memo || '',
      amount: item?.amount?.toString() || '',
    })
  }

  async function submitReject() {
    if (!rejectStep) return
    await supabase.from('project_workflow_steps').update({
      status: 'rejected',
      rejection_reason: rejectStep.reason.trim() || null,
      ended_at: new Date().toISOString(),
    }).eq('id', rejectStep.step.id)
    await recordAction(rejectStep.step.id, 'rejected', rejectStep.reason.trim() || null)
    
    // Create updated step object with rejection reason for notifications
    const updatedStep = { ...rejectStep.step, rejection_reason: rejectStep.reason.trim() || null }
    // Send notifications (fire and forget - don't block UI)
    void sendWorkflowNotifications(updatedStep, 'rejected')
    
    // Find previous step and reopen it if it's completed/approved, or set notice if already pending/in_progress
    const previousStep = findPreviousStep(rejectStep.step)
    const rejectionReason = rejectStep.reason.trim() || null
    if (previousStep) {
      if (previousStep.status === 'completed' || previousStep.status === 'approved') {
        // Reopen the previous step with notice and rejection reason
        await updateStepStatus(previousStep, 'pending', {
          ended_at: null,
          approved_by: null,
          approved_at: null,
          next_step_rejected_notice: rejectStep.step.name,
          next_step_rejection_reason: rejectionReason,
        })
        await recordAction(previousStep.id, 'reopened', `Next step "${rejectStep.step.name}" was rejected`)
        // Send notifications for the previous step being reopened (fire and forget)
        void sendWorkflowNotifications(previousStep, 'reopened')
      } else if (previousStep.status === 'pending' || previousStep.status === 'in_progress') {
        // Previous step is already pending/in_progress, just set the notice and rejection reason
        await supabase.from('project_workflow_steps').update({ 
          next_step_rejected_notice: rejectStep.step.name,
          next_step_rejection_reason: rejectionReason,
        }).eq('id', previousStep.id)
      }
    }
    
    setRejectStep(null)
    await refreshSteps()
  }

  async function deleteStep(step: Step) {
    if (!confirm('Delete this step?')) return
    setError(null)
    await supabase.from('workflow_step_dependencies').delete().eq('step_id', step.id)
    await supabase.from('workflow_step_dependencies').delete().eq('depends_on_step_id', step.id)
    const { error: delErr } = await supabase.from('project_workflow_steps').delete().eq('id', step.id)
    if (delErr) {
      setError(delErr.message)
      return
    }
    await refreshSteps()
  }

  async function assignPerson(step: Step, name: string | null) {
    const { error: err } = await supabase.from('project_workflow_steps').update({ assigned_to_name: name }).eq('id', step.id)
    if (err) {
      setError(`Failed to assign person: ${err.message}`)
      setAssignPersonStep(null)
      return
    }
    await refreshSteps()
    setAssignPersonStep(null)
  }

  if (loading) return <p>Loading...</p>
  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>
  if (!project || !workflow) return <p>Project or workflow not found.</p>

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/projects">{"\u2190"} Projects</Link>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.5rem' }}>{project.name}{" \u2013 "}Workflow</h1>
          {projectMaster && (
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', fontWeight: 500 }}>
              Project Master: {projectMaster.name || projectMaster.email || 'Unknown'}
            </div>
          )}
          {steps.length > 0 && (
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {steps.map((s, i) => {
                let color = '#6b7280' // default gray
                let fontWeight: 'normal' | 'bold' = 'normal'
                if (s.status === 'completed' || s.status === 'approved') {
                  color = '#059669' // green
                } else if (s.status === 'rejected') {
                  color = '#b91c1c' // red
                } else if (s.status === 'in_progress') {
                  color = '#E87600' // strong orange
                  fontWeight = 'bold' // bold if started but not completed
                }
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
            </div>
          )}
        </div>
        {canManageStages && (
          <button type="button" onClick={() => openAddStep()} style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}>
            Add step
          </button>
        )}
      </div>

      {/* Projections - Only visible to devs and masters */}
      {isDevOrMaster && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8 }}>
          {/* Projections */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: '1.125rem', fontWeight: 600 }}>Projections (Draw Schedule and Change Orders)</h2>
            <button
              type="button"
              onClick={() => openEditProjection(null)}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              + Add Projection
            </button>
          </div>
          {projections.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No projections yet. Click "Add Projection" to add one.</p>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #bae6fd' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 600 }}>Stage</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 600 }}>Memo</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 600 }}>Amount</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem', fontWeight: 600, width: 120 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projections.map((proj) => (
                    <tr key={proj.id} style={{ borderBottom: '1px solid #e0f2fe' }}>
                      <td style={{ padding: '0.5rem', color: '#111827' }}>{proj.stage_name}</td>
                      <td style={{ padding: '0.5rem', color: '#374151' }}>{proj.memo}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', color: (proj.amount || 0) < 0 ? '#b91c1c' : '#111827', fontWeight: 500 }}>
                        {formatAmount(proj.amount)}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => openEditProjection(proj)}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteProjection(proj.id)}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '2px solid #0ea5e9' }}>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: calculateProjectionsTotal() < 0 ? '#b91c1c' : '#111827' }}>
                  Projections Total: {formatAmount(calculateProjectionsTotal())}
                </div>
              </div>
            </>
          )}

          {/* Total Left on Job */}
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            {(() => {
              const left = calculateProjectionsTotal() - calculateLedgerTotal()
              return (
                <div style={{ fontSize: '1rem', fontWeight: 700, color: left < 0 ? '#b91c1c' : '#047857' }}>
                  Total Left on Job: Projections - Ledger = {formatAmount(left)}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Ledger - Visible to devs, masters, and assistants */}
      {canManageStages && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8 }}>
          <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1.125rem', fontWeight: 600 }}>Ledger (Incurred Charges and Payments)</h2>
          {Object.keys(lineItems).length === 0 || Object.values(lineItems).every(items => items.length === 0) ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No line items yet. Add line items in the Private Notes section of each stage.</p>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 600 }}>Stage</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 600 }}>Memo</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 600 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((step) => {
                    const items = lineItems[step.id] || []
                    if (items.length === 0) return null
                    return items.map((item, idx) => (
                      <tr key={item.id} style={{ borderBottom: idx === items.length - 1 ? '2px solid #e5e7eb' : '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.5rem', color: idx === 0 ? '#111827' : '#6b7280', fontWeight: idx === 0 ? 500 : 'normal' }}>
                          {idx === 0 ? step.name : ''}
                        </td>
                        <td style={{ padding: '0.5rem', color: '#374151' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{item.memo}</span>
                            {item.link && (
                              <a
                                href={normalizeUrl(item.link)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#3b82f6', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                                title={item.link}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  const normalizedLink = normalizeUrl(item.link)
                                  if (normalizedLink) {
                                    window.open(normalizedLink, '_blank', 'noopener,noreferrer')
                                  }
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: '14px', height: '14px', fill: 'currentColor' }}>
                                  <path d="M451.5 160C434.9 160 418.8 164.5 404.7 172.7C388.9 156.7 370.5 143.3 350.2 133.2C378.4 109.2 414.3 96 451.5 96C537.9 96 608 166 608 252.5C608 294 591.5 333.8 562.2 363.1L491.1 434.2C461.8 463.5 422 480 380.5 480C294.1 480 224 410 224 323.5C224 322 224 320.5 224.1 319C224.6 301.3 239.3 287.4 257 287.9C274.7 288.4 288.6 303.1 288.1 320.8C288.1 321.7 288.1 322.6 288.1 323.4C288.1 374.5 329.5 415.9 380.6 415.9C405.1 415.9 428.6 406.2 446 388.8L517.1 317.7C534.4 300.4 544.2 276.8 544.2 252.3C544.2 201.2 502.8 159.8 451.7 159.8zM307.2 237.3C305.3 236.5 303.4 235.4 301.7 234.2C289.1 227.7 274.7 224 259.6 224C235.1 224 211.6 233.7 194.2 251.1L123.1 322.2C105.8 339.5 96 363.1 96 387.6C96 438.7 137.4 480.1 188.5 480.1C205 480.1 221.1 475.7 235.2 467.5C251 483.5 269.4 496.9 289.8 507C261.6 530.9 225.8 544.2 188.5 544.2C102.1 544.2 32 474.2 32 387.7C32 346.2 48.5 306.4 77.8 277.1L148.9 206C178.2 176.7 218 160.2 259.5 160.2C346.1 160.2 416 230.8 416 317.1C416 318.4 416 319.7 416 321C415.6 338.7 400.9 352.6 383.2 352.2C365.5 351.8 351.6 337.1 352 319.4C352 318.6 352 317.9 352 317.1C352 283.4 334 253.8 307.2 237.5z"/>
                                </svg>
                              </a>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', color: (item.amount || 0) < 0 ? '#b91c1c' : '#111827', fontWeight: 500 }}>
                          {formatAmount(item.amount)}
                        </td>
                      </tr>
                    ))
                  })}
                </tbody>
              </table>
              {/* Ledger Total - Only visible to devs and masters */}
              {isDevOrMaster && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '2px solid #111827' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: calculateLedgerTotal() < 0 ? '#b91c1c' : '#111827' }}>
                    Ledger Total: {formatAmount(calculateLedgerTotal())}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {steps.length === 0 ? (
          <div>
            {canManageStages ? (
              <>
                <p style={{ marginBottom: '1rem' }}>No steps yet. Add a step or create from a template.</p>
                {templates.length > 0 && (
                  <div style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: '1rem', maxWidth: 400 }}>
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
                        style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}
                      >
                        {creatingFromTemplate ? 'Creating...' : 'Create from template'}
                      </button>
                    </div>
                  </div>
                )}
                <p>Or <button type="button" onClick={() => openAddStep()} style={{ padding: 0, background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', textDecoration: 'underline', font: 'inherit' }}>add a step</button> to build from scratch.</p>
              </>
            ) : (
              <p style={{ marginBottom: '1rem' }}>No stages assigned to you in this workflow.</p>
            )}
          </div>
        ) : (
          steps.map((s, i) => (
            <div key={s.id} id={`step-${s.id}`}>
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: '1rem',
                  marginBottom: '0.25rem',
                  background: s.status === 'rejected' ? '#fef2f2' : s.status === 'approved' || s.status === 'completed' ? '#f0fdf4' : '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: 4 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Stage title */}
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{s.name}</div>
                    <div style={{ fontSize: '0.875rem', color: '#374151', marginBottom: 8 }}>
                      <PersonDisplayWithContact name={s.assigned_to_name} contacts={personContacts} userNames={userNames} />
                    </div>
                    <div style={{ fontSize: '0.875rem', color: s.status === 'rejected' ? '#b91c1c' : '#374151', marginBottom: 8, fontWeight: s.status === 'rejected' ? 500 : 'normal' }}>
                      Status: {s.status}{s.status === 'rejected' && s.rejection_reason ? ` - ${s.rejection_reason}` : ''}
                    </div>
                    {s.next_step_rejected_notice && (s.status === 'pending' || s.status === 'in_progress') && (
                      <div style={{ fontSize: '0.875rem', color: '#E87600', marginBottom: 8, fontStyle: 'italic' }}>
                        (next card rejected: {s.next_step_rejected_notice})
                        {s.next_step_rejection_reason && (
                          <div style={{ marginTop: 4, color: '#b91c1c', fontStyle: 'normal' }}>
                            Reason: {s.next_step_rejection_reason}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions (top-left) */}
                    {(canManageStages || s.assigned_to_name === currentUserName) && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {s.status === 'pending' && (
                          <button type="button" onClick={() => setSetStartStep({ step: s, startDateTime: toDatetimeLocal(new Date().toISOString()) })} style={{ padding: '4px 8px', fontSize: '0.875rem' }}>
                            Set Start
                          </button>
                        )}
                        {(s.status === 'pending' || s.status === 'in_progress') && (
                          <button type="button" onClick={() => markCompleted(s)} style={{ padding: '4px 8px', fontSize: '0.875rem' }}>
                            Complete
                          </button>
                        )}
                        {(s.status === 'pending' || s.status === 'in_progress') && canManageStages && (
                          <button type="button" onClick={() => markApproved(s)} style={{ padding: '4px 8px', fontSize: '0.875rem' }}>
                            Approve
                          </button>
                        )}
                        {(s.status === 'pending' || s.status === 'in_progress') && canManageStages && (
                          <button type="button" onClick={() => setRejectStep({ step: s, reason: '' })} style={{ padding: '4px 8px', fontSize: '0.875rem', color: '#E87600' }}>
                            Reject
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    {/* Assign (top-right) */}
                    {canManageStages && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => setAssignPersonStep(s)} style={{ padding: '4px 8px', fontSize: '0.875rem' }}>Assign</button>
                      </div>
                    )}

                    {/* Only show notification settings for owners and masters, or if user is assigned to this step */}
                    {(canManageStages || s.assigned_to_name === currentUserName) && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.8125rem', color: '#6b7280' }}>
                      <div style={{ marginBottom: 4, fontWeight: 500 }}>Notify when stage:</div>
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
                        <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={!!s.notify_next_assignee_when_complete_or_approved}
                              onChange={(e) => updateCrossStepNotify(s, 'notify_next_assignee_when_complete_or_approved', e.target.checked)}
                              style={{ cursor: 'pointer' }}
                            />
                            Notify next card assignee when complete or approved
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.25rem' }}>
                            <input
                              type="checkbox"
                              checked={!!s.notify_prior_assignee_when_rejected}
                              onChange={(e) => updateCrossStepNotify(s, 'notify_prior_assignee_when_rejected', e.target.checked)}
                              style={{ cursor: 'pointer' }}
                            />
                            Notify prior card assignee when rejected
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 8 }}>
                  Start: {formatDatetime(s.started_at)}{" \u00B7 "}End: {formatDatetime(s.ended_at)}
                </div>
                {s.status === 'approved' && s.approved_by && s.approved_at && (
                  <div style={{ fontSize: '0.875rem', color: '#059669', marginBottom: 8, fontWeight: 500 }}>
                    Approved by {s.approved_by} on {formatDatetime(s.approved_at)}
                  </div>
                )}
                {stepActions[s.id] && stepActions[s.id]!.length > 0 && (
                  <div style={{ marginBottom: 8, padding: '0.75rem', background: '#f9fafb', borderRadius: 4, border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>Action Ledger</div>
                    <div style={{ fontSize: '0.8125rem' }}>
                      {stepActions[s.id]!.map((action) => (
                        <div key={action.id} style={{ marginBottom: '0.375rem', color: '#6b7280' }}>
                          <span style={{ fontWeight: 500, textTransform: 'capitalize', color: '#374151' }}>{action.action_type}</span>
                          {' by '}
                          <span style={{ fontWeight: 500 }}>{action.performed_by}</span>
                          {' on '}
                          <span>{formatDatetime(action.performed_at)}</span>
                          {action.notes && (
                            <div style={{ marginTop: 2, marginLeft: '1rem', fontStyle: 'italic', color: '#9ca3af' }}>
                              {action.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ marginBottom: 8 }}>
                  <label htmlFor={`notes-${s.id}`} style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4, fontWeight: 500 }}>Notes</label>
                  <textarea
                    id={`notes-${s.id}`}
                    key={`notes-${s.id}-${s.notes ?? ''}`}
                    defaultValue={s.notes ?? ''}
                    onBlur={(e) => updateNotes(s, e.target.value)}
                    placeholder="Add notes for this stage..."
                    rows={3}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem', border: '1px solid #e5e7eb', borderRadius: 4 }}
                  />
                </div>
                {/* Private Notes - dev/master only */}
                {isDevOrMaster && (
                  <div style={{ marginBottom: 8, padding: '0.75rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 4 }}>
                    <label htmlFor={`private-notes-${s.id}`} style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4, fontWeight: 500, color: '#0369a1' }}>
                      Private Notes (Only you can see this)
                    </label>
                    <textarea
                      id={`private-notes-${s.id}`}
                      key={`private-notes-${s.id}-${s.private_notes ?? ''}`}
                      defaultValue={s.private_notes ?? ''}
                      onBlur={(e) => updatePrivateNotes(s, e.target.value)}
                      placeholder="Add private notes visible only to owners and master technicians..."
                      rows={3}
                      style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem', border: '1px solid #bae6fd', borderRadius: 4, background: 'white' }}
                    />
                  </div>
                )}
                
                {/* Line Items - dev/master/assistant */}
                {canManageStages && (
                  <div style={{ marginBottom: 8, padding: '0.75rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#0369a1' }}>Line Items (Master and Assistants only)</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {availablePOs.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setAddingPOToStep(s.id)}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                          >
                            + Add PO
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditLineItem(s.id, null)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                        >
                          + Add Line Item
                        </button>
                      </div>
                    </div>
                    {lineItems[s.id] && lineItems[s.id]!.length > 0 ? (
                      <div style={{ fontSize: '0.875rem' }}>
                        {lineItems[s.id]!.map((item) => (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'white', borderRadius: 4, marginBottom: '0.25rem', border: '1px solid #bae6fd' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500, color: '#111827', marginBottom: '0.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>{item.memo}</span>
                                {item.link && (
                                  <a
                                    href={normalizeUrl(item.link)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: '#3b82f6', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                                    title={item.link}
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      const normalizedLink = normalizeUrl(item.link)
                                      if (normalizedLink) {
                                        window.open(normalizedLink, '_blank', 'noopener,noreferrer')
                                      }
                                    }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: '14px', height: '14px', fill: 'currentColor' }}>
                                      <path d="M451.5 160C434.9 160 418.8 164.5 404.7 172.7C388.9 156.7 370.5 143.3 350.2 133.2C378.4 109.2 414.3 96 451.5 96C537.9 96 608 166 608 252.5C608 294 591.5 333.8 562.2 363.1L491.1 434.2C461.8 463.5 422 480 380.5 480C294.1 480 224 410 224 323.5C224 322 224 320.5 224.1 319C224.6 301.3 239.3 287.4 257 287.9C274.7 288.4 288.6 303.1 288.1 320.8C288.1 321.7 288.1 322.6 288.1 323.4C288.1 374.5 329.5 415.9 380.6 415.9C405.1 415.9 428.6 406.2 446 388.8L517.1 317.7C534.4 300.4 544.2 276.8 544.2 252.3C544.2 201.2 502.8 159.8 451.7 159.8zM307.2 237.3C305.3 236.5 303.4 235.4 301.7 234.2C289.1 227.7 274.7 224 259.6 224C235.1 224 211.6 233.7 194.2 251.1L123.1 322.2C105.8 339.5 96 363.1 96 387.6C96 438.7 137.4 480.1 188.5 480.1C205 480.1 221.1 475.7 235.2 467.5C251 483.5 269.4 496.9 289.8 507C261.6 530.9 225.8 544.2 188.5 544.2C102.1 544.2 32 474.2 32 387.7C32 346.2 48.5 306.4 77.8 277.1L148.9 206C178.2 176.7 218 160.2 259.5 160.2C346.1 160.2 416 230.8 416 317.1C416 318.4 416 319.7 416 321C415.6 338.7 400.9 352.6 383.2 352.2C365.5 351.8 351.6 337.1 352 319.4C352 318.6 352 317.9 352 317.1C352 283.4 334 253.8 307.2 237.5z"/>
                                    </svg>
                                  </a>
                                )}
                              </div>
                              <div style={{ fontSize: '0.8125rem', color: (item.amount || 0) < 0 ? '#b91c1c' : '#6b7280' }}>
                                {formatAmount(item.amount)}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              {item.purchase_order_id && (
                                <button
                                  type="button"
                                  onClick={() => loadPODetails(item.purchase_order_id!)}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#dbeafe', color: '#1e40af', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                >
                                  View PO
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEditLineItem(s.id, item)}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteLineItem(item.id)}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.8125rem', color: '#92400e', margin: 0, fontStyle: 'italic' }}>No line items yet. Click "Add Line Item" to add one.</p>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {/* Only show management buttons for owners and masters */}
                  {canManageStages && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => openEditStep(s)} style={{ padding: '4px 8px', fontSize: '0.875rem' }}>Edit</button>
                      <button type="button" onClick={() => deleteStep(s)} style={{ padding: '4px 8px', fontSize: '0.875rem', color: '#b91c1c' }}>Delete</button>
                    </div>
                  )}
                  {/* Re-open button - in line with Edit and Delete */}
                  {(s.status === 'completed' || s.status === 'approved' || s.status === 'rejected') && canManageStages && (
                    <button type="button" onClick={() => markReopened(s)} style={{ padding: '4px 8px', fontSize: '0.875rem', color: '#2563eb' }}>
                      Re-open
                    </button>
                  )}
                </div>
              </div>
              {i < steps.length - 1 && <div style={{ textAlign: 'center', marginBottom: '0.25rem', color: '#9ca3af' }}>{"\u2193"}</div>}
            </div>
          ))
        )}
      </div>

      {stepForm.open && (
        <StepFormModal
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

      {rejectStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Reject step: {rejectStep.step.name}</h3>
            <label style={{ display: 'block', marginBottom: 4 }}>Reason and Proposed Remedy</label>
            <textarea
              value={rejectStep.reason}
              onChange={(e) => setRejectStep((r) => r ? { ...r, reason: e.target.value } : null)}
              rows={3}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
              placeholder="What is wrong and how should it be fixed (optional)"
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={submitReject} style={{ padding: '0.5rem 1rem', color: '#E87600' }}>Reject</button>
              <button type="button" onClick={() => setRejectStep(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {setStartStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Set Start Time: {setStartStep.step.name}</h3>
            <label htmlFor="start-datetime" style={{ display: 'block', marginBottom: 4 }}>Start Date & Time</label>
            <input
              id="start-datetime"
              type="datetime-local"
              value={setStartStep.startDateTime}
              onChange={(e) => setSetStartStep((s) => s ? { ...s, startDateTime: e.target.value } : null)}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={submitSetStart} style={{ padding: '0.5rem 1rem' }}>Set Start</button>
              <button type="button" onClick={() => setSetStartStep(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {assignPersonStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 280, maxWidth: 400, maxHeight: '80vh', overflow: 'auto', color: '#111827' }}>
            <h3 style={{ marginTop: 0, color: '#111827' }}>Add person to: {assignPersonStep.name}</h3>
            <p style={{ fontSize: '0.875rem', color: '#111827', marginBottom: '1rem' }}>Choose from your roster (People and signed-up users).</p>
            {roster.length === 0 && !currentUserName ? (
              <p style={{ color: '#111827', marginBottom: '1rem' }}>No people in your roster yet. Add them on the People page.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1rem' }}>
                {/* Always show current user first */}
                {currentUserName && (
                  <button
                    key="current-user"
                    type="button"
                    onClick={() => assignPerson(assignPersonStep, currentUserName)}
                    style={{ padding: '0.5rem 0.75rem', textAlign: 'left', background: '#eff6ff', border: '1px solid #2563eb', borderRadius: 6, cursor: 'pointer', color: '#111827', fontWeight: 500 }}
                  >
                    {currentUserName} (You)
                  </button>
                )}
                {/* Show rest of roster, excluding current user if already in roster */}
                {roster
                  .filter((r) => r.name !== currentUserName)
                  .map((r, i) => (
                    <button
                      key={`${r.name}-${i}`}
                      type="button"
                      onClick={() => assignPerson(assignPersonStep, r.name)}
                      style={{ padding: '0.5rem 0.75rem', textAlign: 'left', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', color: '#111827' }}
                    >
                      {r.name}
                    </button>
                  ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => assignPerson(assignPersonStep, null)} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: '#111827' }}>Clear</button>
              <button type="button" onClick={() => setAssignPersonStep(null)} style={{ padding: '0.5rem 1rem', color: '#111827' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editingLineItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>{editingLineItem.item ? 'Edit' : 'Add'} Line Item</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveLineItem(editingLineItem.stepId, editingLineItem.item, editingLineItem.link, editingLineItem.memo, editingLineItem.amount)
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="line-item-link" style={{ display: 'block', marginBottom: 4 }}>Link (optional)</label>
                <input
                  id="line-item-link"
                  type="url"
                  value={editingLineItem.link}
                  onChange={(e) => setEditingLineItem({ ...editingLineItem, link: e.target.value })}
                  placeholder="https://..."
                  pattern="https?://.*"
                  style={{ width: '100%', padding: '0.5rem' }}
                />
                {editingLineItem.link && editingLineItem.link.trim() && !editingLineItem.link.trim().match(/^https?:\/\//i) && (
                  <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem' }}>
                    Link should start with http:// or https://
                  </div>
                )}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="line-item-memo" style={{ display: 'block', marginBottom: 4 }}>Memo *</label>
                <input
                  id="line-item-memo"
                  type="text"
                  value={editingLineItem.memo}
                  onChange={(e) => setEditingLineItem({ ...editingLineItem, memo: e.target.value })}
                  required
                  placeholder="e.g. Materials, Labor, Equipment"
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="line-item-amount" style={{ display: 'block', marginBottom: 4 }}>Amount *</label>
                <input
                  id="line-item-amount"
                  type="number"
                  step="0.01"
                  value={editingLineItem.amount}
                  onChange={(e) => setEditingLineItem({ ...editingLineItem, amount: e.target.value })}
                  required
                  placeholder="0.00 (negative allowed)"
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" style={{ padding: '0.5rem 1rem' }}>Save</button>
                <button type="button" onClick={() => setEditingLineItem(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingProjection && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>{editingProjection.item ? 'Edit' : 'Add'} Projection</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveProjection(editingProjection.item, editingProjection.stage_name, editingProjection.memo, editingProjection.amount)
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="projection-stage" style={{ display: 'block', marginBottom: 4 }}>Stage *</label>
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
                <button type="submit" style={{ padding: '0.5rem 1rem' }}>Save</button>
                <button type="button" onClick={() => setEditingProjection(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Purchase Order to Step Modal */}
      {addingPOToStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>Add Purchase Order to Step</h3>
            {availablePOs.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No finalized purchase orders available. Go to Materials page to create and finalize purchase orders.</p>
            ) : (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, maxHeight: '400px', overflow: 'auto' }}>
                  {availablePOs.map(po => (
                    <div
                      key={po.id}
                      onClick={() => addPOToStep(addingPOToStep, po.id)}
                      style={{
                        padding: '1rem',
                        borderBottom: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        background: 'white',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{po.name}</div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>${po.total.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setAddingPOToStep(null)}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Purchase Order Details Modal */}
      {viewingPO && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '800px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: '1rem' }}>{viewingPO.name}</h2>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Part</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Quantity</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Supply House</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Price</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingPO.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.75rem' }}>{item.part.name}</td>
                      <td style={{ padding: '0.75rem' }}>{item.quantity}</td>
                      <td style={{ padding: '0.75rem' }}>{item.supply_house?.name || '-'}</td>
                      <td style={{ padding: '0.75rem' }}>${item.price_at_time.toFixed(2)}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>${(item.price_at_time * item.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot style={{ background: '#f9fafb' }}>
                  <tr>
                    <td colSpan={4} style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>Grand Total:</td>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                      ${viewingPO.items.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setViewingPO(null)}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
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

function StepFormModal({
  step,
  dependsOnStepId,
  insertAfterStepId,
  steps,
  onSave,
  onClose,
  onCopy,
  toDatetimeLocal,
  fromDatetimeLocal,
}: {
  step: Step | null
  dependsOnStepId: string | null
  insertAfterStepId: string | null
  steps: Step[]
  onSave: (p: { name: string; assigned_to_name: string; started_at: string | null; ended_at: string | null; depends_on_step_id?: string | null; insertAfterStepId?: string | null }) => void
  onClose: () => void
  onCopy?: () => void
  toDatetimeLocal: (iso: string | null) => string
  fromDatetimeLocal: (v: string) => string | null
}) {
  const { user: authUser } = useAuth()
  const [name, setName] = useState(step?.name ?? '')
  const [assigned_to_name, setAssignedToName] = useState(step?.assigned_to_name ?? '')
  const [started_at, setStartedAt] = useState(toDatetimeLocal(step?.started_at ?? null))
  const [ended_at, setEndedAt] = useState(toDatetimeLocal(step?.ended_at ?? null))
  const [depends_on_step_id, setDependsOnStepId] = useState(dependsOnStepId ?? '')
  const [insert_after_step_id, setInsertAfterStepId] = useState(insertAfterStepId ?? '')
  
  // Autocomplete state
  const [mastersAndSubs, setMastersAndSubs] = useState<Array<{name: string, source: 'user' | 'people'}>>([])
  const [assignedSearch, setAssignedSearch] = useState(step?.assigned_to_name ?? '')
  const [filteredMastersSubs, setFilteredMastersSubs] = useState<Array<{name: string, source: 'user' | 'people'}>>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAddPerson, setShowAddPerson] = useState(false)
  const [newPerson, setNewPerson] = useState({name: '', email: '', phone: '', notes: ''})
  const [savingPerson, setSavingPerson] = useState(false)
  const [addPersonError, setAddPersonError] = useState<string | null>(null)

  // Load masters and subs when modal opens
  useEffect(() => {
    loadMastersAndSubs()
    // Initialize search with existing assigned_to_name
    if (step?.assigned_to_name) {
      setAssignedSearch(step.assigned_to_name)
      setAssignedToName(step.assigned_to_name)
    } else {
      setAssignedSearch('')
      setAssignedToName('')
    }
  }, [step, authUser?.id])

  async function loadMastersAndSubs() {
    if (!authUser?.id) return
    
    const [usersRes, peopleRes] = await Promise.all([
      supabase
        .from('users')
        .select('name, role')
        .in('role', ['master_technician', 'subcontractor']),
      supabase
        .from('people')
        .select('name, kind')
        .eq('master_user_id', authUser.id)
        .in('kind', ['master_technician', 'sub'])
    ])
    
    const fromUsers = ((usersRes.data as Array<{name: string | null, role: string}> | null) ?? [])
      .filter((u): u is {name: string, role: string} => !!u.name)
      .map(u => ({ name: u.name, source: 'user' as const }))
    
    const fromPeople = ((peopleRes.data as Array<{name: string, kind: string}> | null) ?? [])
      .map(p => ({ name: p.name, source: 'people' as const }))
    
    // Combine and deduplicate by name (case-insensitive)
    const nameMap = new Map<string, {name: string, source: 'user' | 'people'}>()
    const allPeople: Array<{name: string, source: 'user' | 'people'}> = [...fromUsers, ...fromPeople]
    for (const item of allPeople) {
      const key = item.name.toLowerCase()
      if (!nameMap.has(key)) {
        nameMap.set(key, item)
      }
    }
    
    const combined = Array.from(nameMap.values()).sort((a, b) => a.name.localeCompare(b.name))
    setMastersAndSubs(combined)
  }

  function handleAssignedSearchChange(value: string) {
    setAssignedSearch(value)
    setAssignedToName(value)
    
    if (!value.trim()) {
      setShowDropdown(false)
      setFilteredMastersSubs([])
      return
    }
    
    const searchLower = value.toLowerCase()
    const filtered = mastersAndSubs.filter(item => 
      item.name.toLowerCase().includes(searchLower)
    )
    
    setFilteredMastersSubs(filtered)
    setShowDropdown(true)
  }

  function handleSelectPerson(personName: string) {
    setAssignedSearch(personName)
    setAssignedToName(personName)
    setShowDropdown(false)
  }

  function handleAddNewPersonClick() {
    const trimmedName = assignedSearch.trim()
    if (!trimmedName) return
    
    setNewPerson({
      name: trimmedName,
      email: '',
      phone: '',
      notes: ''
    })
    setShowAddPerson(true)
    setShowDropdown(false)
  }

  async function checkDuplicateName(nameToCheck: string): Promise<boolean> {
    const trimmedName = nameToCheck.trim().toLowerCase()
    if (!trimmedName) return false
    
    const [peopleRes, usersRes] = await Promise.all([
      supabase.from('people').select('id, name'),
      supabase.from('users').select('id, name')
    ])
    
    const hasDuplicateInPeople = peopleRes.data?.some(p => p.name?.toLowerCase() === trimmedName) ?? false
    const hasDuplicateInUsers = usersRes.data?.some(u => u.name?.toLowerCase() === trimmedName) ?? false
    
    return hasDuplicateInPeople || hasDuplicateInUsers
  }

  async function handleSaveNewPerson(e: React.FormEvent) {
    e.preventDefault()
    if (!authUser?.id) return
    
    setSavingPerson(true)
    setAddPersonError(null)
    
    const trimmedName = newPerson.name.trim()
    if (!trimmedName) {
      setAddPersonError('Name is required')
      setSavingPerson(false)
      return
    }
    
    // Check for duplicate names
    const isDuplicate = await checkDuplicateName(trimmedName)
    if (isDuplicate) {
      setAddPersonError(`A person or user with the name "${trimmedName}" already exists. Names must be unique.`)
      setSavingPerson(false)
      return
    }
    
    // Create new person (default to 'sub' for subcontractor)
    const { error: err } = await supabase
      .from('people')
      .insert({
        master_user_id: authUser.id,
        kind: 'sub',
        name: trimmedName,
        email: newPerson.email.trim() || null,
        phone: newPerson.phone.trim() || null,
        notes: newPerson.notes.trim() || null,
      })
      .select('name')
      .single()
    
    if (err) {
      setAddPersonError(err.message)
      setSavingPerson(false)
      return
    }
    
    // Refresh masters/subs list
    await loadMastersAndSubs()
    
    // Set the assigned name to the new person
    setAssignedToName(trimmedName)
    setAssignedSearch(trimmedName)
    
    // Close modal and reset form
    setShowAddPerson(false)
    setNewPerson({name: '', email: '', phone: '', notes: ''})
    setSavingPerson(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      name,
      assigned_to_name,
      started_at: fromDatetimeLocal(started_at),
      ended_at: fromDatetimeLocal(ended_at),
      ...(step ? { depends_on_step_id: depends_on_step_id || null } : {}),
      ...(!step ? { insertAfterStepId: insert_after_step_id || null } : {}),
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360 }}>
        <h2 style={{ marginTop: 0 }}>{step ? 'Edit step' : 'Add step'}</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="step-name" style={{ display: 'block', marginBottom: 4 }}>Step (plain text) *</label>
            <input
              id="step-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. deliver materials: rough in"
              style={{ width: '100%', padding: '0.5rem' }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: 6 }}>
              <button type="button" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                change order:
              </button>
              {[
                'initial walkthrough',
                'check work walkthrough',
                'customer walkthrough',
                'send bill',
                'wait on payment',
                'rough in',
                'top out',
                'trim',
              ].map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => setName((prev) => (prev ? `${prev}, ${phrase}` : phrase))}
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                >
                  {phrase}
                </button>
              ))}
            </div>
          </div>
          {!step && steps.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="step-insert-after" style={{ display: 'block', marginBottom: 4 }}>Add after step</label>
              <select
                id="step-insert-after"
                value={insert_after_step_id}
                onChange={(e) => setInsertAfterStepId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="">Add at the end</option>
                <option value="__beginning__">Add at the beginning</option>
                {steps.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ marginBottom: '1rem', position: 'relative' }}>
            <label htmlFor="step-person" style={{ display: 'block', marginBottom: 4 }}>Assigned to</label>
            <input
              id="step-person"
              type="text"
              value={assignedSearch}
              onChange={(e) => handleAssignedSearchChange(e.target.value)}
              onFocus={() => {
                if (assignedSearch.trim()) {
                  handleAssignedSearchChange(assignedSearch)
                }
              }}
              onBlur={() => {
                // Delay hiding dropdown to allow clicks
                setTimeout(() => setShowDropdown(false), 200)
              }}
              placeholder="Search masters and subs..."
              style={{ width: '100%', padding: '0.5rem' }}
            />
            {showDropdown && (filteredMastersSubs.length > 0 || assignedSearch.trim()) && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  marginTop: '2px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 20,
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              >
                {filteredMastersSubs.map((item, idx) => (
                  <button
                    key={`${item.name}-${idx}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSelectPerson(item.name)
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      textAlign: 'left',
                      background: 'white',
                      border: 'none',
                      borderBottom: idx < filteredMastersSubs.length - 1 ? '1px solid #e5e7eb' : 'none',
                      cursor: 'pointer',
                      color: '#111827'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f9fafb'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'white'
                    }}
                  >
                    {item.name}
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                      ({item.source === 'user' ? 'user' : 'not user'})
                    </span>
                  </button>
                ))}
                {filteredMastersSubs.length === 0 && assignedSearch.trim() && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleAddNewPersonClick()
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      textAlign: 'left',
                      background: '#eff6ff',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#2563eb',
                      fontWeight: 500
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#dbeafe'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#eff6ff'
                    }}
                  >
                    Add &quot;{assignedSearch.trim()}&quot;
                  </button>
                )}
              </div>
            )}
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="step-start" style={{ display: 'block', marginBottom: 4 }}>Start time</label>
            <input
              id="step-start"
              type="datetime-local"
              value={started_at}
              onChange={(e) => setStartedAt(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="step-end" style={{ display: 'block', marginBottom: 4 }}>End time</label>
            <input
              id="step-end"
              type="datetime-local"
              value={ended_at}
              onChange={(e) => setEndedAt(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          {step && steps.length > 1 && (
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="step-depends" style={{ display: 'block', marginBottom: 4 }}>Depends on (for branching)</label>
              <select
                id="step-depends"
                value={depends_on_step_id}
                onChange={(e) => setDependsOnStepId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="">None</option>
                {steps.filter((s) => s.id !== step.id).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" style={{ padding: '0.5rem 1rem' }}>Save</button>
            {onCopy && (
              <button type="button" onClick={onCopy} style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4 }}>
                Copy
              </button>
            )}
            <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
          </div>
        </form>
      </div>

      {showAddPerson && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Add Person</h3>
            {addPersonError && (
              <p style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.875rem' }}>{addPersonError}</p>
            )}
            <form onSubmit={handleSaveNewPerson}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="new-person-name" style={{ display: 'block', marginBottom: 4 }}>Name *</label>
                <input
                  id="new-person-name"
                  type="text"
                  value={newPerson.name}
                  onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
                  required
                  disabled={savingPerson}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="new-person-email" style={{ display: 'block', marginBottom: 4 }}>Email</label>
                <input
                  id="new-person-email"
                  type="email"
                  value={newPerson.email}
                  onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })}
                  disabled={savingPerson}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="new-person-phone" style={{ display: 'block', marginBottom: 4 }}>Phone</label>
                <input
                  id="new-person-phone"
                  type="tel"
                  value={newPerson.phone}
                  onChange={(e) => setNewPerson({ ...newPerson, phone: e.target.value })}
                  disabled={savingPerson}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="new-person-notes" style={{ display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea
                  id="new-person-notes"
                  value={newPerson.notes}
                  onChange={(e) => setNewPerson({ ...newPerson, notes: e.target.value })}
                  disabled={savingPerson}
                  rows={2}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={savingPerson} style={{ padding: '0.5rem 1rem' }}>
                  {savingPerson ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPerson(false)
                    setNewPerson({name: '', email: '', phone: '', notes: ''})
                    setAddPersonError(null)
                  }}
                  disabled={savingPerson}
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
