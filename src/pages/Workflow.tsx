import { Fragment, useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { parseWorkflowLineItemPaste } from '../lib/parseWorkflowLineItemPaste'
import { useAuth } from '../hooks/useAuth'
import { useToastContext } from '../contexts/ToastContext'
import { useJobThreadNotes } from '../hooks/useJobThreadNotes'
import { JobThreadNotesPanel } from '../components/JobThreadNotesPanel'
import { isSubcontractorLikeRole } from '../lib/subcontractorLikeRole'
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

function formatDateShort(iso: string | null): string {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: '2-digit' })
}

function daysOpen(startedAt: string | null, endedAt: string | null): number | null {
  if (!startedAt || endedAt) return null
  const start = new Date(startedAt)
  const end = new Date()
  const result = Math.floor((end.getTime() - start.getTime()) / 86400000)
  return result < 0 ? null : result
}

function daysBetween(startedAt: string | null, endedAt: string | null): number | null {
  if (!startedAt || !endedAt) return null
  const start = new Date(startedAt)
  const end = new Date(endedAt)
  const result = Math.floor((end.getTime() - start.getTime()) / 86400000)
  return result < 0 ? null : result
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

function formatLineItemDate(isoDate: string | null | undefined): string {
  if (isoDate == null || isoDate === '') return '\u2014'
  const ymd = isoDate.slice(0, 10)
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return '\u2014'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function ymdFromDateLike(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 10)
}

function formatScheduledDateShort(value: string | null | undefined): string {
  const ymd = ymdFromDateLike(value)
  if (!ymd) return '\u2014'
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return '\u2014'
  return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: '2-digit' })
}

function ymdAddDays(ymd: string, days: number): string {
  if (!ymd) return ''
  const parts = ymd.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return ''
  const [y, m, d] = parts as [number, number, number]
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

function ymdDaysBetween(startYmd: string, endYmd: string): number | null {
  if (!startYmd || !endYmd) return null
  const a = startYmd.split('-').map(Number)
  const b = endYmd.split('-').map(Number)
  if (a.length !== 3 || b.length !== 3 || a.some((n) => Number.isNaN(n)) || b.some((n) => Number.isNaN(n))) return null
  const [ay, am, ad] = a as [number, number, number]
  const [by, bm, bd] = b as [number, number, number]
  const start = new Date(ay, am - 1, ad)
  const end = new Date(by, bm - 1, bd)
  return Math.round((end.getTime() - start.getTime()) / 86400000)
}

function getStepStatusStyle(status: StepStatus | null): { color: string; fontWeight: 'normal' | 'bold' } {
  if (status === 'completed' || status === 'approved') return { color: '#059669', fontWeight: 'normal' }
  if (status === 'in_progress') return { color: '#E87600', fontWeight: 'bold' }
  if (status === 'rejected') return { color: '#b91c1c', fontWeight: 'normal' }
  return { color: '#6b7280', fontWeight: 'normal' }
}

type PersonContactInfo = {
  name: string
  email: string | null
  phone: string | null
  isUser: boolean
}

function PersonDisplayWithContact({
  name,
  contacts,
  userNames,
  onOpenContact,
}: {
  name: string | null
  contacts: Record<string, { email: string | null; phone: string | null }>
  userNames: Set<string>
  onOpenContact: (info: PersonContactInfo) => void
}) {
  if (!name || !name.trim()) {
    return <span>Assigned to: unknown</span>
  }
  const trimmedName = name.trim()
  const contact = contacts[trimmedName]
  const isUser = userNames.has(trimmedName.toLowerCase())

  return (
    <span>
      <button
        type="button"
        data-stop
        onClick={(e) => {
          e.stopPropagation()
          onOpenContact({
            name: trimmedName,
            email: contact?.email ?? null,
            phone: contact?.phone ?? null,
            isUser,
          })
        }}
        title="View contact information"
        aria-label={`View contact information for ${trimmedName}`}
        style={{
          padding: 0,
          background: 'transparent',
          border: 'none',
          color: '#2563eb',
          textDecoration: 'underline',
          cursor: 'pointer',
          font: 'inherit',
          textAlign: 'left',
        }}
      >
        {trimmedName}
      </button>
      {!isUser && <span style={{ fontSize: '0.8125rem', color: '#6b7280', marginLeft: '0.25rem' }}>(not a user)</span>}
    </span>
  )
}

export default function Workflow() {
  const { projectId } = useParams()
  const { user: authUser, profileName: authProfileName, role: authRole } = useAuth()
  const { showToast } = useToastContext()
  const {
    expandedJobThreadId: expandedWorkflowJobThreadId,
    setExpandedJobThreadId: setExpandedWorkflowJobThreadId,
    jobThreadActivityByJobId: workflowJobThreadActivityByJobId,
    jobThreadNotesLoadingId: workflowJobThreadNotesLoadingId,
    jobThreadSubmittingId: workflowJobThreadSubmittingId,
    jobThreadDraft: workflowJobThreadDraft,
    setJobThreadDraft: setWorkflowJobThreadDraft,
    submitJobThreadNote: submitWorkflowJobThreadNote,
    jobThreadStatsByJobId: workflowJobThreadStatsByJobId,
    refreshJobThreadStatsForJobIds: refreshWorkflowJobThreadStats,
  } = useJobThreadNotes(showToast, authUser?.id, authProfileName)
  const [project, setProject] = useState<Project | null>(null)
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [stepForm, setStepForm] = useState<{ open: boolean; step: Step | null; depends_on_step_id?: string | null; insertAfterStepId?: string | null }>({ open: false, step: null })
  const [rejectStep, setRejectStep] = useState<{ step: Step; reason: string } | null>(null)
  const [skipStep, setSkipStep] = useState<{ step: Step; reason: string } | null>(null)
  const [setStartStep, setSetStartStep] = useState<{ step: Step; startDateTime: string } | null>(null)
  const [assignPersonStep, setAssignPersonStep] = useState<Step | null>(null)
  const [assignPersonFilter, setAssignPersonFilter] = useState('')
  const [roster, setRoster] = useState<{ name: string }[]>([])
  const [currentUserName, setCurrentUserName] = useState<string | null>(null)
  const [userSubscriptions, setUserSubscriptions] = useState<Record<string, { notify_when_started: boolean; notify_when_complete: boolean; notify_when_reopened: boolean }>>({})
  const [stepActions, setStepActions] = useState<Record<string, StepAction[]>>({})
  const [personContacts, setPersonContacts] = useState<Record<string, { email: string | null; phone: string | null }>>({})
  const [userNames, setUserNames] = useState<Set<string>>(new Set())
  const [personContactModal, setPersonContactModal] = useState<PersonContactInfo | null>(null)
  const [expectedDatesStep, setExpectedDatesStep] = useState<{
    step: Step
    expectedStart: string
    expectedEnd: string
    lengthDays: string
    updateNextStage: boolean
    hasNextStage: boolean
    seededFromPrior: boolean
  } | null>(null)

  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false)
  const [userRole, setUserRole] = useState<'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'helpers' | 'superintendent' | null>(null)
  const [lineItems, setLineItems] = useState<Record<string, LineItem[]>>({})
  const [editingLineItem, setEditingLineItem] = useState<{
    stepId: string
    item: LineItem | null
    link: string
    memo: string
    amount: string
    itemDate: string
  } | null>(null)
  const [lineItemPasteImporting, setLineItemPasteImporting] = useState(false)
  const [confirmDeleteLineItem, setConfirmDeleteLineItem] = useState<{ item: LineItem; stepName: string } | null>(null)
  const [confirmDeleteStep, setConfirmDeleteStep] = useState<Step | null>(null)
  const [deleteStepConfirmText, setDeleteStepConfirmText] = useState('')
  const [projections, setProjections] = useState<Projection[]>([])
  const [viewingPO, setViewingPO] = useState<{ id: string; name: string; items: Array<{ part: { name: string }; quantity: number; supply_house: { name: string } | null; price_at_time: number }> } | null>(null)
  const [addingPOToStep, setAddingPOToStep] = useState<string | null>(null)
  const [availablePOs, setAvailablePOs] = useState<Array<{ id: string; name: string; total: number }>>([])
  const [addingInvoiceToStep, setAddingInvoiceToStep] = useState<string | null>(null)
  const [availableInvoices, setAvailableInvoices] = useState<Array<{ id: string; invoice_number: string; supply_house_name: string; amount: number; invoice_date: string; due_date: string | null; is_paid: boolean; purchase_order_number: string | null }>>([])
  const [invoiceSearchText, setInvoiceSearchText] = useState('')
  const [viewingInvoice, setViewingInvoice] = useState<{ id: string; invoice_number: string; supply_house_name: string; amount: number; link: string | null } | null>(null)
  const [editingProjection, setEditingProjection] = useState<{ item: Projection | null; stage_name: string; memo: string; amount: string } | null>(null)
  const [projectMaster, setProjectMaster] = useState<{ id: string; name: string | null; email: string | null } | null>(null)
  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>({})
  const [rowCollapsed, setRowCollapsed] = useState<Record<string, boolean>>({})
  const [oldStagesCollapsed, setOldStagesCollapsed] = useState(false)
  const [projectSuperintendents, setProjectSuperintendents] = useState<Array<{ id: string; name: string | null; email: string | null }>>([])
  const [allSuperintendents, setAllSuperintendents] = useState<Array<{ id: string; name: string | null; email: string | null }>>([])
  const [projectSuperintendentSaving, setProjectSuperintendentSaving] = useState(false)
  const [projectionsLedgerExpanded, setProjectionsLedgerExpanded] = useState(false)
  const [projectJobs, setProjectJobs] = useState<Array<{ id: string; hcp_number: string; job_name: string; status: string }>>([])

  const canManageStages = userRole === 'dev' || userRole === 'master_technician' || userRole === 'assistant' || userRole === 'superintendent'
  const isDevOrMaster = userRole === 'dev' || userRole === 'master_technician'
  const canSeePrivateNotesAndApprove = userRole === 'dev' || userRole === 'master_technician' || userRole === 'assistant' || userRole === 'superintendent'
  const canAssignSuperintendents = userRole === 'dev' || userRole === 'master_technician' || userRole === 'assistant'

  function isRowDefaultCollapsed(step: Step): boolean {
    return step.status === 'completed' || step.status === 'approved' || step.status === 'skipped' || step.status === 'pending'
  }

  function isStepEmpty(step: Step): boolean {
    const hasAssignee = !!(step.assigned_to_name?.trim())
    const hasNotes = !!(step.notes?.trim())
    const hasPrivateNotes = !!(step.private_notes?.trim())
    const hasLineItems = (lineItems[step.id]?.length ?? 0) > 0
    const hasStarted = !!step.started_at
    const isPending = step.status === 'pending'
    return !hasAssignee && !hasNotes && !hasPrivateNotes && !hasLineItems && !hasStarted && isPending
  }

  function isSectionDefaultExpanded(step: Step, section: 'notify' | 'notes' | 'privateNotes' | 'lineItems'): boolean {
    if (section === 'notify') return false
    if (section === 'notes') return !!(step.notes?.trim())
    if (section === 'privateNotes') return !!(step.private_notes?.trim())
    if (section === 'lineItems') return true
    return false
  }

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
    return true
  }

  async function loadProjectSuperintendents(pid: string) {
    const { data: psData, error } = await supabase.from('project_superintendents').select('superintendent_id').eq('project_id', pid)
    if (error) {
      console.error('Error loading project superintendents:', error)
      setProjectSuperintendents([])
      return
    }
    const ids = (psData ?? []).map((r) => r.superintendent_id).filter(Boolean)
    if (ids.length === 0) {
      setProjectSuperintendents([])
      return
    }
    const { data: usersData } = await supabase.from('users').select('id, name, email').in('id', ids)
    const users = (usersData ?? []) as Array<{ id: string; name: string | null; email: string | null }>
    setProjectSuperintendents(users)
  }

  async function loadProjectJobs(pid: string) {
    const { data, error } = await supabase
      .from('jobs_ledger')
      .select('id, hcp_number, job_name, status')
      .eq('project_id', pid)
    if (error) {
      console.error('Error loading project jobs:', error)
      setProjectJobs([])
      return
    }
    setProjectJobs((data ?? []) as Array<{ id: string; hcp_number: string; job_name: string; status: string }>)
  }

  async function loadAllSuperintendents() {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('role', 'superintendent')
      .is('archived_at', null)
      .order('name')
    if (error) {
      console.error('Error loading superintendents:', error)
      setAllSuperintendents([])
      return
    }
    setAllSuperintendents((data ?? []) as Array<{ id: string; name: string | null; email: string | null }>)
  }

  async function addProjectSuperintendent(superintendentId: string) {
    if (!projectId) return
    setProjectSuperintendentSaving(true)
    const { error } = await supabase.from('project_superintendents').insert({ project_id: projectId, superintendent_id: superintendentId })
    if (error) {
      setError(`Failed to assign superintendent: ${error.message}`)
    } else {
      await loadProjectSuperintendents(projectId)
    }
    setProjectSuperintendentSaving(false)
  }

  async function removeProjectSuperintendent(superintendentId: string) {
    if (!projectId) return
    setProjectSuperintendentSaving(true)
    const { error } = await supabase.from('project_superintendents').delete().eq('project_id', projectId).eq('superintendent_id', superintendentId)
    if (error) {
      setError(`Failed to remove superintendent: ${error.message}`)
    } else {
      setProjectSuperintendents((prev) => prev.filter((s) => s.id !== superintendentId))
    }
    setProjectSuperintendentSaving(false)
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

  async function loadFinalizedPOs() {
    if (userRole !== 'dev' && userRole !== 'master_technician') return
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('id, name')
      .eq('status', 'finalized')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (error) {
      console.error('Error loading POs:', error)
      return
    }

    const pos = (data as Array<{ id: string; name: string }>) ?? []
    if (pos.length === 0) {
      setAvailablePOs([])
      return
    }

    // Single query for all PO items (avoids N+1)
    const poIds = pos.map((p) => p.id)
    const { data: itemsData } = await supabase
      .from('purchase_order_items')
      .select('purchase_order_id, price_at_time, quantity')
      .in('purchase_order_id', poIds)

    const totalsByPo: Record<string, number> = {}
    ;(itemsData ?? []).forEach((item: { purchase_order_id: string; price_at_time: number; quantity: number }) => {
      const id = item.purchase_order_id
      totalsByPo[id] = (totalsByPo[id] ?? 0) + item.price_at_time * item.quantity
    })
    const posWithTotals = pos.map((po) => ({ ...po, total: totalsByPo[po.id] ?? 0 }))

    setAvailablePOs(posWithTotals)
  }

  async function loadSupplyHouseInvoices() {
    if (userRole !== 'dev' && userRole !== 'master_technician') return
    const { data, error } = await supabase
      .from('supply_house_invoices')
      .select(`
        id,
        invoice_number,
        invoice_date,
        due_date,
        amount,
        is_paid,
        purchase_order_number,
        supply_house_id,
        supply_houses(name)
      `)
      .order('invoice_date', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error loading supply house invoices:', error)
      setAvailableInvoices([])
      return
    }

    const rows = (data as Array<{
      id: string
      invoice_number: string
      invoice_date: string
      due_date: string | null
      amount: number
      is_paid: boolean
      purchase_order_number: string | null
      supply_houses: { name: string } | null
    }>) ?? []
    setAvailableInvoices(rows.map((r) => ({
      id: r.id,
      invoice_number: r.invoice_number,
      supply_house_name: r.supply_houses?.name ?? 'Unknown',
      amount: r.amount,
      invoice_date: r.invoice_date,
      due_date: r.due_date,
      is_paid: r.is_paid,
      purchase_order_number: r.purchase_order_number,
    })))
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

    const items = (itemsData as unknown as Array<PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null }>) ?? []
    setViewingPO({
      id: poId,
      name: (poData as PurchaseOrder).name,
      items: items.map(item => ({
        part: { name: item.material_parts.name },
        quantity: item.quantity,
        supply_house: item.supply_houses as { name: string } | null,
        price_at_time: item.price_at_time,
      })),
    })
  }

  async function loadInvoiceDetails(invoiceId: string) {
    const { data, error } = await supabase
      .from('supply_house_invoices')
      .select('*, supply_houses(name)')
      .eq('id', invoiceId)
      .single()

    if (error) {
      setError(`Failed to load invoice: ${error.message}`)
      return
    }

    const row = data as { id: string; invoice_number: string; amount: number; link: string | null; supply_houses: { name: string } | null }
    setViewingInvoice({
      id: row.id,
      invoice_number: row.invoice_number,
      supply_house_name: row.supply_houses?.name ?? 'Unknown',
      amount: row.amount,
      link: row.link ?? null,
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
      if (steps.length > 0 && (userRole === 'dev' || userRole === 'master_technician' || userRole === 'assistant' || userRole === 'superintendent')) {
        const stepIds = steps.map(s => s.id)
        await loadLineItemsForSteps(stepIds)
      }
    }
  }

  async function addInvoiceToStep(stepId: string, invoiceId: string) {
    setError(null)

    const { data: invData, error: invError } = await supabase
      .from('supply_house_invoices')
      .select('*, supply_houses(name)')
      .eq('id', invoiceId)
      .single()

    if (invError || !invData) {
      setError(`Failed to load invoice: ${invError?.message ?? 'Not found'}`)
      return
    }

    const inv = invData as { invoice_number: string; amount: number; supply_houses: { name: string } | null }
    const supplyHouseName = inv.supply_houses?.name ?? 'Unknown'
    const memo = `Invoice #${inv.invoice_number} - ${supplyHouseName} - $${Number(inv.amount).toFixed(2)}`

    const maxOrder = Math.max(0, ...(lineItems[stepId] || []).map(li => li.sequence_order))
    const { error } = await supabase
      .from('workflow_step_line_items')
      .insert({
        step_id: stepId,
        memo,
        amount: inv.amount,
        sequence_order: maxOrder + 1,
        supply_house_invoice_id: invoiceId,
      })

    if (error) {
      setError(`Failed to add invoice to step: ${error.message}`)
    } else {
      setAddingInvoiceToStep(null)
      setInvoiceSearchText('')
      await refreshSteps()
      if (steps.length > 0 && (userRole === 'dev' || userRole === 'master_technician' || userRole === 'assistant' || userRole === 'superintendent')) {
        const stepIds = steps.map(s => s.id)
        await loadLineItemsForSteps(stepIds)
      }
    }
  }

  async function loadLineItemsForSteps(stepIds: string[]) {
    if (userRole !== 'dev' && userRole !== 'master_technician' && userRole !== 'assistant' && userRole !== 'superintendent') return
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
    if (steps.length > 0 && (userRole === 'dev' || userRole === 'master_technician' || userRole === 'assistant' || userRole === 'superintendent')) {
      const stepIds = steps.map(s => s.id)
      const t = setTimeout(() => loadLineItemsForSteps(stepIds), 50)
      return () => clearTimeout(t)
    } else {
      setLineItems({})
    }
  }, [steps, userRole])

  // Load projections when workflow and userRole are available (staggered)
  useEffect(() => {
    if (workflow?.id && (userRole === 'dev' || userRole === 'master_technician')) {
      const t = setTimeout(() => loadProjections(workflow.id), 100)
      return () => clearTimeout(t)
    } else {
      setProjections([])
    }
  }, [workflow?.id, userRole])

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

  // Load project superintendents and all superintendents when can assign
  useEffect(() => {
    if (projectId && canAssignSuperintendents) {
      loadProjectSuperintendents(projectId)
      loadAllSuperintendents()
    } else {
      setProjectSuperintendents([])
      setAllSuperintendents([])
    }
  }, [projectId, canAssignSuperintendents])

  useEffect(() => {
    if (projectId) {
      loadProjectJobs(projectId)
    } else {
      setProjectJobs([])
    }
  }, [projectId])

  useEffect(() => {
    if (!authUser?.id || projectJobs.length === 0) {
      void refreshWorkflowJobThreadStats([])
      return
    }
    void refreshWorkflowJobThreadStats(projectJobs.map((j) => j.id))
  }, [authUser?.id, projectJobs, refreshWorkflowJobThreadStats])

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
        setUserRole((userData as { role: 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'helpers' | 'superintendent' }).role)
        const userName = (userData as { name: string | null; email: string | null }).name || (userData as { name: string | null; email: string | null }).email
        setCurrentUserName(userName)
      }

      const role = (userData as { role: string } | null)?.role
      let peopleRes: { data: { name: string; email: string | null; phone: string | null }[] | null }
      let usersRes: { data: { name: string | null; email: string | null }[] | null }

      if (role === 'superintendent') {
        const { data: adopted } = await supabase
          .from('master_superintendents')
          .select('master_id')
          .eq('superintendent_id', authUser.id)
        const adoptedMasterIds = (adopted ?? []).map((r) => r.master_id)
        ;[peopleRes, usersRes] = await Promise.all([
          adoptedMasterIds.length > 0
            ? supabase.from('people').select('name, email, phone').is('archived_at', null).in('master_user_id', adoptedMasterIds).order('name')
            : { data: [] as { name: string; email: string | null; phone: string | null }[] },
          supabase.from('users').select('name, email').in('role', ['subcontractor', 'helpers', 'primary']),
        ])
      } else {
        ;[peopleRes, usersRes] = await Promise.all([
          supabase.from('people').select('name, email, phone').is('archived_at', null).eq('master_user_id', authUser.id).order('name'),
          supabase.from('users').select('name, email'),
        ])
      }
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

  type UnifiedRow = {
    stageName: string
    memo: string
    projectionAmount: number | null
    projection: Projection | null
    ledgerAmount: number | null
    ledgerItem: LineItem | null
    ledgerStepName: string | null
  }

  function buildUnifiedRows(): UnifiedRow[] {
    const stageNames = new Set<string>([
      ...projections.map((p) => p.stage_name.trim()),
      ...steps.filter((s) => (lineItems[s.id]?.length ?? 0) > 0).map((s) => s.name),
    ])
    const rows: UnifiedRow[] = []
    for (const stageName of [...stageNames].sort()) {
      const projLines = projections
        .filter((p) => p.stage_name.trim() === stageName)
        .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
      const ledgerSteps = steps.filter((s) => s.name === stageName)
      const ledgerLines: Array<{ item: LineItem; stepName: string }> = []
      ledgerSteps.forEach((s) => {
        ;(lineItems[s.id] || []).forEach((item) => ledgerLines.push({ item, stepName: s.name }))
      })
      const maxRows = Math.max(projLines.length, ledgerLines.length) || 1
      for (let i = 0; i < maxRows; i++) {
        const proj = projLines[i] ?? null
        const ledger = ledgerLines[i] ?? null
        const memo = [proj?.memo, ledger?.item?.memo].filter(Boolean).join(' / ') || '\u2014'
        rows.push({
          stageName: i === 0 ? stageName : '',
          memo,
          projectionAmount: proj?.amount ?? null,
          projection: proj,
          ledgerAmount: ledger?.item?.amount ?? null,
          ledgerItem: ledger?.item ?? null,
          ledgerStepName: ledger?.stepName ?? null,
        })
      }
    }
    return rows
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
    additionalVariables?: Record<string, string>,
    recipientUserId?: string,
    pushTitle?: string,
    pushBody?: string
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
      const { data, error: eFn } = await supabase.functions.invoke('send-workflow-notification', {
        body: {
          template_type: templateType,
          step_id: step.id,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          recipient_user_id: recipientUserId,
          push_title: pushTitle,
          push_body: pushBody,
          push_url: workflowLink,
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

    // Get contact info for people (email and userId when available for push)
    const getContactForName = async (name: string | null): Promise<{ email: string | null; userId: string | null }> => {
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

    // Handle different action types
    if (actionType === 'started') {
      // Notify assigned person if enabled
      if (step.notify_assigned_when_started && step.assigned_to_name) {
        const { email, userId } = await getContactForName(step.assigned_to_name)
        if (email) {
          await sendNotification('stage_assigned_started', step, step.assigned_to_name, email, undefined, userId ?? undefined)
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
              await sendNotification('stage_me_started', step, user.name || user.email, user.email, undefined, sub.user_id ?? undefined)
            }
          }
        }
      }
    } else if (actionType === 'completed' || actionType === 'approved') {
      // Notify assigned person if enabled
      if (step.notify_assigned_when_complete && step.assigned_to_name) {
        const { email, userId } = await getContactForName(step.assigned_to_name)
        if (email) {
          await sendNotification('stage_assigned_complete', step, step.assigned_to_name, email, undefined, userId ?? undefined)
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
              await sendNotification('stage_me_complete', step, user.name || user.email, user.email, undefined, sub.user_id ?? undefined)
            }
          }
        }
      }

      // Cross-step: Notify next assignee (primary handoff - include push title/body)
      if (step.notify_next_assignee_when_complete_or_approved && nextStep?.assigned_to_name) {
        const { email, userId } = await getContactForName(nextStep.assigned_to_name)
        if (email) {
          const nextStepForNotification: Step = {
            ...step,
            id: nextStep.id,
            name: nextStep.name,
            assigned_to_name: nextStep.assigned_to_name,
          } as Step
          await sendNotification(
            'stage_next_complete_or_approved',
            nextStepForNotification,
            nextStep.assigned_to_name,
            email,
            { previous_stage_name: step.name },
            userId ?? undefined,
            'Your turn: Stage completed',
            `${step.name} has been completed. You're up next for ${nextStep.name}.`
          )
        }
      }
    } else if (actionType === 'rejected') {
      // Cross-step: Notify prior assignee
      if (step.notify_prior_assignee_when_rejected && previousStep?.assigned_to_name) {
        const { email, userId } = await getContactForName(previousStep.assigned_to_name)
        if (email) {
          const previousStepForNotification: Step = {
            ...step,
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
            },
            userId ?? undefined
          )
        }
      }
    } else if (actionType === 'reopened') {
      // Notify assigned person if enabled
      if (step.notify_assigned_when_reopened && step.assigned_to_name) {
        const { email, userId } = await getContactForName(step.assigned_to_name)
        if (email) {
          await sendNotification('stage_assigned_reopened', step, step.assigned_to_name, email, undefined, userId ?? undefined)
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
              await sendNotification('stage_me_reopened', step, user.name || user.email, user.email, undefined, sub.user_id ?? undefined)
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

  async function updateStepStatus(step: Step, status: StepStatus, extra?: { ended_at?: string | null; rejection_reason?: string | null; skipped_reason?: string | null; approved_by?: string | null; approved_at?: string | null; next_step_rejected_notice?: string | null; next_step_rejection_reason?: string | null }) {
    const up: Record<string, unknown> = { status }
    if (extra?.ended_at !== undefined) up.ended_at = extra.ended_at
    if (extra?.rejection_reason !== undefined) up.rejection_reason = extra.rejection_reason
    if (extra?.skipped_reason !== undefined) up.skipped_reason = extra.skipped_reason
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

  function openExpectedDates(step: Step) {
    const idx = steps.findIndex((s) => s.id === step.id)
    const prev = idx > 0 ? steps[idx - 1] : null
    const next = idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : null
    const currentStart = ymdFromDateLike(step.scheduled_start_date)
    const currentEnd = ymdFromDateLike(step.scheduled_end_date)
    const priorEnd = ymdFromDateLike(prev?.scheduled_end_date)
    const seededFromPrior = !currentStart && !!priorEnd
    const startVal = currentStart || priorEnd
    const length = startVal && currentEnd ? ymdDaysBetween(startVal, currentEnd) : null
    setExpectedDatesStep({
      step,
      expectedStart: startVal,
      expectedEnd: currentEnd,
      lengthDays: length != null ? String(length) : '',
      updateNextStage: !!next,
      hasNextStage: !!next,
      seededFromPrior,
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
        showToast(`Saved this stage; failed to update next stage: ${nextError.message}`, 'error')
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
      skipped_reason: null,
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


  async function saveLineItem(stepId: string, item: LineItem | null, link: string, memo: string, amount: string, itemDate: string) {
    const amountNum = parseFloat(amount) || 0
    if (!memo.trim()) {
      setError('Memo is required')
      return
    }
    const itemDateVal = itemDate.trim() ? itemDate.trim().slice(0, 10) : null

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
        .update({ link: finalLink, memo: memo.trim(), amount: amountNum, item_date: itemDateVal })
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
        .insert({
          step_id: stepId,
          link: finalLink,
          memo: memo.trim(),
          amount: amountNum,
          sequence_order: maxOrder + 1,
          item_date: itemDateVal,
        })
      if (error) {
        setError(`Failed to insert line item: ${error.message}`)
        return
      }
    }
    setEditingLineItem(null)
    await refreshSteps()
    // Reload line items to ensure UI updates for assistants
    if (
      steps.length > 0 &&
      (userRole === 'dev' || userRole === 'master_technician' || userRole === 'assistant' || userRole === 'superintendent')
    ) {
      const stepIds = steps.map(s => s.id)
      await loadLineItemsForSteps(stepIds)
    }
  }

  async function importLineItemsFromPaste(stepId: string, text: string) {
    const parsed = parseWorkflowLineItemPaste(text)
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    const baseOrder = Math.max(0, ...(lineItems[stepId] || []).map((li) => li.sequence_order))
    const payload = parsed.rows.map((r, i) => ({
      step_id: stepId,
      memo: r.memo,
      amount: r.amount,
      item_date: r.itemDate,
      sequence_order: baseOrder + 1 + i,
    }))
    const { error } = await supabase.from('workflow_step_line_items').insert(payload)
    if (error) {
      setError(`Failed to import line items: ${error.message}`)
      return
    }
    setEditingLineItem(null)
    setError(null)
    await refreshSteps()
    if (
      steps.length > 0 &&
      (userRole === 'dev' || userRole === 'master_technician' || userRole === 'assistant' || userRole === 'superintendent')
    ) {
      await loadLineItemsForSteps(steps.map((s) => s.id))
    }
  }

  async function importLineItemsFromClipboard() {
    if (!editingLineItem || editingLineItem.item !== null) return
    setError(null)
    setLineItemPasteImporting(true)
    try {
      const text = await navigator.clipboard.readText()
      await importLineItemsFromPaste(editingLineItem.stepId, text)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not read clipboard. Use HTTPS (or localhost) and allow clipboard access when prompted.'
      )
    } finally {
      setLineItemPasteImporting(false)
    }
  }

  async function deleteLineItem(itemId: string) {
    const { error } = await supabase.from('workflow_step_line_items').delete().eq('id', itemId)
    if (error) {
      setError(`Failed to delete line item: ${error.message}`)
    } else {
      await refreshSteps()
      // Reload line items to ensure UI updates for assistants
      if (
        steps.length > 0 &&
        (userRole === 'dev' || userRole === 'master_technician' || userRole === 'assistant' || userRole === 'superintendent')
      ) {
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
      itemDate: item?.item_date ? String(item.item_date).slice(0, 10) : '',
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
        await updateStepStatus(previousStep, 'in_progress', {
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

  async function submitSkip() {
    if (!skipStep || !skipStep.reason.trim()) return
    await updateStepStatus(skipStep.step, 'skipped', { skipped_reason: skipStep.reason.trim(), ended_at: new Date().toISOString() })
    await recordAction(skipStep.step.id, 'skipped', skipStep.reason.trim())
    setSkipStep(null)
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

  async function assignPerson(step: Step, name: string | null) {
    const previousName = step.assigned_to_name
    setAssignPersonStep(null)
    setSteps((prev) =>
      prev.map((s) => (s.id === step.id ? { ...s, assigned_to_name: name } : s))
    )
    let err: { message: string } | null = null
    const rpcRes = await supabase.rpc('update_step_assigned_to', {
      p_step_id: step.id,
      p_assigned_to_name: name ?? '',
    })
    err = rpcRes.error
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
    refreshSteps()
  }

  if (loading) return <p>Loading...</p>
  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>
  if (!project || !workflow) return <p>Project or workflow not found.</p>

  return (
    <div className="workflow">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <Link to="/projects">{"\u2190"} Projects</Link>
        <Link
          to={`/projects/${project.id}/edit`}
          style={{
            fontSize: '0.875rem',
            padding: '0.25rem 0.5rem',
            background: '#eff6ff',
            color: '#1d4ed8',
            borderRadius: 4,
            textDecoration: 'none',
            fontWeight: 500,
            display: 'inline-block',
          }}
        >
          Project: {project.name}
        </Link>
      </div>
      <div style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ marginBottom: '0.5rem' }}>{project.name}{" \u2013 "}Workflow</h1>
            {projectMaster && (
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', fontWeight: 500 }}>
                Project Master: {projectMaster.name || projectMaster.email || 'Unknown'}
              </div>
            )}
            {canAssignSuperintendents && (
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 500 }}>Superintendents:</span>
                {projectSuperintendents.length === 0 && (
                  <span style={{ color: '#9ca3af' }}>None</span>
                )}
                {projectSuperintendents.map((s) => (
                  <span
                    key={s.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.15rem 0.4rem',
                      background: '#e0f2fe',
                      color: '#0369a1',
                      borderRadius: 4,
                      fontSize: '0.8125rem',
                    }}
                  >
                    {s.name || s.email || 'Unknown'}
                    <button
                      type="button"
                      onClick={() => removeProjectSuperintendent(s.id)}
                      disabled={projectSuperintendentSaving}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: projectSuperintendentSaving ? 'not-allowed' : 'pointer', color: 'inherit', fontSize: '0.9em', lineHeight: 1 }}
                      title="Remove"
                    >
                      {"\u00d7"}
                    </button>
                  </span>
                ))}
                <select
                  value=""
                  onChange={(e) => {
                    const id = e.target.value
                    if (id) {
                      addProjectSuperintendent(id)
                      e.target.value = ''
                    }
                  }}
                  disabled={projectSuperintendentSaving}
                  style={{ padding: '0.15rem 0.35rem', fontSize: '0.8125rem', border: '1px solid #bae6fd', borderRadius: 4, background: 'white', minWidth: 140 }}
                >
                  <option value="">Add superintendent...</option>
                  {allSuperintendents
                    .filter((s) => !projectSuperintendents.some((ps) => ps.id === s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || s.email || s.id}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>Jobs:</span>
              {projectJobs.length === 0 && <span style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>None</span>}
              {projectJobs.map((j) => {
                const expanded = expandedWorkflowJobThreadId === j.id
                const stat = workflowJobThreadStatsByJobId[j.id]
                const n = stat?.note_count ?? 0
                return (
                  <Fragment key={j.id}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <Link
                        to={`/jobs?edit=${j.id}&tab=stages`}
                        style={{ padding: '0.15rem 0.4rem', background: '#f5f5f5', borderRadius: 4, fontSize: '0.8125rem', textDecoration: 'none', color: '#374151' }}
                      >
                        {j.hcp_number || j.job_name || 'Job'}
                      </Link>
                      <button
                        type="button"
                        onClick={() => setExpandedWorkflowJobThreadId((prev) => (prev === j.id ? null : j.id))}
                        aria-expanded={expanded}
                        title={n > 0 ? `${n} thread note(s)` : 'Job notes thread'}
                        style={{
                          padding: '0.1rem 0.25rem',
                          fontSize: '0.7rem',
                          border: '1px solid #e5e7eb',
                          borderRadius: 4,
                          background: 'white',
                          cursor: 'pointer',
                          color: '#374151',
                          lineHeight: 1,
                        }}
                      >
                        {expanded ? '\u25BC' : '\u25B6'}
                        {n > 0 ? <span style={{ color: '#2563eb', marginLeft: 2 }}>{n}</span> : null}
                      </button>
                    </span>
                  </Fragment>
                )
              })}
              <Link
                to={`/jobs?newJob=true&project=${projectId}&tab=stages`}
                style={{ padding: '0.15rem 0.4rem', background: '#e0f2fe', borderRadius: 4, fontSize: '0.8125rem', textDecoration: 'none', color: '#0369a1' }}
              >
                + Create Job
              </Link>
            </div>
            {expandedWorkflowJobThreadId && (
              <div style={{ width: '100%', maxWidth: 560, alignSelf: 'stretch' }}>
                <JobThreadNotesPanel
                  activity={workflowJobThreadActivityByJobId[expandedWorkflowJobThreadId] ?? []}
                  loading={workflowJobThreadNotesLoadingId === expandedWorkflowJobThreadId}
                  canPost={!!authUser}
                  draft={workflowJobThreadDraft}
                  submitting={workflowJobThreadSubmittingId === expandedWorkflowJobThreadId}
                  onDraftChange={setWorkflowJobThreadDraft}
                  onSubmit={() => void submitWorkflowJobThreadNote(expandedWorkflowJobThreadId)}
                  viewerRole={authRole}
                />
              </div>
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
                    {oldStagesCollapsed ? 'Show Old Stages' : 'Hide Old Stages'}
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
              color: '#6b7280',
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
        <div style={{ marginBottom: '1rem' }}>
          {/* Collapsible summary bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.5rem 0.75rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8 }}>
            {isDevOrMaster && (
              <>
                <span style={{ fontSize: '0.875rem', color: calculateProjectionsTotal() < 0 ? '#b91c1c' : '#111827', fontWeight: 500 }}>
                  Projections: {formatAmount(calculateProjectionsTotal())}
                </span>
                <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>|</span>
              </>
            )}
            {canManageStages && (
              <span style={{ fontSize: '0.875rem', color: calculateLedgerTotal() < 0 ? '#b91c1c' : '#111827', fontWeight: 500 }}>
                Ledger: {formatAmount(calculateLedgerTotal())}
              </span>
            )}
            {isDevOrMaster && (
              <>
                <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>|</span>
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: (() => {
                      const left = calculateProjectionsTotal() - calculateLedgerTotal()
                      return left < 0 ? '#b91c1c' : '#047857'
                    })(),
                  }}
                >
                  Left: {formatAmount(calculateProjectionsTotal() - calculateLedgerTotal())}
                </span>
              </>
            )}
            {isDevOrMaster && (
              <button
                type="button"
                onClick={() => openEditProjection(null)}
                className="wf-btn-success"
                style={{ marginLeft: 'auto' }}
              >
                + Add Projection
              </button>
            )}
            <button
              type="button"
              onClick={() => setProjectionsLedgerExpanded((v) => !v)}
              className="wf-btn-secondary wf-btn-secondary-blue"
              style={{ marginLeft: 'auto' }}
            >
              {projectionsLedgerExpanded ? '\u25b2 Hide details' : '\u25be Details'}
            </button>
          </div>

          {/* Expanded unified table */}
          {projectionsLedgerExpanded && (() => {
            const unifiedRows = buildUnifiedRows()
            const hasProjections = projections.length > 0
            const hasLedger = Object.keys(lineItems).length > 0 && !Object.values(lineItems).every((items) => items.length === 0)
            const hasAnyData = hasProjections || hasLedger

            if (!hasAnyData) {
              return (
                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  No projections or ledger items.
                  {isDevOrMaster && (
                    <button
                      type="button"
                      onClick={() => openEditProjection(null)}
                      className="wf-btn-success"
                      style={{ marginLeft: '0.5rem' }}
                    >
                      Add Projection
                    </button>
                  )}
                </div>
              )
            }

            return (
              <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #bae6fd' }}>
                      <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', fontWeight: 600 }}>Stage</th>
                      <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', fontWeight: 600 }}>Memo</th>
                      {isDevOrMaster && <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem', fontWeight: 600 }}>Projections</th>}
                      <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem', fontWeight: 600 }}>Ledger</th>
                      {isDevOrMaster && <th style={{ textAlign: 'center', padding: '0.35rem 0.5rem', fontWeight: 600, width: 90 }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {unifiedRows.map((row, idx) => (
                      <tr key={row.projection?.id ?? row.ledgerItem?.id ?? `row-${idx}`} style={{ borderBottom: '1px solid #e0f2fe' }}>
                        <td style={{ padding: '0.35rem 0.5rem', color: '#111827', fontWeight: row.stageName ? 500 : 'normal' }}>{row.stageName || '\u00a0'}</td>
                        <td style={{ padding: '0.35rem 0.5rem', color: '#374151' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{row.memo}</span>
                            {row.ledgerItem?.link && (
                              <a
                                href={normalizeUrl(row.ledgerItem.link)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#3b82f6', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                                title={row.ledgerItem.link}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  const normalizedLink = normalizeUrl(row.ledgerItem!.link)
                                  if (normalizedLink) {
                                    window.open(normalizedLink, '_blank', 'noopener,noreferrer')
                                  }
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: '12px', height: '12px', fill: 'currentColor' }}>
                                  <path d="M451.5 160C434.9 160 418.8 164.5 404.7 172.7C388.9 156.7 370.5 143.3 350.2 133.2C378.4 109.2 414.3 96 451.5 96C537.9 96 608 166 608 252.5C608 294 591.5 333.8 562.2 363.1L491.1 434.2C461.8 463.5 422 480 380.5 480C294.1 480 224 410 224 323.5C224 322 224 320.5 224.1 319C224.6 301.3 239.3 287.4 257 287.9C274.7 288.4 288.6 303.1 288.1 320.8C288.1 321.7 288.1 322.6 288.1 323.4C288.1 374.5 329.5 415.9 380.6 415.9C405.1 415.9 428.6 406.2 446 388.8L517.1 317.7C534.4 300.4 544.2 276.8 544.2 252.3C544.2 201.2 502.8 159.8 451.7 159.8zM307.2 237.3C305.3 236.5 303.4 235.4 301.7 234.2C289.1 227.7 274.7 224 259.6 224C235.1 224 211.6 233.7 194.2 251.1L123.1 322.2C105.8 339.5 96 363.1 96 387.6C96 438.7 137.4 480.1 188.5 480.1C205 480.1 221.1 475.7 235.2 467.5C251 483.5 269.4 496.9 289.8 507C261.6 530.9 225.8 544.2 188.5 544.2C102.1 544.2 32 474.2 32 387.7C32 346.2 48.5 306.4 77.8 277.1L148.9 206C178.2 176.7 218 160.2 259.5 160.2C346.1 160.2 416 230.8 416 317.1C416 318.4 416 319.7 416 321C415.6 338.7 400.9 352.6 383.2 352.2C365.5 351.8 351.6 337.1 352 319.4C352 318.6 352 317.9 352 317.1C352 283.4 334 253.8 307.2 237.5z" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </td>
                        {isDevOrMaster && (
                          <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', color: (row.projectionAmount ?? 0) < 0 ? '#b91c1c' : '#111827', fontWeight: 500 }}>
                            {row.projectionAmount != null ? formatAmount(row.projectionAmount) : '\u2014'}
                          </td>
                        )}
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', color: (row.ledgerAmount ?? 0) < 0 ? '#b91c1c' : '#111827', fontWeight: 500 }}>
                          {row.ledgerAmount != null ? formatAmount(row.ledgerAmount) : '\u2014'}
                        </td>
                        {isDevOrMaster && (
                          <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center' }}>
                            {row.projection ? (
                              <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => openEditProjection(row.projection)}
                                  className="wf-btn-secondary"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => row.projection && deleteProjection(row.projection.id)}
                                  className="wf-btn-danger"
                                >
                                  Delete
                                </button>
                              </div>
                            ) : (
                              '\u00a0'
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #0ea5e9' }}>
                      <td style={{ padding: '0.5rem 0.5rem', fontWeight: 600 }} colSpan={isDevOrMaster ? 2 : 2}>
                        Total
                      </td>
                      {isDevOrMaster && (
                        <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', fontWeight: 700, color: calculateProjectionsTotal() < 0 ? '#b91c1c' : '#111827' }}>
                          {formatAmount(calculateProjectionsTotal())}
                        </td>
                      )}
                      <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', fontWeight: 700, color: calculateLedgerTotal() < 0 ? '#b91c1c' : '#111827' }}>
                        {formatAmount(calculateLedgerTotal())}
                      </td>
                      {isDevOrMaster && <td style={{ padding: '0.5rem 0.5rem' }} />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          })()}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'center' }}>
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
              <p style={{ marginBottom: '1rem' }}>No stages assigned to you in this workflow.</p>
            )}
          </div>
        ) : (() => {
          const completedSteps = steps
            .filter(s => s.status === 'completed' || s.status === 'approved' || s.status === 'skipped')
            .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
          const oldCompletedSteps = completedSteps.slice(0, -1)
          const oldStepIds = new Set(oldCompletedSteps.map(s => s.id))
          type DisplayItem = { type: 'step'; step: (typeof steps)[0] } | { type: 'summary'; count: number; firstStarted: string | null }
          const displayItems: DisplayItem[] = []
          if (!oldStagesCollapsed || oldCompletedSteps.length === 0) {
            displayItems.push(...steps.map(s => ({ type: 'step' as const, step: s })))
          } else {
            let summaryEmitted = false
            for (const s of steps) {
              if (oldStepIds.has(s.id)) {
                if (!summaryEmitted) {
                  displayItems.push({
                    type: 'summary',
                    count: oldCompletedSteps.length,
                    firstStarted: oldCompletedSteps[0]?.started_at ?? null,
                  })
                  summaryEmitted = true
                }
              } else {
                displayItems.push({ type: 'step', step: s })
              }
            }
          }
          return displayItems.map((item, index) => {
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
                      color: '#6b7280',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    {item.count} previous {item.count === 1 ? 'stage' : 'stages'} · Started {formatDateShort(item.firstStarted)}
                  </div>
                </div>
              )
            }
            const s = item.step
            const isCollapsed = rowCollapsed[s.id] ?? isRowDefaultCollapsed(s)
            return (
            <div
              key={s.id}
              id={`step-${s.id}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isCollapsed ? 'center' : 'stretch',
                alignSelf: isCollapsed ? 'center' : 'stretch',
                width: isCollapsed ? 'fit-content' : '100%',
              }}
            >
              <div
                style={{
                  border: '1px solid #bae6fd',
                  borderRadius: 8,
                  padding: '0.5rem 0.75rem',
                  marginBottom: '0.25rem',
                  background: 'white',
                  ...(isCollapsed && { display: 'inline-block', width: 'fit-content', maxWidth: 'min(100%, 520px)', borderLeft: `9px solid ${getStepStatusStyle(s.status).color}` }),
                  ...(!isCollapsed && s.status === 'in_progress' && { background: '#fff7ed', borderLeft: '4px solid #E87600' }),
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
                      <span style={{ fontWeight: isCollapsed ? getStepStatusStyle(s.status).fontWeight : 600, color: isCollapsed ? getStepStatusStyle(s.status).color : '#111827' }}>{s.name}</span>
                      <span style={{ color: '#9ca3af' }}>·</span>
                      <span style={{ color: s.status === 'rejected' ? '#b91c1c' : s.status === 'skipped' ? '#6b7280' : '#374151', fontWeight: s.status === 'rejected' ? 500 : 'normal' }}>
                        {s.status === 'rejected' ? 'Previous work incomplete' : s.status === 'skipped' ? 'Skipped' : s.status}{s.status === 'rejected' && s.rejection_reason ? ` - ${s.rejection_reason}` : ''}{s.status === 'skipped' && s.skipped_reason ? ` - ${s.skipped_reason}` : ''}{s.status === 'in_progress' && (() => {
                          const d = daysOpen(s.started_at, s.ended_at)
                          return d != null ? ` · ${d === 1 ? '1 day' : `${d} days`} open` : null
                        })()}
                      </span>
                      <span style={{ color: '#9ca3af' }}>·</span>
                      <span style={{ color: '#374151' }}>
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
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500, cursor: 'pointer', color: '#6b7280' }}
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
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500, cursor: 'pointer', color: '#6b7280' }}
                              >
                                <span style={{ fontSize: '0.75rem', minWidth: 14 }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                                <span>Action Ledger ({count})</span>
                              </span>
                            )
                          })()}
                        </span>
                      )}
                      {isCollapsed && (() => {
                        const pillStyle = { display: 'inline-flex' as const, alignItems: 'center' as const, padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.7rem', color: '#6b7280', background: '#f3f4f6' }
                        const expectedPillStyle = { ...pillStyle, background: '#eff6ff', color: '#1e3a8a' }
                        const items = lineItems[s.id] || []
                        const count = items.length
                        const total = items.reduce((sum, item) => sum + (item.amount || 0), 0)
                        const notesWords = (s.notes ?? '').trim().split(/\s+/).filter(Boolean).length
                        const privateWords = (s.private_notes ?? '').trim().split(/\s+/).filter(Boolean).length
                        const d = s.status === 'in_progress' ? daysOpen(s.started_at, s.ended_at) : daysBetween(s.started_at, s.ended_at)
                        const daysPrefix = d != null ? `[${d === 1 ? '1 day' : `${d} days`}] ` : ''
                        const hasExpected = !!s.scheduled_start_date || !!s.scheduled_end_date
                        return (
                          <div style={{ flexBasis: '100%', minWidth: 0, marginTop: 4, marginLeft: 20, display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', alignSelf: 'flex-start' }}>
                            <span style={pillStyle}>
                              {daysPrefix}{formatDateShort(s.started_at)} → {formatDateShort(s.ended_at)}
                            </span>
                            {hasExpected && (
                              <span style={expectedPillStyle} title="Expected start → Expected end">
                                Exp: {formatScheduledDateShort(s.scheduled_start_date)} → {formatScheduledDateShort(s.scheduled_end_date)}
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
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>Technician:</span>
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
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 12, paddingLeft: 12, borderLeft: '1px solid #e5e7eb' }}>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>Office:</span>
                        <button type="button" onClick={() => markApproved(s)} className="wf-btn-info">
                          Approve
                        </button>
                        <button type="button" onClick={() => setRejectStep({ step: s, reason: '' })} className="wf-btn-danger">
                          Send Back: Previous Work Incomplete
                        </button>
                        <button type="button" onClick={() => setSkipStep({ step: s, reason: '' })} className="wf-btn-secondary" style={{ color: '#92400e' }}>
                          Skip
                        </button>
                      </span>
                    )}
                    {!isCollapsed && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#6b7280' }}>
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
                    color: '#2563eb',
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
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: '0.75rem', color: '#6b7280' }}>
                      <span style={{ marginLeft: 'auto' }}>
                        Expected: Start {renderField(startYmd, 'start')}
                        {' \u00B7 '}
                        End {renderField(endYmd, 'end')}
                        {lengthLabel ? ` · ${lengthLabel}` : null}
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
                        <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: '#6b7280' }}>
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
                  <div style={{ fontSize: '0.8125rem', color: '#059669', marginBottom: 4, fontWeight: 500 }}>
                    Approved by {s.approved_by} on {formatDatetime(s.approved_at)}
                  </div>
                )}
                {stepActions[s.id] && stepActions[s.id]!.length > 0 && (() => {
                  const key = `${s.id}-actionLedger`
                  const isExpanded = sectionExpanded[key] ?? false
                  return isExpanded ? (
                    <div style={{ marginBottom: 4, padding: '0.5rem 0.6rem', background: '#f9fafb', borderRadius: 4, border: '1px solid #e5e7eb' }}>
                      {stepActions[s.id]!.map((action) => (
                        <div key={action.id} style={{ marginBottom: '0.25rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                          <span style={{ fontWeight: 500, textTransform: 'capitalize', color: '#374151' }}>{action.action_type === 'rejected' ? 'Previous work incomplete' : action.action_type === 'skipped' ? 'Skipped' : action.action_type}</span>
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
                          <span>Notes for Tech ({(s.notes ?? '').trim().split(/\s+/).filter(Boolean).length} words)</span>
                        </div>
                        {isExpanded && (
                          <textarea
                            id={`notes-${s.id}`}
                            key={`notes-${s.id}-${s.notes ?? ''}`}
                            defaultValue={s.notes ?? ''}
                            onBlur={(e) => updateNotes(s, e.target.value)}
                            placeholder="Add notes (visible to everyone who can see this stage, including the assigned technician)"
                            rows={2}
                            style={{ width: '100%', padding: '0.35rem', fontSize: '0.8125rem', border: '1px solid #e5e7eb', borderRadius: 4 }}
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
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 2, fontWeight: 500, color: '#0369a1', cursor: 'pointer', fontSize: '0.8125rem' }}
                          >
                            <span style={{ fontSize: '0.75rem', minWidth: 16, color: '#111827' }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                            <span>Notes for Office ({(s.private_notes ?? '').trim().split(/\s+/).filter(Boolean).length} words)</span>
                          </div>
                          {isExpanded && (
                            <textarea
                              id={`private-notes-${s.id}`}
                              key={`private-notes-${s.id}-${s.private_notes ?? ''}`}
                              defaultValue={s.private_notes ?? ''}
                              onBlur={(e) => updatePrivateNotes(s, e.target.value)}
                              placeholder="Add private notes visible to masters, assistants, and superintendents..."
                              rows={2}
                              style={{ width: '100%', padding: '0.35rem', fontSize: '0.8125rem', border: '1px solid #bae6fd', borderRadius: 4, background: 'white' }}
                            />
                          )}
                        </>
                      )
                    })()}
                  </div>
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
                              <span style={{ fontWeight: 500, color: '#0369a1' }}>
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
                        <div style={{ fontSize: '0.8125rem', background: 'white', border: '1px solid #bae6fd', borderRadius: 4, overflow: 'hidden', width: 'fit-content' }} onClick={(e) => e.stopPropagation()}>
                        <table style={{ borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', fontWeight: 600, borderBottom: '1px solid #bae6fd' }}>Memo</th>
                              <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', fontWeight: 600, borderBottom: '1px solid #bae6fd', whiteSpace: 'nowrap' }}>Date</th>
                              <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem', fontWeight: 600, borderBottom: '1px solid #bae6fd' }}>Amount</th>
                              <th style={{ width: 1, padding: '0.35rem 0.5rem', borderBottom: '1px solid #bae6fd' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {lineItems[s.id]!.map((item, idx) => {
                              const isLast = idx === lineItems[s.id]!.length - 1
                              const rowBorder = isLast ? 'none' : '1px solid #bae6fd'
                              return (
                              <tr key={item.id}>
                                <td style={{ padding: '0.35rem 0.5rem', borderBottom: rowBorder, verticalAlign: 'middle' }}>
                                  {item.link && item.link.trim() && normalizeUrl(item.link) ? (
                                    <a
                                      href={normalizeUrl(item.link)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ color: '#2563eb', textDecoration: 'underline' }}
                                      title={item.link}
                                    >
                                      {item.memo}
                                    </a>
                                  ) : (
                                    <span>{item.memo}</span>
                                  )}
                                </td>
                                <td style={{ padding: '0.35rem 0.5rem', borderBottom: rowBorder, verticalAlign: 'middle', fontSize: '0.8125rem', color: '#4b5563', whiteSpace: 'nowrap' }}>
                                  {formatLineItemDate(item.item_date)}
                                </td>
                                <td style={{ padding: '0.35rem 0.5rem', borderBottom: rowBorder, textAlign: 'right', color: (item.amount || 0) < 0 ? '#b91c1c' : '#374151', fontWeight: 500, verticalAlign: 'middle' }}>
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
                                      style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#374151', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
                                      style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
                      <p style={{ fontSize: '0.8125rem', color: '#92400e', margin: 0, fontStyle: 'italic', textAlign: 'center' }}>No line items yet. Click "Add Line Item" to add one.</p>
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
              {index < displayItems.length - 1 && <div style={{ textAlign: 'center', marginBottom: '0.15rem', color: '#9ca3af' }}>{"\u2193"}</div>}
            </div>
            )
          })
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

      {confirmDeleteLineItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Delete line item?</h3>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {confirmDeleteLineItem.item.memo}
              {confirmDeleteLineItem.item.amount != null && (
                <span> — {formatAmount(confirmDeleteLineItem.item.amount)}</span>
              )}
              {confirmDeleteLineItem.item.item_date && (
                <span style={{ display: 'block', marginTop: 4 }}>
                  Date: {formatLineItemDate(confirmDeleteLineItem.item.item_date)}
                </span>
              )}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={async () => {
                  await deleteLineItem(confirmDeleteLineItem.item.id)
                  setConfirmDeleteLineItem(null)
                }}
                className="wf-btn-modal-primary wf-btn-danger-style"
              >
                Delete
              </button>
              <button type="button" onClick={() => setConfirmDeleteLineItem(null)} className="wf-btn-modal-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Delete step: {confirmDeleteStep.name}?</h3>
            {isStepEmpty(confirmDeleteStep) ? (
              <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>This step has no assignee, notes, or line items.</p>
            ) : (
              <>
                <p style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  This step has content (assignee, notes, line items, or has been started). Deleting will permanently remove it and related data.
                </p>
                <p style={{ marginBottom: 8, fontSize: '0.875rem' }}>Type &quot;{confirmDeleteStep.name}&quot; to confirm:</p>
                <input
                  value={deleteStepConfirmText}
                  onChange={(e) => setDeleteStepConfirmText(e.target.value)}
                  placeholder={confirmDeleteStep.name}
                  style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
                />
              </>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={async () => {
                  await deleteStep(confirmDeleteStep)
                  setConfirmDeleteStep(null)
                  setDeleteStepConfirmText('')
                }}
                disabled={!isStepEmpty(confirmDeleteStep) && deleteStepConfirmText.trim() !== confirmDeleteStep.name}
                className="wf-btn-modal-primary wf-btn-danger-style"
              >
                Delete
              </button>
              <button type="button" onClick={() => { setConfirmDeleteStep(null); setDeleteStepConfirmText('') }} className="wf-btn-modal-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
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
              <button type="button" onClick={submitReject} className="wf-btn-modal-primary wf-btn-danger-style">Send Back: Previous Work Incomplete</button>
              <button type="button" onClick={() => setRejectStep(null)} className="wf-btn-modal-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {skipStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
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
              <button type="button" onClick={() => setSkipStep((s) => s ? { ...s, reason: 'Not relevant' } : null)} className="wf-btn-ghost" style={{ fontSize: '0.8125rem' }}>
                Not relevant
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={submitSkip} disabled={!skipStep.reason.trim()} className="wf-btn-modal-primary" style={skipStep.reason.trim() ? {} : { opacity: 0.5, cursor: 'not-allowed' }}>
                Skip
              </button>
              <button type="button" onClick={() => setSkipStep(null)} className="wf-btn-modal-secondary">Cancel</button>
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
              <button type="button" onClick={submitSetStart} className="wf-btn-modal-primary">Set Start</button>
              <button type="button" onClick={() => setSetStartStep(null)} className="wf-btn-modal-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {expectedDatesStep && (() => {
        const current = expectedDatesStep
        const setField = (patch: Partial<typeof current>) => {
          setExpectedDatesStep((prev) => (prev ? { ...prev, ...patch } : null))
        }
        const handleStartChange = (value: string) => {
          const len = current.lengthDays.trim()
          const lenNum = len === '' ? NaN : Number(len)
          if (value && len !== '' && Number.isFinite(lenNum)) {
            setField({ expectedStart: value, expectedEnd: ymdAddDays(value, lenNum), seededFromPrior: false })
          } else if (value && current.expectedEnd) {
            const newLen = ymdDaysBetween(value, current.expectedEnd)
            setField({ expectedStart: value, lengthDays: newLen != null ? String(newLen) : '', seededFromPrior: false })
          } else {
            setField({ expectedStart: value, seededFromPrior: false })
          }
        }
        const handleEndChange = (value: string) => {
          if (value && current.expectedStart) {
            const newLen = ymdDaysBetween(current.expectedStart, value)
            setField({ expectedEnd: value, lengthDays: newLen != null ? String(newLen) : '' })
          } else {
            setField({ expectedEnd: value })
          }
        }
        const handleLengthChange = (value: string) => {
          const trimmed = value.trim()
          if (trimmed === '') {
            setField({ lengthDays: '' })
            return
          }
          const num = Number(trimmed)
          if (!Number.isFinite(num)) {
            setField({ lengthDays: value })
            return
          }
          if (current.expectedStart) {
            setField({ lengthDays: value, expectedEnd: ymdAddDays(current.expectedStart, num) })
          } else {
            setField({ lengthDays: value })
          }
        }
        const lengthNum = current.lengthDays.trim() === '' ? null : Number(current.lengthDays)
        const lengthInvalid = current.lengthDays.trim() !== '' && (!Number.isFinite(lengthNum ?? NaN) || (lengthNum != null && lengthNum < 0))
        const endBeforeStart = !!current.expectedStart && !!current.expectedEnd && (ymdDaysBetween(current.expectedStart, current.expectedEnd) ?? 0) < 0
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Expected dates for ${current.step.name}`}
            onClick={() => setExpectedDatesStep(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 340, maxWidth: '95%' }}
            >
              <h3 style={{ marginTop: 0, marginBottom: '0.25rem' }}>Expected dates: {current.step.name}</h3>
              <p style={{ marginTop: 0, marginBottom: '1rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                Plan the expected start and end. Type a length in days to auto-compute the end from the start.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.8125rem', color: '#374151' }}>Expected start</span>
                  <input
                    type="date"
                    value={current.expectedStart}
                    onChange={(e) => handleStartChange(e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.8125rem', color: '#374151' }}>Expected end</span>
                  <input
                    type="date"
                    value={current.expectedEnd}
                    onChange={(e) => handleEndChange(e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db' }}
                  />
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8125rem', color: '#374151' }}>
                  Length (days){' '}
                  <span style={{ color: '#6b7280', fontWeight: 400 }}>· auto-computes end from start</span>
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  placeholder="e.g. 5"
                  value={current.lengthDays}
                  onChange={(e) => handleLengthChange(e.target.value)}
                  style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db', maxWidth: 160 }}
                />
              </label>
              {current.seededFromPrior && (
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: '#1e3a8a' }}>
                  Start was prefilled from the previous stage's expected end.
                </p>
              )}
              {lengthInvalid && (
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: '#b91c1c' }}>
                  Length must be a non-negative number.
                </p>
              )}
              {endBeforeStart && (
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: '#b91c1c' }}>
                  Expected end is before expected start.
                </p>
              )}
              {current.hasNextStage && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', fontSize: '0.8125rem', color: '#374151' }}>
                  <input
                    type="checkbox"
                    checked={current.updateNextStage}
                    onChange={(e) => setField({ updateNextStage: e.target.checked })}
                  />
                  Also set the next stage's expected start to this stage's expected end
                </label>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={clearExpectedDates}
                  className="wf-btn-modal-secondary"
                  disabled={!current.step.scheduled_start_date && !current.step.scheduled_end_date}
                  title="Remove the expected start and end from this stage"
                >
                  Clear
                </button>
                <button type="button" onClick={() => setExpectedDatesStep(null)} className="wf-btn-modal-secondary">
                  Cancel
                </button>
                <button type="button" onClick={submitExpectedDates} className="wf-btn-modal-primary">
                  Save
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {assignPersonStep && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => { setAssignPersonStep(null); setAssignPersonFilter('') }}
        >
          <div
            style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 280, maxWidth: 400, maxHeight: '80vh', display: 'flex', flexDirection: 'column', color: '#111827' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, color: '#111827', flexShrink: 0 }}>Add person to: {assignPersonStep.name}</h3>
            <p style={{ fontSize: '0.875rem', color: '#111827', marginBottom: '0.75rem', flexShrink: 0 }}>Choose from your roster.</p>
            {(roster.length > 5 || currentUserName) && (
              <input
                type="search"
                placeholder="Filter..."
                value={assignPersonFilter}
                onChange={(e) => setAssignPersonFilter(e.target.value)}
                autoFocus
                style={{ width: '100%', padding: '0.5rem', marginBottom: '0.75rem', borderRadius: 6, border: '1px solid #e5e7eb', flexShrink: 0 }}
              />
            )}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginBottom: '1rem' }}>
              {roster.length === 0 && !currentUserName ? (
                <p style={{ color: '#111827' }}>No people in your roster yet. Add them on the People page.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(() => {
                    const q = assignPersonFilter.trim().toLowerCase()
                    const matches = (name: string) => !q || name.toLowerCase().includes(q)
                  return (
                    <>
                  {/* Always show current user first */}
                  {currentUserName && matches(currentUserName) && (
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
                    .filter((r) => r.name !== currentUserName && matches(r.name))
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
                    </>
                  )
                  })()}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0, paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
              <button type="button" onClick={() => assignPerson(assignPersonStep, null)} className="wf-btn-modal-secondary">Clear</button>
              <button type="button" onClick={() => { setAssignPersonStep(null); setAssignPersonFilter('') }} className="wf-btn-modal-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editingLineItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, flex: 1 }}>{editingLineItem.item ? 'Edit' : 'Add'} Line Item</h3>
              {!editingLineItem.item && (
                <button
                  type="button"
                  onClick={() => void importLineItemsFromClipboard()}
                  disabled={lineItemPasteImporting}
                  title="Import tab-separated rows from clipboard (date, memo, amount per line)"
                  aria-label="Import line items from clipboard"
                  className="wf-btn-modal-secondary"
                  style={{
                    padding: '0.35rem 0.5rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    opacity: lineItemPasteImporting ? 0.6 : 1,
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={22} height={22} fill="currentColor" aria-hidden>
                    <path d="M360 160L280 160C266.7 160 256 149.3 256 136C256 122.7 266.7 112 280 112L360 112C373.3 112 384 122.7 384 136C384 149.3 373.3 160 360 160zM360 208C397.1 208 427.6 180 431.6 144L448 144C456.8 144 464 151.2 464 160L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 160C176 151.2 183.2 144 192 144L208.4 144C212.4 180 242.9 208 280 208L360 208zM419.9 96C407 76.7 385 64 360 64L280 64C255 64 233 76.7 220.1 96L192 96C156.7 96 128 124.7 128 160L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 160C512 124.7 483.3 96 448 96L419.9 96z" />
                  </svg>
                </button>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveLineItem(
                  editingLineItem.stepId,
                  editingLineItem.item,
                  editingLineItem.link,
                  editingLineItem.memo,
                  editingLineItem.amount,
                  editingLineItem.itemDate
                )
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="line-item-date" style={{ display: 'block', marginBottom: 4 }}>Date (optional)</label>
                <input
                  id="line-item-date"
                  type="date"
                  value={editingLineItem.itemDate}
                  onChange={(e) => setEditingLineItem({ ...editingLineItem, itemDate: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
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
                <button type="submit" className="wf-btn-modal-primary">Save</button>
                <button type="button" onClick={() => setEditingLineItem(null)} className="wf-btn-modal-secondary">Cancel</button>
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
                <button type="submit" className="wf-btn-modal-primary">Save</button>
                <button type="button" onClick={() => setEditingProjection(null)} className="wf-btn-modal-secondary">Cancel</button>
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
                className="wf-btn-modal-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Supply House Invoice to Step Modal */}
      {addingInvoiceToStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>Add Supply House Invoice to Step</h3>
            {availableInvoices.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No supply house invoices available. Add invoices in Materials → Supply Houses.</p>
            ) : (
              <div style={{ marginTop: '1rem' }}>
                <input
                  type="search"
                  placeholder="Search by invoice #, supply house, amount, date, PO #, paid/unpaid..."
                  value={invoiceSearchText}
                  onChange={(e) => setInvoiceSearchText(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', marginBottom: '0.75rem', borderRadius: 6, border: '1px solid #e5e7eb' }}
                />
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, maxHeight: '400px', overflow: 'auto' }}>
                  {(() => {
                    const q = invoiceSearchText.trim().toLowerCase()
                    const filtered = q
                      ? availableInvoices.filter(inv =>
                          inv.invoice_number.toLowerCase().includes(q) ||
                          inv.supply_house_name.toLowerCase().includes(q) ||
                          String(inv.amount).includes(q) ||
                          inv.invoice_date.toLowerCase().includes(q) ||
                          (inv.purchase_order_number?.toLowerCase().includes(q) ?? false) ||
                          (q === 'paid' && inv.is_paid) ||
                          (q === 'unpaid' && !inv.is_paid)
                        )
                      : availableInvoices
                    if (filtered.length === 0) {
                      return <p style={{ padding: '1rem', color: '#6b7280' }}>No matching invoices.</p>
                    }
                    return filtered.map(inv => (
                      <div
                        key={inv.id}
                        onClick={() => addInvoiceToStep(addingInvoiceToStep, inv.id)}
                        style={{
                          padding: '1rem',
                          borderBottom: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          background: 'white',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      >
                        {/* Primary: supply house, date, amount, PO */}
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                          {inv.supply_house_name}
                          <span style={{ color: '#6b7280', fontWeight: 400 }}> · {formatDateShort(inv.invoice_date)} · ${inv.amount.toFixed(2)}</span>
                          {inv.purchase_order_number && <span style={{ color: '#6b7280', fontWeight: 400 }}> · {inv.purchase_order_number}</span>}
                        </div>
                        {/* Secondary: invoice #, due, paid */}
                        <div style={{ fontSize: '0.8125rem', color: '#9ca3af', display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                          <span>#{inv.invoice_number}</span>
                          {inv.due_date && <span>Due {formatDateShort(inv.due_date)}</span>}
                          {inv.is_paid && <span style={{ color: '#059669', fontWeight: 500 }}>Paid</span>}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              </div>
            )}
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setAddingInvoiceToStep(null); setInvoiceSearchText('') }}
                className="wf-btn-modal-secondary"
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
                className="wf-btn-modal-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Supply House Invoice Details Modal */}
      {viewingInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: 8, minWidth: 320, maxWidth: '90%' }}>
            <h2 style={{ marginBottom: '1rem' }}>Invoice #{viewingInvoice.invoice_number}</h2>
            <div style={{ marginBottom: '1rem', fontSize: '0.9375rem' }}>
              <div style={{ marginBottom: '0.5rem' }}><strong>Supply House:</strong> {viewingInvoice.supply_house_name}</div>
              <div style={{ marginBottom: '0.5rem' }}><strong>Amount:</strong> {formatAmount(viewingInvoice.amount)}</div>
              {viewingInvoice.link && (
                <div>
                  <a href={normalizeUrl(viewingInvoice.link)} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                    View invoice link
                  </a>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setViewingInvoice(null)}
                className="wf-btn-modal-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
            style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: '90%' }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '0.25rem' }}>{personContactModal.name}</h3>
            {!personContactModal.isUser && (
              <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.75rem' }}>Not a user</div>
            )}
            <div style={{ fontSize: '0.9375rem', display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
              <div>
                <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>Email:</span>
                {personContactModal.email ? (
                  <a href={`mailto:${personContactModal.email}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                    {personContactModal.email}
                  </a>
                ) : (
                  <span style={{ color: '#9ca3af' }}>—</span>
                )}
              </div>
              <div>
                <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>Phone:</span>
                {personContactModal.phone ? (
                  <a href={`tel:${personContactModal.phone}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                    {personContactModal.phone}
                  </a>
                ) : (
                  <span style={{ color: '#9ca3af' }}>—</span>
                )}
              </div>
              {!personContactModal.email && !personContactModal.phone && (
                <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
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

function StepFormModal({
  viewerRole,
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
  viewerRole: 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'helpers' | 'superintendent' | null
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

    const { data: me } = await supabase.from('users').select('role').eq('id', authUser.id).single()
    const role = (me as { role: string } | null)?.role

    let usersRes: { data: Array<{ name: string | null; role: string }> | null }
    let peopleRes: { data: Array<{ name: string; kind: string }> | null }

    if (role === 'superintendent') {
      const { data: adopted } = await supabase
        .from('master_superintendents')
        .select('master_id')
        .eq('superintendent_id', authUser.id)
      const adoptedMasterIds = (adopted ?? []).map((r) => r.master_id)
      ;[usersRes, peopleRes] = await Promise.all([
        supabase.from('users').select('name, role').in('role', ['master_technician', 'subcontractor', 'helpers', 'primary']),
        adoptedMasterIds.length > 0
          ? supabase.from('people').select('name, kind').is('archived_at', null).in('master_user_id', adoptedMasterIds).in('kind', ['master_technician', 'sub', 'helper'])
          : { data: [] as Array<{ name: string; kind: string }> },
      ])
    } else {
      ;[usersRes, peopleRes] = await Promise.all([
        supabase.from('users').select('name, role').in('role', ['master_technician', 'subcontractor', 'helpers', 'primary']),
        supabase.from('people').select('name, kind').is('archived_at', null).eq('master_user_id', authUser.id).in('kind', ['master_technician', 'sub', 'helper']),
      ])
    }
    
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
      supabase.from('people').select('id, name').is('archived_at', null),
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
    
    const offRosterKind: 'sub' | 'helper' = viewerRole === 'helpers' ? 'helper' : 'sub'
    // Create new person (default to helper/sub for helpers/subcontractor field users)
    const { error: err } = await supabase
      .from('people')
      .insert({
        master_user_id: authUser.id,
        kind: offRosterKind,
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
              <button type="button" className="wf-btn-secondary" style={{ whiteSpace: 'nowrap' }}>
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
                  onClick={() => setName((prev: string | undefined) => (prev ? `${prev}, ${phrase}` : phrase))}
                  className="wf-btn-secondary"
                  style={{ whiteSpace: 'nowrap' }}
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
            <button type="submit" className="wf-btn-modal-primary">Save</button>
            {onCopy && (
              <button type="button" onClick={onCopy} className="wf-btn-modal-primary">
                Copy
              </button>
            )}
            <button type="button" onClick={onClose} className="wf-btn-modal-secondary">Cancel</button>
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
                  onChange={(e) => setNewPerson((p) => ({ ...p, name: e.target.value }))}
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
                  onChange={(e) => setNewPerson((p) => ({ ...p, email: e.target.value }))}
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
                  onChange={(e) => setNewPerson((p) => ({ ...p, phone: e.target.value }))}
                  disabled={savingPerson}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="new-person-notes" style={{ display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea
                  id="new-person-notes"
                  value={newPerson.notes}
                  onChange={(e) => setNewPerson((p) => ({ ...p, notes: e.target.value }))}
                  disabled={savingPerson}
                  rows={2}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={savingPerson} className="wf-btn-modal-primary">
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
                  className="wf-btn-modal-secondary"
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
