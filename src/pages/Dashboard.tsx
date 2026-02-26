import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { openInExternalBrowser } from '../lib/openInExternalBrowser'
import { useAuth } from '../hooks/useAuth'
import NewReportModal from '../components/NewReportModal'
import ReportViewModal from '../components/ReportViewModal'
import JobReportsModal from '../components/JobReportsModal'
import AdditionalReportModal from '../components/AdditionalReportModal'
import JobBillDetailsModal from '../components/JobBillDetailsModal'
import ReportEditModal, { type ReportForEdit } from '../components/ReportEditModal'
import MyReportsModal, { type ReportForMyReports } from '../components/MyReportsModal'
import {
  getPinned,
  getPinnedForUserFromSupabase,
  type PinnedItem,
} from '../lib/pinnedTabs'
import { useToastContext } from '../contexts/ToastContext'
import { useCostMatrixTotal } from '../hooks/useCostMatrixTotal'
import { useARTotal } from '../hooks/useARTotal'
import { useSupplyHousesAPTotal } from '../hooks/useSupplyHousesAPTotal'
import { useExternalTeamTotal } from '../hooks/useExternalTeamTotal'
import type { Database } from '../types/database'

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatTimeSince(iso: string | null): string {
  if (!iso) return '—'
  const now = new Date()
  const then = new Date(iso)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  const diffWeeks = Math.floor(diffMs / 604800000)
  const diffMonths = Math.floor(diffMs / 2592000000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''}`
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''}`
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`
  return `${Math.floor(diffMonths / 12)} year${Math.floor(diffMonths / 12) !== 1 ? 's' : ''}`
}

function fromDatetimeLocal(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  return new Date(v).toISOString()
}

type SubscribedStep = {
  step_id: string
  step_name: string
  project_id: string
  project_name: string
  notify_when_started: boolean
  notify_when_complete: boolean
  notify_when_reopened: boolean
}

type Step = Database['public']['Tables']['project_workflow_steps']['Row']
type AssignedStep = Step & {
  project_id: string
  project_name: string
  project_address: string | null
  project_plans_link: string | null
  workflow_id: string
}

function formatDatetime(iso: string | null): string {
  if (!iso) return 'unknown'
  const date = new Date(iso)
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
  const dateTime = date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  return `${weekday}, ${dateTime}`
}

function personDisplay(name: string | null, userNames: Set<string>): string {
  if (!name || !name.trim()) {
    return 'Assigned to: unknown'
  }
  const trimmedName = name.trim()
  const isUser = userNames.has(trimmedName.toLowerCase())
  return isUser ? trimmedName : `${trimmedName} (not a user)`
}

function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type ChecklistInstance = {
  id: string
  checklist_item_id: string
  scheduled_date: string
  assigned_to_user_id: string
  completed_at: string | null
  notes: string | null
  completed_by_user_id: string | null
  created_at: string | null
  checklist_items?: { title: string } | null
}

const skeletonStyle = { background: '#f3f4f6', borderRadius: 8 }

// Paths each role can access (for filtering pinned items). When role is null, treat as primary to prevent flash.
const SUBCONTRACTOR_PATHS = new Set(['/', '/dashboard', '/calendar', '/checklist', '/settings', '/tally'])
const ESTIMATOR_PATHS = new Set(['/dashboard', '/materials', '/bids', '/calendar', '/checklist', '/settings', '/tally'])
const PRIMARY_PATHS = new Set(['/dashboard', '/projects', '/materials', '/jobs', '/bids', '/calendar', '/checklist', '/settings', '/tally'])

function getAllowedPathsForRole(role: string | null): Set<string> | null {
  if (role === 'subcontractor') return SUBCONTRACTOR_PATHS
  if (role === 'estimator') return ESTIMATOR_PATHS
  if (role === 'primary' || role === null) return PRIMARY_PATHS
  return null // dev, master_technician, assistant: no filter (all paths allowed)
}

function filterPinnedByRole(pins: PinnedItem[], role: string | null): PinnedItem[] {
  const allowed = getAllowedPathsForRole(role)
  if (!allowed) return pins
  return pins.filter((p) => allowed.has(p.path))
}

function ChecklistSkeleton() {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {[1, 2, 3].map((i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{ ...skeletonStyle, width: 18, height: 18, flexShrink: 0 }} />
          <div style={{ ...skeletonStyle, flex: 1, height: 20 }} />
        </li>
      ))}
    </ul>
  )
}

function AssignedSkeleton() {
  return (
    <div>
      {[1, 2].map((i) => (
        <div key={i} style={{ padding: '1rem', marginBottom: '0.75rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <div style={{ ...skeletonStyle, height: 18, width: '60%', marginBottom: 8 }} />
          <div style={{ ...skeletonStyle, height: 14, width: '40%', marginBottom: 8 }} />
          <div style={{ ...skeletonStyle, height: 14, width: '30%' }} />
        </div>
      ))}
    </div>
  )
}

function SubscribedSkeleton() {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {[1, 2].map((i) => (
        <li key={i} style={{ padding: '0.75rem 0', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ ...skeletonStyle, height: 16, width: '50%', marginBottom: 4 }} />
          <div style={{ ...skeletonStyle, height: 14, width: '35%' }} />
        </li>
      ))}
    </ul>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user: authUser, role } = useAuth()
  const [subscribedSteps, setSubscribedSteps] = useState<SubscribedStep[]>([])
  const [assignedSteps, setAssignedSteps] = useState<AssignedStep[]>([])
  const [todayChecklist, setTodayChecklist] = useState<ChecklistInstance[]>([])
  const [completingChecklistId, setCompletingChecklistId] = useState<string | null>(null)
  const [userError, setUserError] = useState<string | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [checklistLoading, setChecklistLoading] = useState(true)
  const [assignedLoading, setAssignedLoading] = useState(true)
  const [subscribedLoading, setSubscribedLoading] = useState(true)
  const [userNames, setUserNames] = useState<Set<string>>(new Set())
  const [rejectStep, setRejectStep] = useState<{ step: AssignedStep; reason: string } | null>(null)
  const [setStartStep, setSetStartStep] = useState<{ step: AssignedStep; startDateTime: string } | null>(null)
  const [sendTaskUsers, setSendTaskUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [fwdInstance, setFwdInstance] = useState<ChecklistInstance | null>(null)
  const [fwdTitle, setFwdTitle] = useState('')
  const [fwdAssigneeId, setFwdAssigneeId] = useState('')
  const [fwdSaving, setFwdSaving] = useState(false)
  const [pinnedRoutes, setPinnedRoutes] = useState<PinnedItem[]>([])
  const [completedItemsOpen, setCompletedItemsOpen] = useState(false)
  const [completedItems, setCompletedItems] = useState<ChecklistInstance[]>([])
  const [completedItemsLoading, setCompletedItemsLoading] = useState(false)
  const [readInstanceIds, setReadInstanceIds] = useState<Set<string>>(new Set())
  const [expandedCompleterIds, setExpandedCompleterIds] = useState<Set<string>>(new Set())
  const [markingReadId, setMarkingReadId] = useState<string | null>(null)
  const [completedItemsUserMap, setCompletedItemsUserMap] = useState<Map<string, string>>(new Map())
  const [recentReports, setRecentReports] = useState<Array<{ id: string; template_name: string; job_display_name: string; created_at: string; created_by_name: string; field_values?: Record<string, string> }>>([])
  const [recentReportsLoading, setRecentReportsLoading] = useState(false)
  const [isReportEnabledOnlyUser, setIsReportEnabledOnlyUser] = useState(false)
  const [newReportModalOpen, setNewReportModalOpen] = useState(false)
  const [viewReportModalOpen, setViewReportModalOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState<{ id: string; template_name: string; job_display_name: string; created_at: string; created_by_name: string; field_values?: Record<string, string> } | null>(null)
  const [readReportIds, setReadReportIds] = useState<Set<string>>(new Set())
  const [hiddenReportIds, setHiddenReportIds] = useState<Set<string>>(new Set())
  const [myReports, setMyReports] = useState<Array<{ id: string; template_id: string; template_name: string; job_display_name: string; job_ledger_id?: string | null; project_id?: string | null; created_at: string; created_by_name: string; field_values?: Record<string, string> }>>([])
  const [myReportsLoading, setMyReportsLoading] = useState(false)
  const [reportEditWindowDays, setReportEditWindowDays] = useState(2)
  const [editReportModalOpen, setEditReportModalOpen] = useState(false)
  const [reportForEdit, setReportForEdit] = useState<ReportForEdit | null>(null)
  const [myReportsModalOpen, setMyReportsModalOpen] = useState(false)
  const [recentReportsExpanded, setRecentReportsExpanded] = useState(false)
  const [assignedJobs, setAssignedJobs] = useState<Array<{ id: string; hcp_number: string; job_name: string; job_address: string; google_drive_link: string | null; job_plans_link: string | null; revenue: number | null; created_at: string | null }>>([])
  const [assignedJobsLoading, setAssignedJobsLoading] = useState(false)
  const [readyToBillJobs, setReadyToBillJobs] = useState<Array<{ id: string; hcp_number: string; job_name: string; job_address: string; google_drive_link: string | null; job_plans_link: string | null; revenue: number | null; created_at: string | null }>>([])
  const [readyToBillLoading, setReadyToBillLoading] = useState(false)
  const [waitingForPaymentJobs, setWaitingForPaymentJobs] = useState<Array<{ id: string; hcp_number: string; job_name: string; job_address: string; google_drive_link: string | null; job_plans_link: string | null; revenue: number | null; created_at: string | null }>>([])
  const [waitingForPaymentLoading, setWaitingForPaymentLoading] = useState(false)
  const [jobStatusUpdatingId, setJobStatusUpdatingId] = useState<string | null>(null)
  const [viewReportsJob, setViewReportsJob] = useState<{ id: string; hcpNumber: string; jobName: string; jobAddress: string } | null>(null)
  const [leaveReportJob, setLeaveReportJob] = useState<{ id: string; hcpNumber: string; jobName: string; jobAddress: string } | null>(null)
  const [viewBillDetailsJob, setViewBillDetailsJob] = useState<{ id: string; hcpNumber: string; jobName: string; jobAddress: string; revenue: number | null } | null>(null)
  const [dashboardButtonVisibility, setDashboardButtonVisibility] = useState<Record<string, boolean> | null>(null)
  const [readyForBillingJob, setReadyForBillingJob] = useState<{ id: string; hcpNumber: string; jobName: string } | null>(null)
  const [readyForBillingChecked1, setReadyForBillingChecked1] = useState(false)
  const [readyForBillingChecked2, setReadyForBillingChecked2] = useState(false)
  const [sendBackJob, setSendBackJob] = useState<{ id: string; hcpNumber: string; jobName: string; toStatus: 'working' | 'ready_to_bill' } | null>(null)
  const [sendBackChecked, setSendBackChecked] = useState(false)
  const [sendBackSentBy, setSendBackSentBy] = useState<string | null>(null)

  const isDev = role === 'dev'
  const { showToast } = useToastContext()
  const visiblePins = filterPinnedByRole(pinnedRoutes, role)
  const pinsToShow = visiblePins.filter((p) => p.path !== '/dashboard' && p.path !== '/')
  const hasCostMatrixPin = visiblePins.some((p) => p.path === '/people' && p.tab === 'pay')
  const hasARPin = visiblePins.some((p) => p.path === '/jobs' && p.tab === 'receivables')
  const hasSupplyHousesAPPin = visiblePins.some((p) => p.path === '/materials' && p.tab === 'supply-houses')
  const hasExternalTeamPin = visiblePins.some((p) => p.path === '/materials' && p.tab === 'external-team')
  const [financialRefreshKey, setFinancialRefreshKey] = useState(0)
  const { total: costMatrixTotal } = useCostMatrixTotal(hasCostMatrixPin)
  const { total: arTotal } = useARTotal(hasARPin, financialRefreshKey)
  const { total: supplyHousesAPTotal } = useSupplyHousesAPTotal(hasSupplyHousesAPPin, financialRefreshKey)
  const { total: externalTeamTotal } = useExternalTeamTotal(hasExternalTeamPin, financialRefreshKey)

  // Load users for Forward modal (dev-only)
  useEffect(() => {
    if (!isDev) return
    supabase.from('users').select('id, name, email').order('name').then(({ data }) => {
      setSendTaskUsers((data ?? []) as Array<{ id: string; name: string; email: string }>)
    })
  }, [isDev])

  async function refreshPinned() {
    if (!authUser?.id) {
      setPinnedRoutes([])
      return
    }
    const local = getPinned(authUser.id)
    const fromDb = await getPinnedForUserFromSupabase(authUser.id)
    const seen = new Set<string>()
    const merged: PinnedItem[] = []
    for (const p of [...local, ...fromDb]) {
      const key = p.path + '|' + (p.tab ?? '')
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(p)
    }
    setPinnedRoutes(merged)
  }

  useEffect(() => {
    refreshPinned()
  }, [authUser?.id])

  useEffect(() => {
    if (!authUser?.id || (role !== 'dev' && role !== 'master_technician' && role !== 'assistant')) {
      setDashboardButtonVisibility(null)
      return
    }
    supabase
      .from('user_dashboard_buttons')
      .select('button_key, visible')
      .eq('user_id', authUser.id)
      .then(({ data }) => {
        const defaults: Record<string, boolean> = { job: true, job_labor: true, bid: true, project: true, part: true, assembly: true }
        const map = { ...defaults }
        for (const r of (data ?? []) as Array<{ button_key: string; visible: boolean }>) {
          if (r.button_key in map) map[r.button_key] = r.visible
        }
        setDashboardButtonVisibility(map)
      })
  }, [authUser?.id, role])

  useEffect(() => {
    const onPinsChanged = () => {
      refreshPinned()
      setFinancialRefreshKey((k) => k + 1)
    }
    window.addEventListener('pipetooling-pins-changed', onPinsChanged)
    window.addEventListener('focus', onPinsChanged)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshPinned()
        setFinancialRefreshKey((k) => k + 1)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pipetooling-pins-changed', onPinsChanged)
      window.removeEventListener('focus', onPinsChanged)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [authUser?.id])

  useEffect(() => {
    if (!authUser?.id) return
    const channel = supabase
      .channel('user-pinned-tabs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'user_pinned_tabs',
        filter: `user_id=eq.${authUser.id}`,
      }, () => { refreshPinned() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [authUser?.id])

  // Realtime: refresh financial pin totals when underlying data changes
  useEffect(() => {
    if (!authUser?.id || (!hasARPin && !hasSupplyHousesAPPin && !hasExternalTeamPin)) return
    const channel = supabase
      .channel('dashboard-financial-pins')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs_receivables' }, () => setFinancialRefreshKey((k) => k + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supply_house_invoices' }, () => setFinancialRefreshKey((k) => k + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'external_team_job_payments' }, () => setFinancialRefreshKey((k) => k + 1))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [authUser?.id, hasARPin, hasSupplyHousesAPPin, hasExternalTeamPin])

  useEffect(() => {
    if (!authUser?.id) return
    supabase.from('report_enabled_users').select('user_id').eq('user_id', authUser.id).maybeSingle().then(({ data }) => {
      setIsReportEnabledOnlyUser(!!data)
    })
  }, [authUser?.id])

  const loadRecentReportsRef = useRef<() => void>(() => {})
  const loadMyReportsRef = useRef<() => void>(() => {})

  const showMyReports = role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'primary' || role === 'subcontractor'

  useEffect(() => {
    if (!authUser?.id) return
    const showRecent = (role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'primary') || ((role === 'subcontractor' || role === 'estimator') && isReportEnabledOnlyUser)
    if (!showRecent) return
    setRecentReportsLoading(true)
    const load = async () => {
      try {
        const { data } = await supabase.rpc('list_reports_with_job_info')
        const arr = Array.isArray(data) ? data : []
        const list = arr.slice(0, 8).map((r: { id: string; template_name: string; job_display_name: string; created_at: string; created_by_name: string; field_values?: unknown }) => ({
          id: r.id,
          template_name: r.template_name,
          job_display_name: r.job_display_name,
          created_at: r.created_at,
          created_by_name: r.created_by_name,
          field_values: r.field_values as Record<string, string> | undefined,
        }))
        setRecentReports(list)
      } finally {
        setRecentReportsLoading(false)
      }
    }
    loadRecentReportsRef.current = load
    load()
  }, [authUser?.id, role, isReportEnabledOnlyUser])

  useEffect(() => {
    if (!authUser?.id || !showMyReports) return
    setMyReportsLoading(true)
    const load = async () => {
      try {
        const [{ data: reportSettings }, { data }] = await Promise.all([
          supabase.from('app_settings').select('key, value_num').eq('key', 'report_edit_window_days').maybeSingle(),
          supabase.rpc('list_my_reports'),
        ])
        const editDays = (reportSettings as { value_num?: number } | null)?.value_num ?? 2
        setReportEditWindowDays(typeof editDays === 'number' ? editDays : 2)
        const arr = Array.isArray(data) ? data : []
        const list = arr.map((r: { id: string; template_id: string; template_name: string; job_display_name: string; job_ledger_id?: string | null; project_id?: string | null; created_at: string; created_by_name: string; field_values?: unknown }) => ({
          id: r.id,
          template_id: r.template_id,
          template_name: r.template_name,
          job_display_name: r.job_display_name,
          job_ledger_id: r.job_ledger_id ?? null,
          project_id: r.project_id ?? null,
          created_at: r.created_at,
          created_by_name: r.created_by_name,
          field_values: r.field_values as Record<string, string> | undefined,
        }))
        setMyReports(list)
      } finally {
        setMyReportsLoading(false)
      }
    }
    loadMyReportsRef.current = load
    load()
  }, [authUser?.id, showMyReports])

  useEffect(() => {
    const showRecent = (role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'primary') || ((role === 'subcontractor' || role === 'estimator') && isReportEnabledOnlyUser)
    if (!showRecent && !showMyReports) return
    const channel = supabase
      .channel('dashboard-reports-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        loadRecentReportsRef.current?.()
        loadMyReportsRef.current?.()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [role, isReportEnabledOnlyUser, showMyReports])

  useEffect(() => {
    if (!authUser?.id) {
      setUserLoading(false)
      return
    }
    let cancelled = false
    setUserError(null)
    setUserLoading(true)
    setChecklistLoading(true)
    setAssignedLoading(true)
    setSubscribedLoading(true)

    const today = toLocalDateString(new Date())

    // Phase 1: Parallel fetch user name, allUsers, subs, checklist (role from useAuth)
    Promise.all([
      supabase.from('users').select('name').eq('id', authUser.id).single(),
      supabase.from('users').select('name'),
      supabase
        .from('step_subscriptions')
        .select('step_id, notify_when_started, notify_when_complete, notify_when_reopened')
        .eq('user_id', authUser.id)
        .or('notify_when_started.eq.true,notify_when_complete.eq.true,notify_when_reopened.eq.true'),
      supabase
        .from('checklist_instances')
        .select('id, checklist_item_id, scheduled_date, assigned_to_user_id, completed_at, notes, completed_by_user_id, created_at, checklist_items(title)')
        .eq('assigned_to_user_id', authUser.id)
        .eq('scheduled_date', today)
        .order('created_at', { ascending: true }),
    ]).then(([userRes, allUsersRes, subsRes, checklistRes]) => {
      if (cancelled) return

      const { data: userData, error: userErr } = userRes
      if (userErr) {
        setUserError(userErr.message)
        setUserLoading(false)
        setChecklistLoading(false)
        setAssignedLoading(false)
        setSubscribedLoading(false)
        return
      }

      const user = userData as { name: string | null } | null
      setUserLoading(false)

      const userNamesSet = new Set<string>()
      const allUsers = allUsersRes.data ?? []
      allUsers.forEach((u) => {
        if (u.name) userNamesSet.add(u.name.trim().toLowerCase())
      })
      setUserNames(userNamesSet)

      if (!cancelled) {
        setTodayChecklist((checklistRes.data ?? []) as ChecklistInstance[])
        setChecklistLoading(false)
      }

      const subs = subsRes.data ?? []
      const name = user?.name ?? null

      // Phase 2: Load subscribed and assigned in parallel
      const loadSubscribed = async () => {
        if (!subs || subs.length === 0) {
          if (!cancelled) setSubscribedSteps([])
          if (!cancelled) setSubscribedLoading(false)
          return
        }
        const stepIds = subs.map((s) => s.step_id)
        const { data: steps } = await supabase
          .from('project_workflow_steps')
          .select('id, name, workflow_id')
          .in('id', stepIds)
        if (cancelled || !steps?.length) {
          if (!cancelled) setSubscribedLoading(false)
          return
        }
        const workflowIds = [...new Set(steps.map((s) => s.workflow_id))]
        const { data: workflows } = await supabase
          .from('project_workflows')
          .select('id, project_id')
          .in('id', workflowIds)
        if (cancelled || !workflows?.length) {
          if (!cancelled) setSubscribedLoading(false)
          return
        }
        const projectIds = [...new Set(workflows.map((w) => w.project_id))]
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name')
          .in('id', projectIds)
        if (cancelled || !projects?.length) {
          if (!cancelled) setSubscribedLoading(false)
          return
        }
        const workflowToProject = new Map(workflows.map((w) => [w.id, w.project_id]))
        const projectMap = new Map(projects.map((p) => [p.id, p.name]))
        const subscribed: SubscribedStep[] = []
        steps.forEach((step) => {
          const sub = subs.find((s) => s.step_id === step.id)
          const projectId = workflowToProject.get(step.workflow_id)
          const projectName = projectId ? projectMap.get(projectId) : null
          if (sub && projectId && projectName) {
            subscribed.push({
              step_id: step.id,
              step_name: step.name,
              project_id: projectId,
              project_name: projectName,
              notify_when_started: sub.notify_when_started ?? false,
              notify_when_complete: sub.notify_when_complete ?? false,
              notify_when_reopened: sub.notify_when_reopened ?? false,
            })
          }
        })
        if (!cancelled) {
          setSubscribedSteps(subscribed)
          setSubscribedLoading(false)
        }
      }

      const loadAssigned = async () => {
        if (!name) {
          if (!cancelled) setAssignedLoading(false)
          return
        }
        const { data: stepsData } = await supabase
          .from('project_workflow_steps')
          .select('*')
          .eq('assigned_to_name', name)
          .order('created_at', { ascending: false })
          .limit(100)
        const steps = (stepsData ?? []) as Step[]
        if (cancelled || steps.length === 0) {
          if (!cancelled) setAssignedLoading(false)
          return
        }
        const workflowIds = [...new Set(steps.map((s) => s.workflow_id))]
        const { data: workflows } = await supabase
          .from('project_workflows')
          .select('id, project_id')
          .in('id', workflowIds)
        if (cancelled || !workflows?.length) {
          if (!cancelled) setAssignedLoading(false)
          return
        }
        const projectIds = [...new Set(workflows.map((w) => w.project_id))]
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name, address, plans_link')
          .in('id', projectIds)
        if (cancelled || !projects?.length) {
          if (!cancelled) setAssignedLoading(false)
          return
        }
        const workflowToProject = new Map(workflows.map((w) => [w.id, w.project_id]))
        const projectMap = new Map(projects.map((p) => [p.id, { name: p.name, address: p.address, plans_link: p.plans_link }]))
        const assigned: AssignedStep[] = steps.map((step) => {
          const projectId = workflowToProject.get(step.workflow_id) ?? ''
          const project = projectId ? projectMap.get(projectId) : null
          return {
            ...step,
            project_id: projectId,
            project_name: project?.name ?? '',
            project_address: project?.address ?? null,
            project_plans_link: project?.plans_link ?? null,
            workflow_id: step.workflow_id,
          }
        })
        if (!cancelled) {
          setAssignedSteps(assigned)
          setAssignedLoading(false)
        }
      }

      void loadSubscribed()
      void loadAssigned()
    })
    return () => { cancelled = true }
  }, [authUser?.id])

  useEffect(() => {
    if (!authUser?.id) return
    setAssignedJobsLoading(true)
    supabase
      .rpc('list_assigned_jobs_for_dashboard')
      .then(({ data, error }) => {
        setAssignedJobsLoading(false)
        if (error) return
        setAssignedJobs((data ?? []) as unknown as typeof assignedJobs)
      })
  }, [authUser?.id])

  useEffect(() => {
    if (!authUser?.id || (role !== 'dev' && role !== 'master_technician' && role !== 'assistant')) return
    setReadyToBillLoading(true)
    supabase
      .from('jobs_ledger')
      .select('id, hcp_number, job_name, job_address, google_drive_link, job_plans_link, revenue, created_at')
      .eq('status', 'ready_to_bill')
      .order('hcp_number', { ascending: false })
      .then(({ data, error }) => {
        setReadyToBillLoading(false)
        if (error) return
        setReadyToBillJobs((data ?? []) as typeof readyToBillJobs)
      })
  }, [authUser?.id, role])

  useEffect(() => {
    if (!authUser?.id || (role !== 'dev' && role !== 'master_technician' && role !== 'assistant')) return
    setWaitingForPaymentLoading(true)
    supabase
      .from('jobs_ledger')
      .select('id, hcp_number, job_name, job_address, google_drive_link, job_plans_link, revenue, created_at')
      .eq('status', 'billed')
      .order('hcp_number', { ascending: false })
      .then(({ data, error }) => {
        setWaitingForPaymentLoading(false)
        if (error) return
        setWaitingForPaymentJobs((data ?? []) as typeof waitingForPaymentJobs)
      })
  }, [authUser?.id, role])

  async function updateJobStatus(jobId: string, toStatus: 'working' | 'ready_to_bill' | 'billed' | 'paid') {
    setJobStatusUpdatingId(jobId)
    const { data, error } = await supabase.rpc('update_job_status', { p_job_id: jobId, p_to_status: toStatus })
    setJobStatusUpdatingId(null)
    if (error) {
      showToast?.(error.message, 'error')
      return
    }
    const result = data as { error?: string } | null
    if (result?.error) {
      showToast?.(result.error, 'error')
      return
    }
    showToast?.('Status updated', 'success')
    setAssignedJobs((prev) => prev.filter((j) => j.id !== jobId))
    setReadyToBillJobs((prev) => prev.filter((j) => j.id !== jobId))
    setWaitingForPaymentJobs((prev) => prev.filter((j) => j.id !== jobId))
    if (role === 'dev' || role === 'master_technician' || role === 'assistant') {
      const { data: readyData } = await supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address, google_drive_link, job_plans_link, revenue, created_at').eq('status', 'ready_to_bill').order('hcp_number', { ascending: false })
      if (readyData) setReadyToBillJobs(readyData as typeof readyToBillJobs)
      const { data: billedData } = await supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address, google_drive_link, job_plans_link, revenue, created_at').eq('status', 'billed').order('hcp_number', { ascending: false })
      if (billedData) setWaitingForPaymentJobs(billedData as typeof waitingForPaymentJobs)
    }
    const { data: assignedData } = await supabase.rpc('list_assigned_jobs_for_dashboard')
    if (assignedData) setAssignedJobs(assignedData as unknown as typeof assignedJobs)
  }

  useEffect(() => {
    if (!sendBackJob) {
      setSendBackSentBy(null)
      return
    }
    const toStatusForEvent = sendBackJob.toStatus === 'working' ? 'ready_to_bill' : 'billed'
    supabase
      .from('job_status_events')
      .select('users(name)')
      .eq('job_id', sendBackJob.id)
      .eq('to_status', toStatusForEvent)
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { users: { name: string } | null } | null
        setSendBackSentBy(row?.users?.name ?? null)
      })
  }, [sendBackJob])

  useEffect(() => {
    if (!completedItemsOpen || !authUser?.id || !isDev) return
    setCompletedItemsLoading(true)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    Promise.all([
      supabase
        .from('checklist_instances')
        .select('id, checklist_item_id, scheduled_date, assigned_to_user_id, completed_at, completed_by_user_id, checklist_items(title)')
        .not('completed_at', 'is', null)
        .gte('completed_at', sevenDaysAgo)
        .order('completed_at', { ascending: false }),
      supabase
        .from('dev_read_completed_items')
        .select('checklist_instance_id')
        .eq('dev_user_id', authUser.id),
    ]).then(async ([instRes, readRes]) => {
      if (instRes.error) {
        setCompletedItemsLoading(false)
        return
      }
      const instances = (instRes.data ?? []) as ChecklistInstance[]
      const userIds = new Set<string>()
      instances.forEach((i) => {
        if (i.assigned_to_user_id) userIds.add(i.assigned_to_user_id)
        if (i.completed_by_user_id) userIds.add(i.completed_by_user_id)
      })
      let userMap = new Map<string, string>()
      if (userIds.size > 0) {
        const { data: usersData } = await supabase.from('users').select('id, name, email').in('id', Array.from(userIds))
        ;(usersData ?? []).forEach((u: { id: string; name: string | null; email: string | null }) => {
          userMap.set(u.id, u.name || u.email || 'Unknown')
        })
      }
      setCompletedItems(instances)
      setCompletedItemsUserMap(userMap)
      const readSet = new Set<string>()
      ;(readRes.data ?? []).forEach((r: { checklist_instance_id: string }) => readSet.add(r.checklist_instance_id))
      setReadInstanceIds(readSet)
      if (instances.length > 0) {
        const completerIds = new Set(instances.map((i) => i.completed_by_user_id).filter(Boolean) as string[])
        setExpandedCompleterIds((prev) => (prev.size === 0 ? completerIds : prev))
      }
      setCompletedItemsLoading(false)
    })
  }, [completedItemsOpen, authUser?.id, isDev])

  async function markCompletedItemAsRead(inst: ChecklistInstance) {
    if (!authUser?.id || markingReadId) return
    setMarkingReadId(inst.id)
    await supabase.from('dev_read_completed_items').insert({
      dev_user_id: authUser.id,
      checklist_instance_id: inst.id,
    })
    setMarkingReadId(null)
    setReadInstanceIds((prev) => new Set(prev).add(inst.id))
  }

  async function loadAssignedSteps() {
    if (!authUser?.id) return
    const { data: userData } = await supabase
      .from('users')
      .select('name')
      .eq('id', authUser.id)
      .single()
    const name = (userData as { name: string | null } | null)?.name ?? null
    
    if (name) {
      const { data: stepsData } = await supabase
        .from('project_workflow_steps')
        .select('*')
        .eq('assigned_to_name', name)
        .order('created_at', { ascending: false })
        .limit(100)
      const steps = (stepsData ?? []) as Step[]
      if (steps.length > 0) {
        const workflowIds = [...new Set(steps.map((s) => s.workflow_id))]
        const { data: workflows } = await supabase
          .from('project_workflows')
          .select('id, project_id')
          .in('id', workflowIds)
        
        if (workflows) {
          const projectIds = [...new Set(workflows.map((w) => w.project_id))]
          const { data: projects } = await supabase
            .from('projects')
            .select('id, name, address, plans_link')
            .in('id', projectIds)
          
          if (projects) {
            const workflowToProject = new Map<string, string>()
            workflows.forEach((w) => workflowToProject.set(w.id, w.project_id))
            const projectMap = new Map<string, { name: string; address: string | null; plans_link: string | null }>()
            projects.forEach((p) => projectMap.set(p.id, { name: p.name, address: p.address, plans_link: p.plans_link }))
            
            const assigned: AssignedStep[] = steps.map((step) => {
              const projectId = workflowToProject.get(step.workflow_id) ?? ''
              const project = projectId ? (projectMap.get(projectId) ?? null) : null
              return {
                ...step,
                project_id: projectId,
                project_name: project?.name ?? '',
                project_address: project?.address ?? null,
                project_plans_link: project?.plans_link ?? null,
                workflow_id: step.workflow_id,
              }
            })
            setAssignedSteps(assigned)
          }
        }
      } else {
        setAssignedSteps([])
      }
    }
  }

  async function loadTodayChecklist() {
    if (!authUser?.id) return
    const today = toLocalDateString(new Date())
    const { data: todayData } = await supabase
      .from('checklist_instances')
      .select('id, checklist_item_id, scheduled_date, assigned_to_user_id, completed_at, notes, completed_by_user_id, created_at, checklist_items(title)')
      .eq('assigned_to_user_id', authUser.id)
      .eq('scheduled_date', today)
      .order('created_at', { ascending: true })
    const { data: itemsData } = await supabase
      .from('checklist_items')
      .select('id')
      .eq('show_until_completed', true)
    const itemIds = (itemsData ?? []).map((i) => i.id)
    let overdueData: ChecklistInstance[] = []
    if (itemIds.length > 0) {
      const { data } = await supabase
        .from('checklist_instances')
        .select('id, checklist_item_id, scheduled_date, assigned_to_user_id, completed_at, notes, completed_by_user_id, created_at, checklist_items(title)')
        .eq('assigned_to_user_id', authUser.id)
        .is('completed_at', null)
        .lt('scheduled_date', today)
        .in('checklist_item_id', itemIds)
        .order('scheduled_date', { ascending: true })
      overdueData = (data ?? []) as ChecklistInstance[]
    }
    const merged = [...overdueData, ...(todayData ?? [])]
    merged.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    setTodayChecklist(merged as ChecklistInstance[])
  }

  async function toggleChecklistComplete(inst: ChecklistInstance) {
    if (!authUser?.id || completingChecklistId) return
    setCompletingChecklistId(inst.id)
    const isCompleted = !!inst.completed_at
    const { error: e } = await supabase
      .from('checklist_instances')
      .update({
        completed_at: isCompleted ? null : new Date().toISOString(),
        completed_by_user_id: isCompleted ? null : authUser.id,
      })
      .eq('id', inst.id)
    setCompletingChecklistId(null)
    if (e) return
    await loadTodayChecklist()
    if (!isCompleted) {
      await sendChecklistCompletionNotifications(inst)
      await maybeCreateNextChecklistInstance(inst)
    }
  }

  function openFwd(inst: ChecklistInstance) {
    const title = (inst.checklist_items as { title: string } | null)?.title ?? 'Untitled'
    setFwdInstance(inst)
    setFwdTitle(title)
    setFwdAssigneeId(inst.assigned_to_user_id)
  }

  async function saveFwd() {
    if (!fwdInstance || !authUser?.id || !fwdTitle.trim() || !fwdAssigneeId) return
    setFwdSaving(true)
    setUserError(null)
    try {
      const { data: sourceItem } = await supabase
        .from('checklist_items')
        .select('notify_on_complete_user_id, notify_creator_on_complete, reminder_time, reminder_scope, show_until_completed')
        .eq('id', fwdInstance.checklist_item_id)
        .single()
      const src = sourceItem as { notify_on_complete_user_id: string | null; notify_creator_on_complete: boolean; reminder_time: string | null; reminder_scope: string | null; show_until_completed?: boolean } | null
      const { data: newItem, error: itemErr } = await supabase
        .from('checklist_items')
        .insert({
          title: fwdTitle.trim(),
          assigned_to_user_id: fwdAssigneeId,
          created_by_user_id: authUser.id,
          repeat_type: 'once',
          start_date: fwdInstance.scheduled_date,
          show_until_completed: src?.show_until_completed ?? true,
          notify_on_complete_user_id: src?.notify_on_complete_user_id ?? null,
          notify_creator_on_complete: src?.notify_creator_on_complete ?? false,
          reminder_time: src?.reminder_time ?? null,
          reminder_scope: src?.reminder_scope ?? null,
        })
        .select('id')
        .single()
      if (itemErr) throw itemErr
      if (newItem?.id) {
        await supabase.from('checklist_instances').insert({
          checklist_item_id: newItem.id,
          scheduled_date: fwdInstance.scheduled_date,
          assigned_to_user_id: fwdAssigneeId,
        })
        await supabase.from('checklist_instances').delete().eq('id', fwdInstance.id)
      }
      setFwdInstance(null)
      await loadTodayChecklist()
    } catch (err: unknown) {
      setUserError(err instanceof Error ? err.message : 'Failed to forward')
    } finally {
      setFwdSaving(false)
    }
  }

  async function sendChecklistCompletionNotifications(inst: ChecklistInstance) {
    const { data: item } = await supabase
      .from('checklist_items')
      .select('notify_on_complete_user_id, notify_creator_on_complete, created_by_user_id, title')
      .eq('id', inst.checklist_item_id)
      .single()
    if (!item) return
    const title = (item as { title: string }).title
    const assigneeName = await getCurrentUserName()
    const body = `${assigneeName} completed: ${title}`
    const recipients: string[] = []
    const notifyUserId = (item as { notify_on_complete_user_id: string | null }).notify_on_complete_user_id
    if (notifyUserId) recipients.push(notifyUserId)
    const notifyCreator = (item as { notify_creator_on_complete: boolean }).notify_creator_on_complete
    const creatorId = (item as { created_by_user_id: string }).created_by_user_id
    if (notifyCreator && creatorId && !recipients.includes(creatorId)) recipients.push(creatorId)
    for (const uid of recipients) {
      try {
        await supabase.functions.invoke('send-checklist-notification', {
          body: {
            recipient_user_id: uid,
            push_title: 'Checklist completed',
            push_body: body,
            push_url: '/checklist',
            tag: `checklist-${inst.id}`,
          },
        })
      } catch {
        // ignore
      }
    }
  }

  async function maybeCreateNextChecklistInstance(inst: ChecklistInstance) {
    const { data: item } = await supabase
      .from('checklist_items')
      .select('repeat_type, repeat_days_after, repeat_end_date')
      .eq('id', inst.checklist_item_id)
      .single()
    if (!item) return
    const rt = (item as { repeat_type: string }).repeat_type
    if (rt !== 'days_after_completion') return
    const daysAfter = (item as { repeat_days_after: number | null }).repeat_days_after
    if (!daysAfter) return
    const endDate = (item as { repeat_end_date: string | null }).repeat_end_date
    const nextDate = new Date(inst.scheduled_date)
    nextDate.setDate(nextDate.getDate() + daysAfter)
    const nextDateStr = toLocalDateString(nextDate)
    if (endDate && nextDateStr > endDate) return
    const existing = await supabase
      .from('checklist_instances')
      .select('id')
      .eq('checklist_item_id', inst.checklist_item_id)
      .eq('scheduled_date', nextDateStr)
      .single()
    if (existing.data) return
    await supabase.from('checklist_instances').insert({
      checklist_item_id: inst.checklist_item_id,
      scheduled_date: nextDateStr,
      assigned_to_user_id: inst.assigned_to_user_id,
    })
  }

  async function getCurrentUserName(): Promise<string> {
    if (!authUser?.id) return 'Unknown'
    const { data: userData } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', authUser.id)
      .single()
    return (userData as { name: string | null; email: string | null } | null)?.name || (userData as { email: string | null } | null)?.email || 'Unknown'
  }

  async function recordAction(stepId: string, actionType: 'started' | 'completed' | 'approved' | 'rejected' | 'reopened', notes?: string | null) {
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
          workflow_id: step.workflow_id,
        } as AssignedStep
      }
    }
    
    return null
  }

  async function markStarted(step: AssignedStep, startDateTime?: string) {
    const startedAt = startDateTime ? fromDatetimeLocal(startDateTime) : new Date().toISOString()
    await supabase.from('project_workflow_steps').update({ started_at: startedAt, status: 'in_progress' }).eq('id', step.id)
    await recordAction(step.id, 'started')
    await loadAssignedSteps()
  }

  async function submitSetStart() {
    if (!setStartStep) return
    await markStarted(setStartStep.step, setStartStep.startDateTime)
    setSetStartStep(null)
  }

  async function markCompleted(step: AssignedStep) {
    await supabase.from('project_workflow_steps').update({
      status: 'completed',
      ended_at: new Date().toISOString(),
    }).eq('id', step.id)
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

  const showChecklist = checklistLoading || todayChecklist.length > 0
  const showAssigned = assignedLoading || assignedSteps.length > 0
  const showSubscribed = role === 'dev' || role === 'master_technician' || role === 'assistant'
  const showRecent = (role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'primary') || ((role === 'subcontractor' || role === 'estimator') && isReportEnabledOnlyUser)

  return (
    <div>
      {pinsToShow.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            {pinsToShow.map((item) => {
              const isCostMatrix = item.path === '/people' && item.tab === 'pay'
              const isSupplyHouseAP = item.path === '/materials' && item.tab === 'supply-houses'
              const isAR = item.path === '/jobs' && item.tab === 'receivables'
              const isExternalTeam = item.path === '/materials' && item.tab === 'external-team'
              const to = item.tab
                ? `${item.path}?tab=${encodeURIComponent(item.tab)}${isCostMatrix ? '#cost-matrix' : ''}`
                : item.path
              const displayLabel = isCostMatrix
                ? (costMatrixTotal != null ? `Internal Team: $${Math.round(costMatrixTotal).toLocaleString('en-US')}` : item.label)
                : isAR
                  ? (arTotal != null ? `AR: $${Math.round(arTotal).toLocaleString('en-US')}` : item.label)
                  : isSupplyHouseAP
                    ? (supplyHousesAPTotal != null ? `Supply Houses: $${Math.round(supplyHousesAPTotal).toLocaleString('en-US')}` : item.label)
                    : isExternalTeam
                      ? (externalTeamTotal != null ? `External Team: $${Math.round(externalTeamTotal).toLocaleString('en-US')}` : item.label)
                      : (item.tab ? `${item.label} · ${item.tab.replace(/-/g, ' ').replace(/_/g, ' ')}` : item.label)
              return (
                <Link
                  key={item.path + (item.tab ?? '')}
                  to={to}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.875rem',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  {displayLabel}
                </Link>
              )
            })}
          </div>
        </div>
      )}
      {(role === 'dev' || role === 'master_technician' || role === 'assistant') && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {[
            { key: 'job', label: 'Job', to: '/jobs?tab=ledger&newJob=true' },
            { key: 'job_labor', label: 'Job Labor', to: '/jobs?tab=sub_sheet_ledger&newJob=true' },
            { key: 'bid', label: 'Bid', to: '/bids?new=true' },
            { key: 'project', label: 'Project', to: '/projects/new' },
            { key: 'part', label: 'Part', to: '/materials?tab=price-book&addPart=true' },
            { key: 'assembly', label: 'Assembly', to: '/materials?tab=assembly-book&addAssembly=true' },
            { key: 'prospect', label: 'New Prospect', to: '/prospects?newProspect=true' },
          ]
            .filter((b) => dashboardButtonVisibility?.[b.key] !== false)
            .map((b) => (
              <Link
                key={b.key}
                to={b.to}
                style={{
                  padding: '0.75rem 1.25rem',
                  background: '#3b82f6',
                  color: 'white',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '1rem',
                }}
              >
                {b.label}
              </Link>
            ))}
        </div>
      )}
      {role != null && (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '0.5rem', marginBottom: '1rem' }}>
          <Link
            to="/tally"
            title="Job Parts Tally"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              flexShrink: 0,
              background: '#3b82f6',
              color: 'white',
              borderRadius: 8,
              textDecoration: 'none',
              boxSizing: 'border-box',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={28} height={28} fill="currentColor" style={{ display: 'block' }}>
              <path d="M541.4 162.6C549 155 561.7 156.9 565.5 166.9C572.3 184.6 576 203.9 576 224C576 312.4 504.4 384 416 384C398.5 384 381.6 381.2 365.8 376L178.9 562.9C150.8 591 105.2 591 77.1 562.9C49 534.8 49 489.2 77.1 461.1L264 274.2C258.8 258.4 256 241.6 256 224C256 135.6 327.6 64 416 64C436.1 64 455.4 67.7 473.1 74.5C483.1 78.3 484.9 91 477.4 98.6L388.7 187.3C385.7 190.3 384 194.4 384 198.6L384 240C384 248.8 391.2 256 400 256L441.4 256C445.6 256 449.7 254.3 452.7 251.3L541.4 162.6z" />
            </svg>
          </Link>
          <button
            type="button"
            onClick={() => setNewReportModalOpen(true)}
            style={{
              flex: 1,
              padding: '0 1.5rem',
              background: '#3b82f6',
              color: 'white',
              borderRadius: 8,
              border: 'none',
              fontWeight: 600,
              fontSize: '1.125rem',
              textAlign: 'center',
              minHeight: 48,
              height: 48,
              boxSizing: 'border-box',
              cursor: 'pointer',
            }}
          >
            Job Report
          </button>
        </div>
      )}
      {role === 'master_technician' && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <Link
            to="/bids?tab=builder-review"
            style={{
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: 'white',
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Builder Review
          </Link>
      </div>
      )}
      {showMyReports && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', margin: 0 }}>My Reports</h2>
            {!myReportsLoading && myReports.length > 1 && (
              <button
                type="button"
                onClick={() => setMyReportsModalOpen(true)}
                style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.875rem', color: '#2563eb', cursor: 'pointer' }}
              >
                Show more →
              </button>
            )}
          </div>
          {myReportsLoading ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading reports…</p>
          ) : myReports.length > 0 ? (
            (() => {
              const r = myReports[0]!
              const editWindowMs = reportEditWindowDays * 24 * 60 * 60 * 1000
              const isWithinEditWindow = new Date(r.created_at).getTime() >= Date.now() - editWindowMs
              return (
                <div
                  style={{
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <div
                    style={{ flex: 1, minWidth: 0 }}
                    onClick={() => {
                      setSelectedReport({ id: r.id, template_name: r.template_name, job_display_name: r.job_display_name, created_at: r.created_at, created_by_name: r.created_by_name, field_values: r.field_values })
                      setViewReportModalOpen(true)
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{r.job_display_name || 'Unknown job'}</span>
                    <span style={{ color: '#6b7280', fontSize: '0.875rem', marginLeft: '0.5rem' }}>· {r.template_name}</span>
                    <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                  {isWithinEditWindow && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setReportForEdit({ id: r.id, template_id: r.template_id, template_name: r.template_name, job_display_name: r.job_display_name, created_at: r.created_at, field_values: r.field_values })
                        setEditReportModalOpen(true)
                      }}
                      style={{ flexShrink: 0, padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                  )}
                </div>
              )
            })()
          ) : (
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No reports yet. Create one with the Job Report button above.</p>
          )}
        </div>
      )}
      {showRecent && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => setRecentReportsExpanded((prev) => !prev)}
            aria-expanded={recentReportsExpanded}
            style={{ margin: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '0.5rem', marginBottom: recentReportsExpanded ? '0.5rem' : 0 }}
          >
            <h2 style={{ fontSize: '1.125rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span aria-hidden>{recentReportsExpanded ? '\u25BC' : '\u25B6'}</span>
              Recent Reports
            </h2>
            {!isReportEnabledOnlyUser && !recentReportsExpanded && (
              <Link to="/jobs?tab=reports" onClick={(e) => e.stopPropagation()} style={{ fontSize: '0.875rem', color: '#2563eb', textDecoration: 'none' }}>View all →</Link>
            )}
          </button>
          {recentReportsExpanded && (
            <>
              {!isReportEnabledOnlyUser && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                  <Link to="/jobs?tab=reports" style={{ fontSize: '0.875rem', color: '#2563eb', textDecoration: 'none' }}>View all →</Link>
                </div>
              )}
              {recentReportsLoading ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading reports…</p>
              ) : recentReports.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {recentReports.filter((r) => !hiddenReportIds.has(r.id)).map((r) => {
                const isRead = readReportIds.has(r.id)
                    return (
                      <li
                    key={r.id}
                        style={{
                          padding: '0.5rem 0.75rem',
                          marginBottom: '0.5rem',
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          background: isRead ? '#f9fafb' : '#fff',
                          opacity: isRead ? 0.85 : 1,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.5rem',
                        }}
                        onClick={() => {
                          setSelectedReport(r)
                          setViewReportModalOpen(true)
                        }}
                      >
                        {!isRead && (
                          <span style={{ flexShrink: 0, width: 20, height: 20, color: '#6b7280', marginTop: 2 }} aria-hidden>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" style={{ width: '100%', height: '100%' }}>
                              <path d="M125.4 128C91.5 128 64 155.5 64 189.4C64 190.3 64 191.1 64.1 192L64 192L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 192L575.9 192C575.9 191.1 576 190.3 576 189.4C576 155.5 548.5 128 514.6 128L125.4 128zM528 256.3L528 448C528 456.8 520.8 464 512 464L128 464C119.2 464 112 456.8 112 448L112 256.3L266.8 373.7C298.2 397.6 341.7 397.6 373.2 373.7L528 256.3zM112 189.4C112 182 118 176 125.4 176L514.6 176C522 176 528 182 528 189.4C528 193.6 526 197.6 522.7 200.1L344.2 335.5C329.9 346.3 310.1 346.3 295.8 335.5L117.3 200.1C114 197.6 112 193.6 112 189.4z" />
                            </svg>
                          </span>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 500 }}>{r.job_display_name || 'Unknown job'}</span>
                          <span style={{ color: '#6b7280', fontSize: '0.875rem', marginLeft: '0.5rem' }}>· {r.template_name}</span>
                          <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            {new Date(r.created_at).toLocaleString()} · {r.created_by_name}
                          </div>
                        </div>
                        {isRead && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setHiddenReportIds((prev) => new Set(prev).add(r.id))
                            }}
                            title="Hide from dashboard"
                            aria-label="Hide from dashboard"
                            style={{ flexShrink: 0, width: 24, height: 24, padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor" style={{ width: 14, height: 14 }}>
                              <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z" />
                            </svg>
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  No reports yet.{' '}
                  {isReportEnabledOnlyUser ? (
                    'Create one above.'
                  ) : (
                    <Link to="/jobs?tab=reports" style={{ color: '#2563eb' }}>Create one</Link>
                  )}
                </p>
              )}
            </>
          )}
        </div>
      )}
      {userError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{userError}</p>}
      {(userLoading || showChecklist) && (
        <div style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>
            Checklist items due today
            <Link to="/checklist" style={{ marginLeft: '0.5rem', fontSize: '0.875rem', fontWeight: 400, color: '#2563eb' }}>
              View all →
            </Link>
          </h2>
          {checklistLoading && todayChecklist.length === 0 ? (
            <ChecklistSkeleton />
          ) : todayChecklist.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {todayChecklist.map((inst) => {
              const title = (inst.checklist_items as { title: string } | null)?.title ?? 'Untitled'
              const isCompleted = !!inst.completed_at
              return (
                <li
                  key={inst.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    marginBottom: '0.5rem',
                    background: isCompleted ? '#f0fdf4' : '#fff',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    onChange={() => toggleChecklistComplete(inst)}
                    disabled={!!completingChecklistId}
                  />
                  <span style={{ flex: 1, fontWeight: 500, textDecoration: isCompleted ? 'line-through' : 'none', color: isCompleted ? '#6b7280' : 'inherit' }}>
                    {title}
                  </span>
                  {inst.completed_at && (
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {new Date(inst.completed_at).toLocaleString()}
                    </span>
                  )}
                  {isDev && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); openFwd(inst) }}
                      style={{
                        marginLeft: 'auto',
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        color: '#9ca3af',
                        textDecoration: 'underline',
                      }}
                    >
                      fwd
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          ) : null}
        </div>
      )}
      {fwdInstance && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
          onClick={(e) => e.target === e.currentTarget && setFwdInstance(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 8,
              padding: '1.5rem',
              minWidth: 320,
              maxWidth: 400,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Forward task</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Title</label>
                <input
                  type="text"
                  value={fwdTitle}
                  onChange={(e) => setFwdTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Assign to</label>
                <select
                  value={fwdAssigneeId}
                  onChange={(e) => setFwdAssigneeId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                >
                  {sendTaskUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email || u.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={saveFwd}
                disabled={fwdSaving || !fwdTitle.trim() || !fwdAssigneeId}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: fwdSaving ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {fwdSaving ? 'Saving…' : 'Forward'}
              </button>
              <button
                type="button"
                onClick={() => setFwdInstance(null)}
                style={{ padding: '0.5rem 1rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {isDev && (
        <div style={{ marginTop: '2rem' }}>
          <h2
            style={{
              fontSize: '1.125rem',
              marginBottom: completedItemsOpen ? '0.75rem' : 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
            onClick={() => setCompletedItemsOpen((o) => !o)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setCompletedItemsOpen((o) => !o)}
          >
            {completedItemsOpen ? '▼' : '▶'} Recently Completed Tasks (last 7 days)
            {(() => {
              const n = completedItems.filter((inst) => !readInstanceIds.has(inst.id)).length
              return n > 0 ? <span style={{ fontWeight: 600, color: '#2563eb' }}>{' - '}{n} UNREAD</span> : null
            })()}
          </h2>
          {completedItemsOpen && (
            <>
              {completedItemsLoading ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Loading…</p>
              ) : completedItems.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No completed items in the last 7 days.</p>
              ) : (
                (() => {
                  const byCompleter = new Map<string, ChecklistInstance[]>()
                  completedItems.forEach((inst) => {
                    const cid = inst.completed_by_user_id ?? 'unknown'
                    if (!byCompleter.has(cid)) byCompleter.set(cid, [])
                    byCompleter.get(cid)!.push(inst)
                  })
                  const getUserName = (id: string | null) => {
                    if (!id) return 'Unknown'
                    return completedItemsUserMap.get(id) ?? id.slice(0, 8) + '…'
                  }
                  return (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {Array.from(byCompleter.entries()).map(([completerId, items]) => {
                        const isExpanded = expandedCompleterIds.has(completerId)
                        const completerName = getUserName(completerId === 'unknown' ? null : completerId)
                        const unreadCount = items.filter((inst) => !readInstanceIds.has(inst.id)).length
                        return (
                          <li key={completerId} style={{ marginBottom: '0.5rem' }}>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => setExpandedCompleterIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(completerId)) next.delete(completerId)
                                else next.add(completerId)
                                return next
                              })}
                              onKeyDown={(e) => e.key === 'Enter' && setExpandedCompleterIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(completerId)) next.delete(completerId)
                                else next.add(completerId)
                                return next
                              })}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 0.75rem',
                                border: '1px solid #e5e7eb',
                                borderRadius: 8,
                                cursor: 'pointer',
                                background: '#f9fafb',
                              }}
                            >
                              <span style={{ fontSize: '0.875rem', minWidth: 16 }}>{isExpanded ? '▼' : '▶'}</span>
                              <span style={{ fontWeight: 500 }}>{completerName}</span>
                              <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>({items.length} item{items.length !== 1 ? 's' : ''}{unreadCount > 0 ? ` · ${unreadCount} unread` : ''})</span>
                            </div>
                            {isExpanded && (
                              <ul style={{ listStyle: 'none', padding: '0.5rem 0 0 1.5rem', margin: 0 }}>
                                {items.map((inst) => {
                                  const title = (inst.checklist_items as { title: string } | null)?.title ?? 'Untitled'
                                  const isRead = readInstanceIds.has(inst.id)
                                  const assigneeName = getUserName(inst.assigned_to_user_id)
                                  return (
                                    <li
                                      key={inst.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.5rem 0.75rem',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: 8,
                                        marginTop: '0.5rem',
                                        background: isRead ? '#fff' : '#f0f9ff',
                                      }}
                                    >
                                      <span style={{ flex: 1, fontWeight: 500 }}>{title}</span>
                                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                        {inst.completed_at && new Date(inst.completed_at).toLocaleString()}
                                      </span>
                                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>→ {assigneeName}</span>
                                      {!isRead && (
                                        <button
                                          type="button"
                                          onClick={() => markCompletedItemAsRead(inst)}
                                          disabled={!!markingReadId}
                                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', cursor: markingReadId ? 'not-allowed' : 'pointer' }}
                                        >
                                          Mark as read
                                        </button>
                                      )}
                                      {isRead && <span style={{ fontSize: '0.75rem', color: '#059669' }}>Read</span>}
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); openFwd(inst) }}
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', cursor: 'pointer', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4 }}
                                      >
                                        Re-send
                                      </button>
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )
                })()
              )}
            </>
          )}
        </div>
      )}

      {(assignedJobsLoading || assignedJobs.length > 0) && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>Assigned Jobs</h2>
          {assignedJobsLoading && assignedJobs.length === 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[1, 2].map((i) => (
                <li key={i} style={{ padding: '0.75rem 0', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ ...skeletonStyle, height: 16, width: '50%', marginBottom: 4 }} />
                  <div style={{ ...skeletonStyle, height: 14, width: '35%' }} />
                </li>
              ))}
            </ul>
          ) : (
            <div>
              {assignedJobs.map((j) => (
                <div
                  key={j.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '1rem',
                    marginBottom: '0.75rem',
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {j.hcp_number || '—'} · {j.job_name || '—'}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 4 }}>
                        {j.job_address?.trim() ? (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.job_address.trim())}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>{j.job_address}</a>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {(j.google_drive_link?.trim() || j.job_plans_link?.trim()) && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                          {j.google_drive_link?.trim() && (
                            <a
                              href={j.google_drive_link.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.google_drive_link!.trim()) }}
                              title="Google Drive"
                              style={{ display: 'inline-flex', alignItems: 'center', color: '#6b7280', padding: '0.35rem' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
                                <path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" />
                              </svg>
                            </a>
                          )}
                      {j.job_plans_link?.trim() && (
                        <a
                          href={j.job_plans_link.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.job_plans_link!.trim()) }}
                          title="Job Plans"
                          style={{ display: 'inline-flex', alignItems: 'center', color: '#6b7280', padding: '0.35rem' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
                            <path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" />
                          </svg>
                        </a>
                          )}
                        </div>
                      )}
                      {(role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'primary') && (
                        <>
                          <Link to={`/jobs?tab=ledger`} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', color: '#2563eb', textDecoration: 'none' }}>
                            View
                          </Link>
                          <button
                            type="button"
                            onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: '#2563eb', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                          >
                            View<br />Reports
                          </button>
                        </>
                      )}
                      {role === 'subcontractor' && (
                        <button
                          type="button"
                          onClick={() => setLeaveReportJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Leave<br />Report
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setReadyForBillingJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—' })
                          setReadyForBillingChecked1(false)
                          setReadyForBillingChecked2(false)
                        }}
                        disabled={jobStatusUpdatingId === j.id}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.875rem',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {jobStatusUpdatingId === j.id ? '…' : <>Send to<br />Billing</>}
                      </button>
                      {j.created_at && (
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }} title="Time since job created">
                          Open<br />{formatTimeSince(j.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(role === 'dev' || role === 'master_technician' || role === 'assistant') && (readyToBillLoading || readyToBillJobs.length > 0) && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>Ready to Bill</h2>
          {readyToBillLoading && readyToBillJobs.length === 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[1, 2].map((i) => (
                <li key={i} style={{ padding: '0.75rem 0', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ ...skeletonStyle, height: 16, width: '50%', marginBottom: 4 }} />
                  <div style={{ ...skeletonStyle, height: 14, width: '35%' }} />
                </li>
              ))}
            </ul>
          ) : (
            <div>
              {readyToBillJobs.map((j) => (
                <div
                  key={j.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '1rem',
                    marginBottom: '0.75rem',
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {j.hcp_number || '—'} · {j.job_name || '—'}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 4 }}>
                        {j.job_address?.trim() ? (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.job_address.trim())}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>{j.job_address}</a>
                        ) : (
                          '—'
                        )}
                      </div>
                      {j.revenue != null && (
                        <div style={{ fontSize: '0.875rem', marginTop: 4 }}>Revenue: ${Number(j.revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {(j.google_drive_link?.trim() || j.job_plans_link?.trim()) && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                          {j.google_drive_link?.trim() && (
                            <a
                              href={j.google_drive_link.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.google_drive_link!.trim()) }}
                              title="Google Drive"
                              style={{ display: 'inline-flex', alignItems: 'center', color: '#6b7280', padding: '0.35rem' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
                                <path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" />
                              </svg>
                            </a>
                          )}
                      {j.job_plans_link?.trim() && (
                        <a
                          href={j.job_plans_link.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.job_plans_link!.trim()) }}
                          title="Job Plans"
                          style={{ display: 'inline-flex', alignItems: 'center', color: '#6b7280', padding: '0.35rem' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
                            <path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" />
                          </svg>
                        </a>
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setViewBillDetailsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—', revenue: j.revenue })}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: '#2563eb', border: 'none', cursor: 'pointer', textDecoration: 'none' }}
                      >
                        View<br />Details
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: '#2563eb', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                      >
                        View<br />Reports
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSendBackJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', toStatus: 'working' })
                          setSendBackChecked(false)
                        }}
                        disabled={jobStatusUpdatingId === j.id}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.875rem',
                          background: 'none',
                          color: '#6b7280',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Send<br />back
                      </button>
                      <button
                        type="button"
                        onClick={() => updateJobStatus(j.id, 'billed')}
                        disabled={jobStatusUpdatingId === j.id}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.875rem',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {jobStatusUpdatingId === j.id ? '…' : <>Mark as<br />Billed</>}
                      </button>
                      {j.created_at && (
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }} title="Time since job created">
                          Open<br />{formatTimeSince(j.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(role === 'dev' || role === 'master_technician' || role === 'assistant') && (waitingForPaymentLoading || waitingForPaymentJobs.length > 0) && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>Waiting for Payment</h2>
          {waitingForPaymentLoading && waitingForPaymentJobs.length === 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[1, 2].map((i) => (
                <li key={i} style={{ padding: '0.75rem 0', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ ...skeletonStyle, height: 16, width: '50%', marginBottom: 4 }} />
                  <div style={{ ...skeletonStyle, height: 14, width: '35%' }} />
                </li>
              ))}
            </ul>
          ) : (
            <div>
              {waitingForPaymentJobs.map((j) => (
                <div
                  key={j.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '1rem',
                    marginBottom: '0.75rem',
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {j.hcp_number || '—'} · {j.job_name || '—'}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 4 }}>
                        {j.job_address?.trim() ? (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.job_address.trim())}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>{j.job_address}</a>
                        ) : (
                          '—'
                        )}
                      </div>
                      {j.revenue != null && (
                        <div style={{ fontSize: '0.875rem', marginTop: 4 }}>Revenue: ${Number(j.revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {(j.google_drive_link?.trim() || j.job_plans_link?.trim()) && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                          {j.google_drive_link?.trim() && (
                            <a
                              href={j.google_drive_link.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.google_drive_link!.trim()) }}
                              title="Google Drive"
                              style={{ display: 'inline-flex', alignItems: 'center', color: '#6b7280', padding: '0.35rem' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
                                <path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" />
                              </svg>
                            </a>
                          )}
                      {j.job_plans_link?.trim() && (
                        <a
                          href={j.job_plans_link.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.job_plans_link!.trim()) }}
                          title="Job Plans"
                          style={{ display: 'inline-flex', alignItems: 'center', color: '#6b7280', padding: '0.35rem' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
                            <path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" />
                          </svg>
                        </a>
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setViewBillDetailsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—', revenue: j.revenue })}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: '#2563eb', border: 'none', cursor: 'pointer', textDecoration: 'none' }}
                      >
                        View<br />Details
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: '#2563eb', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                      >
                        View<br />Reports
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSendBackJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', toStatus: 'ready_to_bill' })
                          setSendBackChecked(false)
                        }}
                        disabled={jobStatusUpdatingId === j.id}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.875rem',
                          background: 'none',
                          color: '#6b7280',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Send<br />back
                      </button>
                      <button
                        type="button"
                        onClick={() => updateJobStatus(j.id, 'paid')}
                        disabled={jobStatusUpdatingId === j.id}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.875rem',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {jobStatusUpdatingId === j.id ? '…' : <>Mark<br />Paid</>}
                      </button>
                      {j.created_at && (
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }} title="Time since job created">
                          Open<br />{formatTimeSince(j.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(userLoading || showAssigned) && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>Projects: Assigned Stages</h2>
          {assignedLoading && assignedSteps.length === 0 ? (
            <AssignedSkeleton />
          ) : (
          <div>
            {assignedSteps.map((s) => (
              <div
                key={s.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: '1rem',
                  marginBottom: '0.75rem',
                  background: s.status === 'rejected' ? '#fef2f2' : s.status === 'approved' || s.status === 'completed' ? '#f0fdf4' : '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: 4 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.name} - {personDisplay(s.assigned_to_name, userNames)}</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 4 }}>
                      Project: <Link to={`/workflows/${s.project_id}#step-${s.id}`} style={{ color: '#2563eb' }}>{s.project_name}</Link>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.875rem', marginBottom: 8 }}>Status: {s.status}</div>
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
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 8 }}>
                  Start: {formatDatetime(s.started_at)}{" \u00B7 "}End: {formatDatetime(s.ended_at)}
                </div>
                {s.project_address && (
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 8 }}>
                    Address: <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.project_address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#2563eb', textDecoration: 'underline' }}
                    >
                      {s.project_address}
                    </a>
                  </div>
                )}
                {s.project_plans_link && (
                  <div style={{ fontSize: '0.875rem', marginBottom: 8 }}>
                    Plans: <a href={s.project_plans_link} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>View Plans</a>
                  </div>
                )}
                {s.notes && (
                  <div style={{ marginTop: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Notes:</div>
                    <div style={{ fontSize: '0.875rem', color: '#374151', whiteSpace: 'pre-wrap', padding: '0.5rem', background: '#f9fafb', borderRadius: 4, border: '1px solid #e5e7eb' }}>
                      {s.notes}
                    </div>
                  </div>
                )}
                {s.rejection_reason && <div style={{ marginTop: 8, fontSize: '0.875rem', color: '#b91c1c' }}>Rejection: {s.rejection_reason}</div>}
                
                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                  {s.status === 'pending' && (
                    <button 
                      type="button" 
                      onClick={() => setSetStartStep({ step: s, startDateTime: toDatetimeLocal(new Date().toISOString()) })} 
                      style={{ padding: '4px 8px', fontSize: '0.875rem' }}
                    >
                      Set Start
                    </button>
                  )}
                  {(s.status === 'pending' || s.status === 'in_progress') && (
                    <button 
                      type="button" 
                      onClick={() => markCompleted(s)} 
                      style={{ padding: '4px 8px', fontSize: '0.875rem' }}
                    >
                      Complete
                    </button>
                  )}
                  {(s.status === 'pending' || s.status === 'in_progress') && (role === 'dev' || role === 'master_technician') && (
                    <button 
                      type="button" 
                      onClick={() => markApproved(s)} 
                      style={{ padding: '4px 8px', fontSize: '0.875rem' }}
                    >
                      Approve
                    </button>
                  )}
                  {(s.status === 'pending' || s.status === 'in_progress') && (role === 'dev' || role === 'master_technician') && (
                    <button 
                      type="button" 
                      onClick={() => setRejectStep({ step: s, reason: '' })} 
                      style={{ padding: '4px 8px', fontSize: '0.875rem', color: '#E87600' }}
                    >
                      Reject
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
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

      {/* Set Start Modal */}
      {setStartStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
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
      
      {showSubscribed && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>Projects: Subscribed Stages</h2>
          {subscribedLoading && subscribedSteps.length === 0 ? (
            <SubscribedSkeleton />
          ) : subscribedSteps.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
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
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  <div>
                    <Link to={`/workflows/${sub.project_id}#step-${sub.step_id}`} style={{ fontWeight: 500 }}>
                      {sub.step_name}
                    </Link>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>
                      Project: <Link to={`/projects/${sub.project_id}/edit`} style={{ color: '#2563eb' }}>{sub.project_name}</Link>
                    </div>
                    {notifications.length > 0 && (
                      <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 4 }}>
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
      )}

      <NewReportModal
        open={newReportModalOpen}
        onClose={() => setNewReportModalOpen(false)}
        onSaved={() => setNewReportModalOpen(false)}
        authUserId={authUser?.id ?? null}
      />
      <ReportViewModal
        open={viewReportModalOpen}
        report={selectedReport}
        onClose={() => {
          if (selectedReport) setReadReportIds((prev) => new Set(prev).add(selectedReport.id))
          setViewReportModalOpen(false)
          setSelectedReport(null)
        }}
      />
      <ReportEditModal
        open={editReportModalOpen}
        report={reportForEdit}
        onClose={() => {
          setEditReportModalOpen(false)
          setReportForEdit(null)
        }}
        onSaved={() => {
          loadMyReportsRef.current?.()
        }}
      />
      <MyReportsModal
        open={myReportsModalOpen}
        onClose={() => setMyReportsModalOpen(false)}
        reports={myReports as ReportForMyReports[]}
        reportEditWindowDays={reportEditWindowDays}
        onViewReport={(r) => {
          setSelectedReport({ id: r.id, template_name: r.template_name, job_display_name: r.job_display_name, created_at: r.created_at, created_by_name: r.created_by_name, field_values: r.field_values })
          setViewReportModalOpen(true)
        }}
        onEditReport={(r) => {
          setMyReportsModalOpen(false)
          setReportForEdit({ id: r.id, template_id: r.template_id, template_name: r.template_name, job_display_name: r.job_display_name, created_at: r.created_at, field_values: r.field_values })
          setEditReportModalOpen(true)
        }}
      />
      {viewReportsJob && (
        <JobReportsModal
          open={!!viewReportsJob}
          onClose={() => setViewReportsJob(null)}
          jobId={viewReportsJob.id}
          hcpNumber={viewReportsJob.hcpNumber}
          jobName={viewReportsJob.jobName}
          jobAddress={viewReportsJob.jobAddress}
          authUserId={authUser?.id ?? null}
        />
      )}
      {leaveReportJob && (
        <AdditionalReportModal
          open={!!leaveReportJob}
          onClose={() => setLeaveReportJob(null)}
          onSaved={() => setLeaveReportJob(null)}
          authUserId={authUser?.id ?? null}
          jobId={leaveReportJob.id}
          hcpNumber={leaveReportJob.hcpNumber}
          jobName={leaveReportJob.jobName}
          jobAddress={leaveReportJob.jobAddress}
        />
      )}
      {readyForBillingJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Send to<br />Billing</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {readyForBillingJob.hcpNumber} · {readyForBillingJob.jobName}
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={readyForBillingChecked1}
                  onChange={(e) => setReadyForBillingChecked1(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>I have reported all the Job Parts I&apos;ve used</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={readyForBillingChecked2}
                  onChange={(e) => setReadyForBillingChecked2(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>The customer knows the work is done and is satisfied</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setReadyForBillingJob(null)
                  setReadyForBillingChecked1(false)
                  setReadyForBillingChecked2(false)
                }}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!readyForBillingChecked1 || !readyForBillingChecked2 || jobStatusUpdatingId === readyForBillingJob.id}
                onClick={async () => {
                  if (!readyForBillingJob) return
                  await updateJobStatus(readyForBillingJob.id, 'ready_to_bill')
                  setReadyForBillingJob(null)
                  setReadyForBillingChecked1(false)
                  setReadyForBillingChecked2(false)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: readyForBillingChecked1 && readyForBillingChecked2 && jobStatusUpdatingId !== readyForBillingJob.id ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: readyForBillingChecked1 && readyForBillingChecked2 && jobStatusUpdatingId !== readyForBillingJob.id ? 'pointer' : 'not-allowed',
                }}
              >
                {jobStatusUpdatingId === readyForBillingJob.id ? '…' : 'Send for billing'}
              </button>
            </div>
          </div>
        </div>
      )}
      {sendBackJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Send back</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {sendBackJob.hcpNumber} · {sendBackJob.jobName}
            </p>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>
              {sendBackJob.toStatus === 'working' ? 'This will move the job back to Assigned Jobs (Working).' : 'This will move the job back to Ready to Bill.'}
            </p>
            {sendBackSentBy != null && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                Sent by: {sendBackSentBy}
              </p>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={sendBackChecked}
                  onChange={(e) => setSendBackChecked(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>I am going to call the Subcontractor and explain why</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setSendBackJob(null)
                  setSendBackChecked(false)
                }}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!sendBackChecked || jobStatusUpdatingId === sendBackJob.id}
                onClick={async () => {
                  if (!sendBackJob) return
                  await updateJobStatus(sendBackJob.id, sendBackJob.toStatus)
                  setSendBackJob(null)
                  setSendBackChecked(false)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: sendBackChecked && jobStatusUpdatingId !== sendBackJob.id ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: sendBackChecked && jobStatusUpdatingId !== sendBackJob.id ? 'pointer' : 'not-allowed',
                }}
              >
                {jobStatusUpdatingId === sendBackJob.id ? '…' : 'Send back'}
              </button>
            </div>
          </div>
        </div>
      )}
      {viewBillDetailsJob && (
        <JobBillDetailsModal
          open={!!viewBillDetailsJob}
          onClose={() => setViewBillDetailsJob(null)}
          jobId={viewBillDetailsJob.id}
          hcpNumber={viewBillDetailsJob.hcpNumber}
          jobName={viewBillDetailsJob.jobName}
          jobAddress={viewBillDetailsJob.jobAddress}
          revenue={viewBillDetailsJob.revenue}
          onEditJob={(jobId) => {
            setViewBillDetailsJob(null)
            navigate(`/jobs?edit=${jobId}`)
          }}
          onEditJobLabor={(hcpNumber) => {
            setViewBillDetailsJob(null)
            navigate(`/jobs?editLabor=${encodeURIComponent(hcpNumber)}`)
          }}
          onEditParts={(jobId) => {
            setViewBillDetailsJob(null)
            navigate(`/jobs?editParts=${jobId}`)
          }}
        />
      )}
    </div>
  )
}
