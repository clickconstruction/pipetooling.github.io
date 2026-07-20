import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { useNewProjectModal } from '../contexts/NewProjectModalContext'
import { useEditProjectModal } from '../contexts/EditProjectModalContext'
import { withSupabaseRetry } from '../utils/errorHandling'
import { formatProjectNumberLabel } from '../lib/projectNumberLabel'
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

type WorkflowStepRow = { name: string; status: string; sequence_order: number }
type WorkflowRow = {
  id: string
  project_id: string
  project_workflow_steps: WorkflowStepRow[] | null
}

type ProjectStepInfo = {
  steps: Array<{ name: string; status: string }>
  current: { name: string; position: number } | null
  total: number
}

export default function Projects() {
  const { user: authUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const customerId = searchParams.get('customer')
  const activeTab = parseProjectsPageTab(searchParams.get('tab'))
  const newProjectModal = useNewProjectModal()
  const editProjectModal = useEditProjectModal()
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState<string | null>(null)
  const [superintendentsByProject, setSuperintendentsByProject] = useState<
    Record<string, Array<{ id: string; name: string | null; email: string | null }>>
  >({})
  const [jobsByProject, setJobsByProject] = useState<
    Record<string, Array<{ id: string; hcp_number: string; job_name: string; status: string }>>
  >({})
  const [allSuperintendents, setAllSuperintendents] = useState<Array<{ id: string; name: string | null; email: string | null }>>([])
  const [projectSuperintendentIdsByProject, setProjectSuperintendentIdsByProject] = useState<Record<string, Set<string>>>({})
  const [projectSuperintendentSaving, setProjectSuperintendentSaving] = useState(false)
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

  const projectStepInfo = useMemo<Record<string, ProjectStepInfo>>(() => {
    const byProject: Record<string, ProjectStepInfo> = {}
    for (const w of workflowsRaw) {
      const sorted = [...(w.project_workflow_steps ?? [])].sort(
        (a, b) => a.sequence_order - b.sequence_order
      )
      if (sorted.length === 0) continue
      const steps = sorted.map((s) => ({ name: s.name, status: s.status }))
      const firstRejected = sorted.find((s) => s.status === 'rejected')
      let current: ProjectStepInfo['current'] = null
      if (firstRejected) {
        const position = sorted.findIndex((s) => s.sequence_order === firstRejected.sequence_order) + 1
        current = { name: firstRejected.name, position }
      } else {
        const inProgress = sorted.find((s) => s.status === 'in_progress')
        const firstActive = inProgress ?? sorted.find((s) => s.status === 'pending')
        if (firstActive) {
          const position = sorted.findIndex((s) => s.sequence_order === firstActive.sequence_order) + 1
          current = { name: firstActive.name, position }
        }
      }
      byProject[w.project_id] = { steps, current, total: sorted.length }
    }
    return byProject
  }, [workflowsRaw])

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
        const masterIds = [...new Set(projectsWithMasters.map((p) => p.master_user_id).filter(Boolean))] as string[]

        // Parallel: workflows + superintendent data + linked jobs
        const [workflowsRes, psRes, msRes, jobsRes] = await Promise.all([
          supabase
            .from('project_workflows')
            .select('id, project_id, project_workflow_steps(name, status, sequence_order)')
            .in('project_id', projectIds),
          supabase.from('project_superintendents').select('project_id, superintendent_id').in('project_id', projectIds),
          masterIds.length > 0 ? supabase.from('master_superintendents').select('master_id, superintendent_id').in('master_id', masterIds) : Promise.resolve({ data: [] as { master_id: string; superintendent_id: string }[] }),
          supabase.from('jobs_ledger').select('id, hcp_number, job_name, project_id, status').in('project_id', projectIds),
        ])
        if (cancelled) return

        const { data: workflows, error: workflowsErr } = workflowsRes
        const psData = (psRes as { data: { project_id: string; superintendent_id: string }[] | null }).data ?? []
        const msData = (msRes as { data: { master_id: string; superintendent_id: string }[] | null }).data ?? []

        // Build superintendentsByProject
        const superintendentIds = [...new Set([...psData.map((r) => r.superintendent_id), ...msData.map((r) => r.superintendent_id)])]
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
          msData.filter((r) => r.master_id === p.master_user_id).forEach((r) => ids.add(r.superintendent_id))
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

        if (workflowsErr) {
          console.error('Projects: workflows+steps query failed', workflowsErr)
        }
        setWorkflowsRaw((workflows ?? []) as WorkflowRow[])
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
          {visibleProjects.map((p) => (
            <li
              key={p.id}
              style={{
                padding: '0.75rem 0',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                flexDirection: narrow ? 'column' : 'row',
                justifyContent: narrow ? 'flex-start' : 'space-between',
                alignItems: 'flex-start',
                gap: narrow ? '0.5rem' : 0,
              }}
            >
              <div>
                <Link to={`/workflows/${p.id}`} style={{ fontWeight: 500 }}>{p.name}</Link>
                {formatProjectNumberLabel(p.project_number) && (
                  <span style={{ marginLeft: 8, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {formatProjectNumberLabel(p.project_number)}
                  </span>
                )}
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {p.customers?.name ?? '—'}{' '}·{' '}
                  <span style={projectStatusPillStyle(p.status)}>{projectStatusLabel(p.status)}</span>
                  {projectStepInfo[p.id]?.current && (
                    <span>
                      {' · Current stage: '}
                      {projectStepInfo[p.id]!.current!.name}
                      {projectStepInfo[p.id]!.total > 0 && (
                        <span> [{projectStepInfo[p.id]!.current!.position} / {projectStepInfo[p.id]!.total}]</span>
                      )}
                    </span>
                  )}
                </div>
                {p.description && <div style={{ fontSize: '0.875rem', marginTop: 2 }}>{p.description}</div>}
                {projectStepInfo[p.id] && projectStepInfo[p.id]!.steps.length > 0 && (
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {projectStepInfo[p.id]!.steps.map((step, i) => {
                      let color = '#6b7280'
                      let fontWeight: 'normal' | 'bold' = 'normal'
                      if (step.status === 'completed' || step.status === 'approved') {
                        color = '#059669'
                      } else if (step.status === 'skipped') {
                        color = '#6b7280'
                      } else if (step.status === 'rejected') {
                        color = 'var(--text-red-700)'
                      } else if (step.status === 'in_progress') {
                        color = '#E87600'
                        fontWeight = 'bold'
                      }
                      return (
                        <span key={i}>
                          <span style={{ color, fontWeight }}>
                            {step.name}
                          </span>
                          {i < projectStepInfo[p.id]!.steps.length - 1 && <span> → </span>}
                        </span>
                      )
                    })}
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
                <button
                  type="button"
                  onClick={() => {
                    editProjectModal?.openEditProjectModal(p.id, {
                      onSaved: () => setRefreshKey((k) => k + 1),
                      onDeleted: () => setRefreshKey((k) => k + 1),
                    })
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-link)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                    font: 'inherit',
                  }}
                >
                  Edit
                </button>
                {p.master_user && (
                  <span style={{ padding: '0.2rem 0.5rem', background: 'var(--bg-blue-tint)', borderRadius: 4, fontSize: '0.8125rem', fontWeight: 500 }}>
                    Master: {p.master_user.name || p.master_user.email || 'Unknown'}
                  </span>
                )}
                {canAssignSuperintendents && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: narrow ? 'flex-start' : 'flex-end', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>Superintendents:</span>
                    {(superintendentsByProject[p.id] ?? []).length === 0 && (
                      <span style={{ color: 'var(--text-faint)', fontSize: '0.8125rem' }}>None</span>
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
                      const available = allSuperintendents.filter((s) => !(superintendentsByProject[p.id] ?? []).some((ps) => ps.id === s.id))
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
                            width: 24,
                            height: 24,
                            padding: 0,
                            border: '1px solid var(--border-sky)',
                            borderRadius: 4,
                            background: 'var(--surface)',
                            color: 'var(--text-sky-700)',
                            fontSize: '1.125rem',
                            lineHeight: 1,
                            cursor: projectSuperintendentSaving ? 'not-allowed' : 'pointer',
                          }}
                        >
                          +
                        </button>
                      ) : null
                    })()}
                  </div>
                )}
                {!canAssignSuperintendents && (superintendentsByProject[p.id]?.length ?? 0) > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: narrow ? 'flex-start' : 'flex-end' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>Superintendents:</span>
                    {(superintendentsByProject[p.id] ?? []).map((s) => (
                      <span key={s.id} style={{ padding: '0.2rem 0.5rem', background: 'var(--bg-green-tint)', borderRadius: 4, fontSize: '0.8125rem' }}>
                        {s.name || s.email || 'Unknown'}
                      </span>
                    ))}
                  </div>
                )}
                {(jobsByProject[p.id]?.length ?? 0) > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: narrow ? 'flex-start' : 'flex-end' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>Jobs:</span>
                    {(jobsByProject[p.id] ?? []).map((j) => (
                      <Link
                        key={j.id}
                        to={`/jobs?edit=${j.id}&tab=stages`}
                        style={{ padding: '0.2rem 0.5rem', background: 'var(--bg-neutral-100)', borderRadius: 4, fontSize: '0.8125rem', textDecoration: 'none', color: 'var(--text-700)' }}
                      >
                        {j.hcp_number || j.job_name || 'Job'}
                      </Link>
                    ))}
                    <Link
                      to={`/jobs?newJob=true&project=${p.id}&tab=stages`}
                      style={{ padding: '0.2rem 0.5rem', background: 'var(--bg-sky-100)', borderRadius: 4, fontSize: '0.8125rem', textDecoration: 'none', color: 'var(--text-sky-700)' }}
                    >
                      + Create Job
                    </Link>
                  </div>
                ) : (
                  <Link
                    to={`/jobs?newJob=true&project=${p.id}&tab=stages`}
                    style={{ fontSize: '0.8125rem', color: 'var(--text-sky-700)', textDecoration: 'none' }}
                  >
                    + Create Job for this project
                  </Link>
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
          Stages
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
