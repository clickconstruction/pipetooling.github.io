import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Pencil, Plus } from 'lucide-react'
import { jobsLedgerStatusDotColor, labelJobsLedgerStatusForDashboard } from '../lib/jobsLedgerStatusPipeline'
import { bidOutcomeDotColor } from '../lib/bidOutcomeDotColor'
import { estimateStatusDotColor } from '../lib/estimateStatusDotColor'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { canCreateJobsLedgerRow } from '../lib/jobsLedgerCreateRole'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { useNewProjectModal } from '../contexts/NewProjectModalContext'
import { useEditProjectModal } from '../contexts/EditProjectModalContext'
import { useJobDetailModal } from '../contexts/JobDetailModalContext'
import { useBidPreview } from '../contexts/BidPreviewModalContext'
import { withSupabaseRetry } from '../utils/errorHandling'
import { isRowBackgroundClick } from '../lib/rowBackgroundClick'
import { formatProjectNumberLabel } from '../lib/projectNumberLabel'
import { buildProjectAttention, type ProjectAttention } from '../lib/projects/projectAttention'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { pageTabStyle } from '../lib/pageTabStyle'
import { ProjectsJobHistoryTab } from '../components/projects/ProjectsJobHistoryTab'
import { ProjectsForecastTab } from '../components/projects/ProjectsForecastTab'
import { RemoveProjectSuperintendentConfirmModal } from '../components/projects/RemoveProjectSuperintendentConfirmModal'
import {
  PROJECT_STATUS_ORDER,
  projectStatusLabel,
  projectStatusPillStyle,
  type ProjectStatus,
} from '../lib/projectStatusDisplay'
import {
  PROJECTS_MUTED_GREY,
  projectsInlineLinkButtonStyle,
  projectsPrimaryButtonStyle,
  projectsSecondaryLinkColor,
} from '../lib/projectsPageStyles'
import type { Database } from '../types/database'

type Project = Database['public']['Tables']['projects']['Row']
type ProjectWithCustomer = Project & { 
  customers: { name: string } | null
  master_user: { id: string; name: string | null; email: string | null } | null
}
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'helpers' | 'superintendent'

type ProjectsPageTab = 'stages' | 'job-history' | 'forecast'

function parseProjectsPageTab(value: string | null): ProjectsPageTab {
  if (value === 'job-history') return 'job-history'
  if (value === 'forecast') return 'forecast'
  return 'stages'
}

type WorkflowStepRow = {
  name: string
  status: string
  sequence_order: number
  assigned_to_name: string | null
  started_at: string | null
  scheduled_start_date: string | null
  scheduled_end_date: string | null
}
type WorkflowRow = {
  id: string
  project_id: string
  project_workflow_steps: WorkflowStepRow[] | null
}

/* ---------------------------------------------------------------------------
 * Segmented card-rail pill (v2.1273 Jobs pill shape, shared since the Bids/
 * Estimates pills landed): a muted label cap, bordered segments, trailing
 * sky "+" segment. The Jobs pill keeps its own page-level expansion state, so
 * it consumes only the shared style objects; Bids/Estimates render through
 * <ProjectRailPill>, which owns a local "+N more" expander.
 * ------------------------------------------------------------------------- */
const railPillContainerStyle = {
  display: 'inline-flex',
  alignItems: 'stretch',
  border: '1px solid var(--border)',
  borderRadius: 8,
  overflow: 'hidden',
} as const

const railPillCapStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.25rem 0.6rem',
  fontSize: '0.75rem',
  color: 'var(--text-faint)',
  background: 'var(--bg-neutral-100)',
} as const

const railPillSegmentStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.25rem 0.6rem',
  border: 'none',
  borderLeft: '1px solid var(--border)',
  background: 'var(--surface)',
  fontSize: '0.8125rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
} as const

const railPillPlusStyle = {
  ...railPillSegmentStyle,
  textDecoration: 'none',
  color: 'var(--text-sky-700)',
  background: 'var(--bg-sky-100)',
} as const

type RailPillSegment = {
  key: string
  label: string
  title: string
  dotColor?: string
  onClick: () => void
}

function ProjectRailPill(props: {
  cap: string
  segments: RailPillSegment[]
  plusTo: string
  plusTitle: string
  plusAriaLabel: string
  /** Rendered beside the "+" when there are no segments (e.g. "Bid"). */
  emptyPlusLabel: string
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? props.segments : props.segments.slice(0, 3)
  const hiddenCount = props.segments.length - visible.length
  return (
    <div style={railPillContainerStyle}>
      <span style={railPillCapStyle}>{props.cap}</span>
      {visible.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={s.onClick}
          title={s.title}
          style={{ ...railPillSegmentStyle, color: 'var(--text-link)' }}
        >
          {s.dotColor && (
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: s.dotColor, flexShrink: 0 }} />
          )}
          <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.label}
          </span>
        </button>
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          title={`Show all ${props.cap.toLowerCase()}`}
          style={{ ...railPillSegmentStyle, color: 'var(--text-700)' }}
        >
          +{hiddenCount} more
        </button>
      )}
      <Link to={props.plusTo} title={props.plusTitle} aria-label={props.plusAriaLabel} style={railPillPlusStyle}>
        <Plus size={14} aria-hidden="true" />
        {props.segments.length === 0 && props.emptyPlusLabel}
      </Link>
    </div>
  )
}

const ESTIMATE_PILL_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  customer_accepted: 'Accepted',
  declined: 'Declined',
  superseded: 'Superseded',
}

export default function Projects() {
  const { user: authUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const customerId = searchParams.get('customer')
  const activeTab = parseProjectsPageTab(searchParams.get('tab'))
  const newProjectModal = useNewProjectModal()
  const editProjectModal = useEditProjectModal()
  const jobDetailModal = useJobDetailModal()
  const bidPreview = useBidPreview()
  const navigate = useNavigate()
  const location = useLocation()

  function setActiveTab(next: ProjectsPageTab) {
    const nextParams = new URLSearchParams(searchParams)
    if (next === 'stages') {
      nextParams.delete('tab')
    } else {
      nextParams.set('tab', next)
    }
    setSearchParams(nextParams, { replace: true })
  }

  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [projects, setProjects] = useState<ProjectWithCustomer[]>([])
  const [workflowsRaw, setWorkflowsRaw] = useState<WorkflowRow[]>([])
  const [moneyByProject, setMoneyByProject] = useState<Record<string, { projected: number; spent: number; committed: number }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState<string | null>(null)
  const [superintendentsByProject, setSuperintendentsByProject] = useState<
    Record<string, Array<{ id: string; name: string | null; email: string | null }>>
  >({})
  const [jobsByProject, setJobsByProject] = useState<
    Record<string, Array<{ id: string; hcp_number: string; job_name: string; status: string }>>
  >({})
  const [bidsByProject, setBidsByProject] = useState<
    Record<string, Array<{ id: string; bid_number: string | null; project_name: string | null; outcome: string | null }>>
  >({})
  const [estimatesByProject, setEstimatesByProject] = useState<
    Record<string, Array<{ id: string; estimate_number: number; title: string; status: string }>>
  >({})
  const [allSuperintendents, setAllSuperintendents] = useState<Array<{ id: string; name: string | null; email: string | null }>>([])
  const [projectSuperintendentIdsByProject, setProjectSuperintendentIdsByProject] = useState<Record<string, Set<string>>>({})
  const [projectSuperintendentSaving, setProjectSuperintendentSaving] = useState(false)
  const [expandedJobChips, setExpandedJobChips] = useState<Set<string>>(new Set())
  const [addSuperintendentProject, setAddSuperintendentProject] = useState<{ id: string; name: string } | null>(null)
  const [selectedSuperintendentId, setSelectedSuperintendentId] = useState('')
  const [removeTarget, setRemoveTarget] = useState<{
    projectId: string
    projectName: string
    superintendent: { id: string; name: string | null; email: string | null }
  } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<ProjectStatus>>(new Set())

  const canAssignSuperintendents = myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole)
  // The per-project "+ Job" link was a dead door for superintendent / primary (v2.2848): RLS refuses their INSERT.
  const canCreateJobs = canCreateJobsLedgerRow(myRole)
  const narrow = useNarrowViewport640()

  const visibleProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return projects.filter((p) => {
      if (statusFilter.size > 0 && !statusFilter.has(p.status)) return false
      if (!q) return true
      const hay = [
        p.name,
        p.customers?.name,
        p.housecallpro_number,
        p.address,
        p.description,
        p.master_user?.name,
        p.master_user?.email,
      ]
        .filter((v): v is string => !!v)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [projects, searchQuery, statusFilter])

  const projectAttention = useMemo<Record<string, ProjectAttention>>(() => {
    const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())
    const byProject: Record<string, ProjectAttention> = {}
    for (const w of workflowsRaw) {
      const steps = w.project_workflow_steps ?? []
      if (steps.length === 0) continue
      byProject[w.project_id] = buildProjectAttention(steps, todayYmd, calendarYmdInAppTzFromIso)
    }
    return byProject
  }, [workflowsRaw])

  // Needs-attention-first ordering (stable within equal scores, so the
  // load order is preserved for quiet projects).
  const orderedProjects = useMemo(() => {
    return [...visibleProjects].sort(
      (a, b) => (projectAttention[b.id]?.attentionScore ?? 0) - (projectAttention[a.id]?.attentionScore ?? 0),
    )
  }, [visibleProjects, projectAttention])

  const hasActiveFilter = searchQuery.trim().length > 0 || statusFilter.size > 0

  function toggleStatusFilter(status: ProjectStatus) {
    setStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  function clearFilters() {
    setSearchQuery('')
    setStatusFilter(new Set())
  }

  useEffect(() => {
    if (!addSuperintendentProject) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !projectSuperintendentSaving) {
        setAddSuperintendentProject(null)
        setSelectedSuperintendentId('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addSuperintendentProject, projectSuperintendentSaving])

  useEffect(() => {
    if (!authUser?.id) return
    supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single()
      .then(({ data }) => setMyRole((data as { role: UserRole } | null)?.role ?? null))
  }, [authUser?.id])

  useEffect(() => {
    let cancelled = false
    async function fetchProjects() {
      setLoading(true)
      setError(null)

      // Parallelize: fetch customer name (when filtering) and projects together
      let projectsQuery = supabase
        .from('projects')
        .select('*, customers(name), users!projects_master_user_id_fkey(id, name, email)')
        .order('name')
      if (customerId) projectsQuery = projectsQuery.eq('customer_id', customerId)

      const [customerRes, projectsRes] = await Promise.all([
        customerId
          ? supabase.from('customers').select('name').eq('id', customerId).single()
          : Promise.resolve({ data: null as { name: string } | null }),
        projectsQuery,
      ])
      if (cancelled) return

      setCustomerName(
        customerId ? ((customerRes.data as { name?: string } | null)?.name ?? null) : null
      )

      const { data, error: err } = projectsRes
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      const rows = (data ?? []) as Array<
        Project & {
          customers: { name: string } | null
          users: { id: string; name: string | null; email: string | null } | null
        }
      >
      const projectsWithMasters: ProjectWithCustomer[] = rows.map((row) => {
        const { users, ...rest } = row
        return { ...rest, master_user: users ?? null }
      })

      setProjects(projectsWithMasters)
      setLoading(false)

      if (projectsWithMasters.length === 0) {
        setSuperintendentsByProject({})
        setProjectSuperintendentIdsByProject({})
        setWorkflowsRaw([])
      }

      // Load active steps, step summaries, and superintendent access in background
      if (projectsWithMasters.length > 0) {
        const projectIds = projectsWithMasters.map((p) => p.id)

        // Parallel: workflows + superintendent data + linked jobs/bids/estimates
        const [workflowsRes, psRes, jobsRes, bidsRes, estimatesRes] = await Promise.all([
          supabase
            .from('project_workflows')
            .select('id, project_id, project_workflow_steps(name, status, sequence_order, assigned_to_name, started_at, scheduled_start_date, scheduled_end_date)')
            .in('project_id', projectIds),
          supabase.from('project_superintendents').select('project_id, superintendent_id').in('project_id', projectIds),
          supabase.from('jobs_ledger').select('id, hcp_number, job_name, project_id, status').in('project_id', projectIds),
          supabase.from('bids').select('id, bid_number, project_name, outcome, project_id').in('project_id', projectIds),
          supabase.from('estimates').select('id, estimate_number, title, status, project_id').in('project_id', projectIds),
        ])
        if (cancelled) return

        const { data: workflows, error: workflowsErr } = workflowsRes
        const psData = (psRes as { data: { project_id: string; superintendent_id: string }[] | null }).data ?? []

        // Build superintendentsByProject from real per-project assignments only.
        // Adoption rows (master_superintendents) are deliberately NOT merged in
        // (v2.1192): since the v2.921 auto-sync they are company-wide and grant
        // no project access, so merging painted every superintendent onto every
        // row — with no × (not assigned) and the + hidden (already "shown").
        const superintendentIds = [...new Set(psData.map((r) => r.superintendent_id))]
        const usersMap: Record<string, { id: string; name: string | null; email: string | null }> = {}
        if (superintendentIds.length > 0) {
          const { data: usersData } = await supabase.from('users').select('id, name, email').in('id', superintendentIds)
          if (cancelled) return
          const users = (usersData ?? []) as Array<{ id: string; name: string | null; email: string | null }>
          users.forEach((u) => {
            usersMap[u.id] = u
          })
        }
        const map: Record<string, Array<{ id: string; name: string | null; email: string | null }>> = {}
        const psIdsMap: Record<string, Set<string>> = {}
        projectsWithMasters.forEach((p) => {
          const ids = new Set<string>()
          psData.filter((r) => r.project_id === p.id).forEach((r) => ids.add(r.superintendent_id))
          map[p.id] = [...ids].map((id) => usersMap[id]).filter((u): u is { id: string; name: string | null; email: string | null } => !!u)
          psIdsMap[p.id] = new Set(psData.filter((r) => r.project_id === p.id).map((r) => r.superintendent_id))
        })
        setSuperintendentsByProject(map)
        setProjectSuperintendentIdsByProject(psIdsMap)

        const jobsData = (jobsRes as { data: Array<{ id: string; hcp_number: string; job_name: string; project_id: string; status: string }> | null }).data ?? []
        const jobsMap: Record<string, Array<{ id: string; hcp_number: string; job_name: string; status: string }>> = {}
        jobsData.forEach((j) => {
          if (j.project_id) {
            const arr = jobsMap[j.project_id] ?? []
            jobsMap[j.project_id] = [...arr, { id: j.id, hcp_number: j.hcp_number, job_name: j.job_name, status: j.status }]
          }
        })
        setJobsByProject(jobsMap)

        // Linked bids/estimates → segmented pills (staff-only render; RLS scopes the reads anyway).
        const bidsData = (bidsRes as { data: Array<{ id: string; bid_number: string | null; project_name: string | null; outcome: string | null; project_id: string | null }> | null }).data ?? []
        const bidsMap: Record<string, Array<{ id: string; bid_number: string | null; project_name: string | null; outcome: string | null }>> = {}
        bidsData.forEach((b) => {
          if (b.project_id) {
            const arr = bidsMap[b.project_id] ?? []
            bidsMap[b.project_id] = [...arr, { id: b.id, bid_number: b.bid_number, project_name: b.project_name, outcome: b.outcome }]
          }
        })
        setBidsByProject(bidsMap)

        const estimatesData = (estimatesRes as { data: Array<{ id: string; estimate_number: number; title: string; status: string; project_id: string | null }> | null }).data ?? []
        const estimatesMap: Record<string, Array<{ id: string; estimate_number: number; title: string; status: string }>> = {}
        estimatesData.forEach((e) => {
          if (e.project_id) {
            const arr = estimatesMap[e.project_id] ?? []
            estimatesMap[e.project_id] = [...arr, { id: e.id, estimate_number: e.estimate_number, title: e.title, status: e.status }]
          }
        })
        setEstimatesByProject(estimatesMap)

        if (workflowsErr) {
          console.error('Projects: workflows+steps query failed', workflowsErr)
        }
        setWorkflowsRaw((workflows ?? []) as WorkflowRow[])

        // Money strip (dev/master render gate; RLS scopes the reads anyway):
        // projections + step line-item sums per workflow → per project.
        // PostgREST serialises numeric as strings — coerce every amount.
        const workflowRows = (workflows ?? []) as WorkflowRow[]
        const workflowIds = workflowRows.map((w) => w.id)
        if (workflowIds.length > 0) {
          const projectIdByWorkflowId = new Map(workflowRows.map((w) => [w.id, w.project_id]))
          const [projectionsRes, lineItemsRes, commitmentsRes] = await Promise.all([
            supabase.from('workflow_projections').select('workflow_id, amount').in('workflow_id', workflowIds),
            supabase
              .from('workflow_step_line_items')
              .select('amount, project_workflow_steps!inner(workflow_id)')
              .in('project_workflow_steps.workflow_id', workflowIds),
            // Fail-soft until the step_commitments migration is pushed.
            supabase
              .from('step_commitments')
              .select('amount, status, project_workflow_steps!inner(workflow_id)')
              .in('project_workflow_steps.workflow_id', workflowIds),
          ])
          if (cancelled) return
          const money: Record<string, { projected: number; spent: number; committed: number }> = {}
          const bump = (workflowId: string | null | undefined, key: 'projected' | 'spent' | 'committed', amount: unknown) => {
            const projectId = workflowId ? projectIdByWorkflowId.get(workflowId) : undefined
            if (!projectId) return
            const n = Number(amount)
            if (!Number.isFinite(n)) return
            const entry = money[projectId] ?? { projected: 0, spent: 0, committed: 0 }
            entry[key] += n
            money[projectId] = entry
          }
          for (const row of (projectionsRes.data ?? []) as Array<{ workflow_id: string; amount: unknown }>) {
            bump(row.workflow_id, 'projected', row.amount)
          }
          for (const row of (lineItemsRes.data ?? []) as Array<{ amount: unknown; project_workflow_steps: { workflow_id: string } | { workflow_id: string }[] | null }>) {
            const joined = Array.isArray(row.project_workflow_steps) ? row.project_workflow_steps[0] : row.project_workflow_steps
            bump(joined?.workflow_id, 'spent', row.amount)
          }
          if (!commitmentsRes.error) {
            const COMMITTED_STATUSES = new Set(['offered', 'accepted', 'approved', 'settled'])
            for (const row of (commitmentsRes.data ?? []) as Array<{ amount: unknown; status: string; project_workflow_steps: { workflow_id: string } | { workflow_id: string }[] | null }>) {
              if (!COMMITTED_STATUSES.has(row.status)) continue
              const joined = Array.isArray(row.project_workflow_steps) ? row.project_workflow_steps[0] : row.project_workflow_steps
              bump(joined?.workflow_id, 'committed', row.amount)
            }
          }
          setMoneyByProject(money)
        } else {
          setMoneyByProject({})
        }
      }
    }
    void fetchProjects()
    return () => {
      cancelled = true
    }
  }, [customerId, refreshKey])

  useEffect(() => {
    const editId = (location.state as { openEditProject?: string } | null)?.openEditProject
    if (typeof editId !== 'string' || !editId || !editProjectModal) return
    editProjectModal.openEditProjectModal(editId, {
      onSaved: () => setRefreshKey((k) => k + 1),
      onDeleted: () => setRefreshKey((k) => k + 1),
    })
    navigate(location.pathname + location.search, { replace: true, state: null })
  }, [editProjectModal, location.pathname, location.search, location.state, navigate])

  useEffect(() => {
    if (!canAssignSuperintendents || projects.length === 0) return
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
    loadAllSuperintendents()
  }, [canAssignSuperintendents, projects.length])

  async function addProjectSuperintendent(projectId: string, superintendentId: string) {
    setProjectSuperintendentSaving(true)
    setError(null)
    try {
      await withSupabaseRetry(
        async () => supabase.from('project_superintendents').insert({ project_id: projectId, superintendent_id: superintendentId }),
        'add project superintendent'
      )
      const sup = allSuperintendents.find((s) => s.id === superintendentId)
      if (sup) {
        setSuperintendentsByProject((prev) => {
          const arr = prev[projectId] ?? []
          if (arr.some((s) => s.id === superintendentId)) return prev
          return { ...prev, [projectId]: [...arr, sup] }
        })
        setProjectSuperintendentIdsByProject((prev) => {
          const set = new Set(prev[projectId] ?? [])
          set.add(superintendentId)
          return { ...prev, [projectId]: set }
        })
      }
    } catch (e) {
      setError(`Failed to assign superintendent: ${e instanceof Error ? e.message : String(e)}`)
    }
    setProjectSuperintendentSaving(false)
  }

  async function removeProjectSuperintendent(projectId: string, superintendentId: string) {
    setProjectSuperintendentSaving(true)
    setError(null)
    try {
      await withSupabaseRetry(
        async () => supabase.from('project_superintendents').delete().eq('project_id', projectId).eq('superintendent_id', superintendentId),
        'remove project superintendent'
      )
      setSuperintendentsByProject((prev) => {
        const arr = (prev[projectId] ?? []).filter((s) => s.id !== superintendentId)
        return { ...prev, [projectId]: arr }
      })
      setProjectSuperintendentIdsByProject((prev) => {
        const set = new Set(prev[projectId] ?? [])
        set.delete(superintendentId)
        return { ...prev, [projectId]: set }
      })
    } catch (e) {
      setError(`Failed to remove superintendent: ${e instanceof Error ? e.message : String(e)}`)
    }
    setProjectSuperintendentSaving(false)
  }

  const stagesContent = loading ? (
    <p>Loading projects…</p>
  ) : error ? (
    <p style={{ color: 'var(--text-red-700)' }}>{error}</p>
  ) : (
    <>
      {(() => {
        const showStaffActions =
          myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole)
        const showSearchInput = projects.length > 0
        if (!showStaffActions && !showSearchInput) return null
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              flexWrap: 'wrap',
            }}
          >
            {showStaffActions && (
              <button
                type="button"
                onClick={() =>
                  newProjectModal?.openNewProjectModal({
                    prefill: customerId ? { customerId } : undefined,
                    onCreated: () => setRefreshKey((k) => k + 1),
                  })
                }
                style={projectsPrimaryButtonStyle()}
              >
                New Project
              </button>
            )}
            {showSearchInput && (
              <input
                type="search"
                placeholder="Search by name, customer, HCP, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-label="Search projects"
                style={{
                  flex: '1 1 240px',
                  minWidth: 200,
                  padding: '0.35rem 0.75rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  boxSizing: 'border-box',
                }}
              />
            )}
            {myRole === 'dev' && (
              <Link
                to="/templates"
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.875rem',
                  color: PROJECTS_MUTED_GREY,
                  textDecoration: 'none',
                  marginLeft: showSearchInput ? 0 : 'auto',
                }}
              >
                Edit templates
              </Link>
            )}
          </div>
        )
      })()}
      {customerId && (
        <p style={{ marginBottom: '1rem' }}>
          <Link to="/projects">Show all projects</Link>
        </p>
      )}
      {projects.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
            {PROJECT_STATUS_ORDER.map((status) => {
              const active = statusFilter.has(status)
              const activeStyle = projectStatusPillStyle(status)
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatusFilter(status)}
                  aria-pressed={active}
                  style={
                    active
                      ? {
                          ...activeStyle,
                          padding: '0.2rem 0.6rem',
                          cursor: 'pointer',
                          font: 'inherit',
                        }
                      : {
                          display: 'inline-block',
                          padding: '0.2rem 0.6rem',
                          borderRadius: 999,
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          background: 'var(--surface)',
                          color: 'var(--text-700)',
                          border: '1px solid var(--border-strong)',
                          cursor: 'pointer',
                          font: 'inherit',
                        }
                  }
                >
                  {projectStatusLabel(status)}
                </button>
              )
            })}
            {hasActiveFilter && (
              <button
                type="button"
                onClick={clearFilters}
                style={{
                  ...projectsInlineLinkButtonStyle(),
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.75rem',
                }}
              >
                Clear filters
              </button>
            )}
            {hasActiveFilter && (
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Showing {visibleProjects.length} of {projects.length} projects
              </span>
            )}
          </div>
        </div>
      )}
      {projects.length === 0 ? (
        <p>
          {customerId && customerName 
            ? (
              <>
                <strong>{customerName}</strong> has no projects yet. {' '}
              </>
            )
            : 'No projects yet. '}
          <button
            type="button"
            onClick={() =>
              newProjectModal?.openNewProjectModal({
                prefill: customerId ? { customerId } : undefined,
                onCreated: () => setRefreshKey((k) => k + 1),
              })
            }
            style={projectsInlineLinkButtonStyle()}
          >
            Add one
          </button>
          .
        </p>
      ) : visibleProjects.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No projects match this search or filter.{' '}
          <button
            type="button"
            onClick={clearFilters}
            style={projectsInlineLinkButtonStyle()}
          >
            Clear filters
          </button>
          .
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {orderedProjects.map((p) => (
            <li
              key={p.id}
              // Row background opens the workflow (v2.1314): the guard asks whether the
              // click landed on anything interactive (links, pills, chips, pencil) and
              // only navigates when it did not — so row controls keep working untouched
              // and future buttons cannot regress this. Text-selection releases are
              // ignored. Keyboard path is unchanged (the project-name link).
              onClick={(e) => {
                if (!isRowBackgroundClick(e.target)) return
                navigate(`/workflows/${p.id}`)
              }}
              title="Open workflow"
              style={{
                padding: '0.75rem 0',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                flexDirection: narrow ? 'column' : 'row',
                justifyContent: narrow ? 'flex-start' : 'space-between',
                alignItems: 'flex-start',
                gap: narrow ? '0.5rem' : 0,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <div>
                <Link to={`/workflows/${p.id}`} style={{ fontWeight: 500 }}>{p.name}</Link>
                {formatProjectNumberLabel(p.project_number) && (
                  <span style={{ marginLeft: 8, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {formatProjectNumberLabel(p.project_number)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    editProjectModal?.openEditProjectModal(p.id, {
                      onSaved: () => setRefreshKey((k) => k + 1),
                      onDeleted: () => setRefreshKey((k) => k + 1),
                    })
                  }}
                  title="Edit project"
                  aria-label={`Edit ${p.name ?? 'project'}`}
                  style={{ display: 'inline-flex', alignItems: 'center', background: 'none', border: 'none', padding: 2, marginLeft: 6, color: 'var(--text-faint)', cursor: 'pointer', verticalAlign: 'middle' }}
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {p.customers?.name ?? '—'}{' '}·{' '}
                  <span style={projectStatusPillStyle(p.status)}>{projectStatusLabel(p.status)}</span>
                </div>
                {p.description && <div style={{ fontSize: '0.875rem', marginTop: 2 }}>{p.description}</div>}
                {projectAttention[p.id] && projectAttention[p.id]!.steps.length > 0 && (
                  <div
                    style={{ display: 'flex', gap: 2, height: 10, marginTop: 8, maxWidth: 520 }}
                    aria-label={`Step progress: ${projectAttention[p.id]!.current ? `on step ${projectAttention[p.id]!.current!.position} of ${projectAttention[p.id]!.total}` : 'all steps finished'}`}
                  >
                    {projectAttention[p.id]!.steps.map((step, i) => {
                      let background = 'var(--border)'
                      let opacity = 1
                      if (step.status === 'completed' || step.status === 'approved') {
                        background = '#059669'
                        opacity = 0.7
                      } else if (step.status === 'rejected') {
                        background = '#dc2626'
                      } else if (step.status === 'in_progress') {
                        background = '#E87600'
                      } else if (step.status === 'skipped') {
                        background = 'repeating-linear-gradient(45deg, var(--border), var(--border) 3px, var(--bg-subtle) 3px, var(--bg-subtle) 6px)'
                      }
                      const total = projectAttention[p.id]!.steps.length
                      return (
                        <span
                          key={i}
                          title={`${step.name} — ${step.status.replace('_', ' ')}`}
                          style={{
                            flex: 1,
                            background,
                            opacity,
                            borderRadius: i === 0 ? '5px 0 0 5px' : i === total - 1 ? '0 5px 5px 0' : 0,
                          }}
                        />
                      )
                    })}
                  </div>
                )}
                {projectAttention[p.id]?.current && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: projectAttention[p.id]!.flags.some((f) => f.kind === 'rejected') ? 'var(--bg-red-tint)' : 'var(--bg-orange-tint)',
                        color: 'var(--text-strong)',
                        borderRadius: 999,
                        padding: '0.1rem 0.6rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {projectAttention[p.id]!.current!.name} [{projectAttention[p.id]!.current!.position}/{projectAttention[p.id]!.total}]
                      {' · '}
                      {projectAttention[p.id]!.current!.assignee ?? 'unassigned'}
                      {projectAttention[p.id]!.current!.daysInStep != null && projectAttention[p.id]!.current!.daysInStep! > 0 && (
                        <> · day {projectAttention[p.id]!.current!.daysInStep}</>
                      )}
                    </span>
                    {projectAttention[p.id]!.flags.map((flag, i) => {
                      const label =
                        flag.kind === 'rejected' ? `sent back: ${flag.stepName}`
                        : flag.kind === 'waiting' ? `waiting on ${flag.assignee} · ${flag.days}d`
                        : flag.kind === 'unassigned-current' ? 'current step unassigned'
                        : 'no schedule on current step'
                      const isRed = flag.kind === 'rejected' || flag.kind === 'no-schedule'
                      return (
                        <span
                          key={`${flag.kind}-${i}`}
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            background: isRed ? 'var(--bg-red-tint)' : 'var(--bg-amber-tint)',
                            color: isRed ? 'var(--text-red-700)' : 'var(--text-amber-800)',
                            borderRadius: 999,
                            padding: '0.1rem 0.55rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ⚠ {label}
                        </span>
                      )
                    })}
                  </div>
                )}
                {(myRole === 'dev' || myRole === 'master_technician') &&
                  moneyByProject[p.id] &&
                  (moneyByProject[p.id]!.projected !== 0 || moneyByProject[p.id]!.spent !== 0 || moneyByProject[p.id]!.committed !== 0) && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <span>
                        Projected{' '}
                        <strong style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>
                          ${moneyByProject[p.id]!.projected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </span>
                      {moneyByProject[p.id]!.committed !== 0 && (
                        <span>
                          Committed{' '}
                          <strong style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>
                            ${moneyByProject[p.id]!.committed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </strong>
                        </span>
                      )}
                      <span>
                        Spent{' '}
                        <strong style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>
                          ${moneyByProject[p.id]!.spent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </span>
                    </div>
                  )}
                {(p.housecallpro_number || p.plans_link || p.address) && (
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {p.housecallpro_number && <span>HouseCallPro #: {p.housecallpro_number}</span>}
                    {p.housecallpro_number && (p.plans_link || p.address) && <span> · </span>}
                    {p.plans_link && (
                      <span>
                        <a href={p.plans_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)' }}>
                          Link to plans
                        </a>
                      </span>
                    )}
                    {p.plans_link && p.address && <span> · </span>}
                    {p.address && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`View ${p.address} on map`}
                        title={`View ${p.address} on map`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          color: projectsSecondaryLinkColor(),
                          textDecoration: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <span>{p.address}</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 640 640"
                          aria-hidden="true"
                          style={{ width: '14px', height: '14px', fill: 'currentColor', flexShrink: 0 }}
                        >
                          <path d="M576 112C576 103.7 571.7 96 564.7 91.6C557.7 87.2 548.8 86.8 541.4 90.5L416.5 152.1L244 93.4C230.3 88.7 215.3 89.6 202.1 95.7L77.8 154.3C69.4 158.2 64 166.7 64 176L64 528C64 536.2 68.2 543.9 75.1 548.3C82 552.7 90.7 553.2 98.2 549.7L225.5 489.8L396.2 546.7C409.9 551.3 424.7 550.4 437.8 544.2L562.2 485.7C570.6 481.7 576 473.3 576 464L576 112zM208 146.1L208 445.1L112 490.3L112 191.3L208 146.1zM256 449.4L256 148.3L384 191.8L384 492.1L256 449.4zM432 198L528 150.6L528 448.8L432 494L432 198z" />
                        </svg>
                      </a>
                    )}
                  </div>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: narrow ? 'flex-start' : 'flex-end',
                  gap: '0.5rem',
                  minWidth: narrow ? undefined : 200,
                  flexShrink: 0,
                  paddingLeft: narrow ? 0 : '1rem',
                  marginLeft: narrow ? 0 : '1rem',
                  borderLeft: narrow ? 'none' : '1px solid var(--border)',
                  width: narrow ? '100%' : undefined,
                }}
              >
                {/* Rail order (v2.1274): most-used first — Jobs pill on top, superintendents below;
                    Edit moved up beside the project title. Segmented jobs control per v2.1273. */}
                {(() => {
                  const jobs = jobsByProject[p.id] ?? []
                  const expanded = expandedJobChips.has(p.id)
                  const visible = expanded ? jobs : jobs.slice(0, 3)
                  const hiddenCount = jobs.length - visible.length
                  return (
                    <div style={railPillContainerStyle}>
                      <span style={railPillCapStyle}>
                        Jobs
                      </span>
                      {visible.map((j) => (
                        <button
                          key={j.id}
                          type="button"
                          onClick={() => jobDetailModal?.openJobDetail({ jobId: j.id })}
                          title={`Open job detail — ${labelJobsLedgerStatusForDashboard(j.status)}`}
                          style={{ ...railPillSegmentStyle, color: 'var(--text-link)' }}
                        >
                          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: jobsLedgerStatusDotColor(j.status), flexShrink: 0 }} />
                          <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {j.hcp_number || j.job_name || 'Job'}
                          </span>
                        </button>
                      ))}
                      {hiddenCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedJobChips((prev) => new Set(prev).add(p.id))}
                          title="Show all jobs"
                          style={{ ...railPillSegmentStyle, color: 'var(--text-700)' }}
                        >
                          +{hiddenCount} more
                        </button>
                      )}
                      {canCreateJobs && (
                        <Link
                          to={`/jobs?newJob=true&project=${p.id}&tab=stages`}
                          title="Create job"
                          aria-label={`Create job for ${p.name ?? 'project'}`}
                          style={railPillPlusStyle}
                        >
                          <Plus size={14} aria-hidden="true" />
                          {jobs.length === 0 && 'Job'}
                        </Link>
                      )}
                    </div>
                  )
                })()}
                {/* Bids/Estimates pills (staff-only: dev/master/assistant-like — hidden from
                    superintendents and field roles). Same segmented shape as the Jobs pill. */}
                {(myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole)) && (
                  <>
                    <ProjectRailPill
                      cap="Bids"
                      segments={(bidsByProject[p.id] ?? []).map((b) => ({
                        key: b.id,
                        label: b.bid_number || b.project_name || 'Bid',
                        title: `Open bid preview — ${b.outcome === 'won' ? 'Won' : b.outcome === 'lost' ? 'Lost' : b.outcome === 'started_or_complete' ? 'Started/Complete' : 'Pending'}`,
                        dotColor: bidOutcomeDotColor(b.outcome),
                        onClick: () => bidPreview?.openBidPreview(b.id),
                      }))}
                      plusTo={`/bids?newBid=true&project=${p.id}`}
                      plusTitle="Create bid"
                      plusAriaLabel={`Create bid for ${p.name ?? 'project'}`}
                      emptyPlusLabel="Bid"
                    />
                    <ProjectRailPill
                      cap="Estimates"
                      segments={(estimatesByProject[p.id] ?? []).map((est) => ({
                        key: est.id,
                        label: est.title.trim() || `#${est.estimate_number}`,
                        title: `Open estimate #${est.estimate_number} — ${ESTIMATE_PILL_STATUS_LABELS[est.status] ?? est.status}`,
                        dotColor: estimateStatusDotColor(est.status),
                        onClick: () => navigate(`/estimates/${est.estimate_number}`),
                      }))}
                      plusTo={`/estimates?newEstimate=true&project=${p.id}`}
                      plusTitle="Create estimate"
                      plusAriaLabel={`Create estimate for ${p.name ?? 'project'}`}
                      emptyPlusLabel="Estimate"
                    />
                  </>
                )}
                {/* Empty + nobody to add renders nothing — "Superintendents: None" was dead text (v2.1273). */}
                {canAssignSuperintendents && ((superintendentsByProject[p.id]?.length ?? 0) > 0 || allSuperintendents.some((s) => !(superintendentsByProject[p.id] ?? []).some((ps) => ps.id === s.id))) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: narrow ? 'flex-start' : 'flex-end', alignItems: 'center' }}>
                    {(superintendentsByProject[p.id]?.length ?? 0) > 0 && (
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>Superintendents</span>
                    )}
                    {(superintendentsByProject[p.id] ?? []).map((s) => (
                      <span
                        key={s.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.15rem 0.4rem',
                          background: 'var(--bg-sky-100)',
                          color: 'var(--text-sky-700)',
                          borderRadius: 4,
                          fontSize: '0.8125rem',
                        }}
                      >
                        {s.name || s.email || 'Unknown'}
                        {projectSuperintendentIdsByProject[p.id]?.has(s.id) && (
                          <button
                            type="button"
                            onClick={() => setRemoveTarget({
                              projectId: p.id,
                              projectName: p.name ?? 'this project',
                              superintendent: s,
                            })}
                            disabled={projectSuperintendentSaving}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: projectSuperintendentSaving ? 'not-allowed' : 'pointer', color: 'inherit', fontSize: '0.9em', lineHeight: 1 }}
                            title="Remove"
                            aria-label={`Remove ${s.name || s.email || 'superintendent'} from ${p.name ?? 'project'}`}
                          >
                            {"\u00d7"}
                          </button>
                        )}
                      </span>
                    ))}
                    {(() => {
                      const assigned = superintendentsByProject[p.id] ?? []
                      const available = allSuperintendents.filter((s) => !assigned.some((ps) => ps.id === s.id))
                      return available.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAddSuperintendentProject({ id: p.id, name: p.name ?? 'Project' })
                            setSelectedSuperintendentId('')
                          }}
                          disabled={projectSuperintendentSaving}
                          title="Add superintendent"
                          aria-label={`Add superintendent to ${p.name ?? 'project'}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.25rem',
                            height: 24,
                            padding: assigned.length === 0 ? '0 0.6rem' : 0,
                            width: assigned.length === 0 ? undefined : 24,
                            border: '1px dashed var(--border-sky)',
                            borderRadius: 6,
                            background: 'var(--surface)',
                            color: 'var(--text-sky-700)',
                            fontFamily: 'inherit',
                            fontSize: assigned.length === 0 ? '0.8125rem' : '1.125rem',
                            lineHeight: 1,
                            cursor: projectSuperintendentSaving ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {assigned.length === 0 ? (
                            <>
                              <Plus size={13} aria-hidden="true" />
                              Superintendent
                            </>
                          ) : (
                            '+'
                          )}
                        </button>
                      ) : null
                    })()}
                  </div>
                )}
                {!canAssignSuperintendents && (superintendentsByProject[p.id]?.length ?? 0) > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: narrow ? 'flex-start' : 'flex-end' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>Superintendents</span>
                    {(superintendentsByProject[p.id] ?? []).map((s) => (
                      <span key={s.id} style={{ padding: '0.2rem 0.5rem', background: 'var(--bg-green-tint)', borderRadius: 4, fontSize: '0.8125rem' }}>
                        {s.name || s.email || 'Unknown'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          style={pageTabStyle(activeTab === 'stages')}
          onClick={() => setActiveTab('stages')}
        >
          Projects
        </button>
        <button
          type="button"
          style={pageTabStyle(activeTab === 'job-history')}
          onClick={() => setActiveTab('job-history')}
        >
          Job History
        </button>
        <button
          type="button"
          style={pageTabStyle(activeTab === 'forecast')}
          onClick={() => setActiveTab('forecast')}
        >
          Forecast
        </button>
      </div>

      {activeTab === 'stages' ? stagesContent : null}
      {activeTab === 'job-history' ? (
        <ProjectsJobHistoryTab customerId={customerId} />
      ) : null}
      {activeTab === 'forecast' ? (
        <ProjectsForecastTab customerId={customerId} myRole={myRole} />
      ) : null}

      {addSuperintendentProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1004,
          }}
          onClick={() => {
            if (projectSuperintendentSaving) return
            setAddSuperintendentProject(null)
            setSelectedSuperintendentId('')
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-superintendent-title"
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              padding: '1.25rem',
              maxWidth: 440,
              width: '92%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="add-superintendent-title"
              style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}
            >
              Add superintendent to {addSuperintendentProject.name}
            </h3>
            {(() => {
              const available = allSuperintendents.filter((s) =>
                !(superintendentsByProject[addSuperintendentProject.id] ?? []).some((ps) => ps.id === s.id)
              )
              return available.length > 0 ? (
                <select
                  value={selectedSuperintendentId}
                  onChange={(e) => setSelectedSuperintendentId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    marginBottom: '1rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    fontSize: '0.875rem',
                    background: 'var(--surface)',
                  }}
                  aria-label="Choose superintendent"
                >
                  <option value="">Choose superintendent...</option>
                  {available.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.email || s.id}
                    </option>
                  ))}
                </select>
              ) : (
                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No superintendents available</p>
              )
            })()}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={projectSuperintendentSaving}
                onClick={() => {
                  setAddSuperintendentProject(null)
                  setSelectedSuperintendentId('')
                }}
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.875rem',
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  cursor: projectSuperintendentSaving ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (selectedSuperintendentId && addSuperintendentProject) {
                    await addProjectSuperintendent(addSuperintendentProject.id, selectedSuperintendentId)
                    setAddSuperintendentProject(null)
                    setSelectedSuperintendentId('')
                  }
                }}
                disabled={!selectedSuperintendentId || projectSuperintendentSaving}
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.875rem',
                  background: !selectedSuperintendentId || projectSuperintendentSaving ? 'var(--bg-200)' : '#2563eb',
                  color: !selectedSuperintendentId || projectSuperintendentSaving ? 'var(--text-muted)' : '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: !selectedSuperintendentId || projectSuperintendentSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {projectSuperintendentSaving ? 'Adding\u2026' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      <RemoveProjectSuperintendentConfirmModal
        open={!!removeTarget}
        busy={projectSuperintendentSaving}
        personLabel={removeTarget ? (removeTarget.superintendent.name || removeTarget.superintendent.email || 'This superintendent') : ''}
        projectName={removeTarget?.projectName ?? ''}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={async () => {
          if (!removeTarget) return
          await removeProjectSuperintendent(removeTarget.projectId, removeTarget.superintendent.id)
          setRemoveTarget(null)
        }}
      />
    </div>
  )
}
