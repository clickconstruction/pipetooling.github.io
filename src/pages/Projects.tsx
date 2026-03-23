import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { Database } from '../types/database'

type Project = Database['public']['Tables']['projects']['Row']
type ProjectWithCustomer = Project & { 
  customers: { name: string } | null
  master_user: { id: string; name: string | null; email: string | null } | null
}
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'superintendent'

export default function Projects() {
  const { user: authUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const customerId = searchParams.get('customer')

  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [projects, setProjects] = useState<ProjectWithCustomer[]>([])
  const [activeSteps, setActiveSteps] = useState<Record<string, { name: string; position: number }>>({})
  const [stepSummaries, setStepSummaries] = useState<Record<string, Array<{ name: string; status: string }>>>({})
  const [totalSteps, setTotalSteps] = useState<Record<string, number>>({})
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

  const canAssignSuperintendents = myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant'

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
    async function fetchProjects() {
      setError(null)

      // Parallelize: fetch customer name and projects together when filtering by customer
      let projectsWithMasters: ProjectWithCustomer[]
      if (customerId) {
        const [customerRes, projectsRes] = await Promise.all([
          supabase.from('customers').select('name').eq('id', customerId).single(),
          supabase
            .from('projects')
            .select('*, customers(name), users!projects_master_user_id_fkey(id, name, email)')
            .order('name')
            .eq('customer_id', customerId),
        ])
        setCustomerName((customerRes.data as { name?: string } | null)?.name ?? null)
        const { data, error: err } = projectsRes
        if (err) {
          setError(err.message)
          setLoading(false)
          return
        }
        const rows = (data ?? []) as Array<Project & { customers: { name: string } | null; users: { id: string; name: string | null; email: string | null } | null }>
        projectsWithMasters = rows.map((row) => {
          const { users, ...rest } = row
          return { ...rest, master_user: users ?? null }
        })
      } else {
        setCustomerName(null)
        const q = supabase
          .from('projects')
          .select('*, customers(name), users!projects_master_user_id_fkey(id, name, email)')
          .order('name')
        const { data, error: err } = await q
        if (err) {
          setError(err.message)
          setLoading(false)
          return
        }
        const rows = (data ?? []) as Array<Project & { customers: { name: string } | null; users: { id: string; name: string | null; email: string | null } | null }>
        projectsWithMasters = rows.map((row) => {
          const { users, ...rest } = row
          return { ...rest, master_user: users ?? null }
        })
      }

      setProjects(projectsWithMasters)
      setLoading(false)

      if (projectsWithMasters.length === 0) {
        setSuperintendentsByProject({})
        setProjectSuperintendentIdsByProject({})
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
            .in('project_id', projectIds)
            .limit(100),
          supabase.from('project_superintendents').select('project_id, superintendent_id').in('project_id', projectIds),
          masterIds.length > 0 ? supabase.from('master_superintendents').select('master_id, superintendent_id').in('master_id', masterIds) : Promise.resolve({ data: [] as { master_id: string; superintendent_id: string }[] }),
          supabase.from('jobs_ledger').select('id, hcp_number, job_name, project_id, status').in('project_id', projectIds),
        ])

        const { data: workflows, error: workflowsErr } = workflowsRes
        const psData = (psRes as { data: { project_id: string; superintendent_id: string }[] | null }).data ?? []
        const msData = (msRes as { data: { master_id: string; superintendent_id: string }[] | null }).data ?? []

        // Build superintendentsByProject
        const superintendentIds = [...new Set([...psData.map((r) => r.superintendent_id), ...msData.map((r) => r.superintendent_id)])]
        let usersMap: Record<string, { id: string; name: string | null; email: string | null }> = {}
        if (superintendentIds.length > 0) {
          const { data: usersData } = await supabase.from('users').select('id, name, email').in('id', superintendentIds)
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

        if (workflows && workflows.length > 0) {
          // Flatten nested steps with project_id
          type StepRow = { name: string; status: string; sequence_order: number }
          const allSteps: Array<StepRow & { workflow_id: string; project_id: string }> = []
          workflows.forEach((w) => {
            const steps = (w as { project_workflow_steps?: StepRow[] }).project_workflow_steps ?? []
            steps.forEach((s) => {
              allSteps.push({ ...s, workflow_id: w.id, project_id: w.project_id })
            })
          })
          allSteps.sort((a, b) => a.sequence_order - b.sequence_order)

          if (allSteps.length > 0) {
            const stepsByProject: Record<string, Array<{ name: string; status: string; sequence_order: number }>> = {}
            const activeStepsByProject: Record<string, Array<{ name: string; status: string; sequence_order: number }>> = {}
            const rejectedStepsByProject: Record<string, Array<{ name: string; status: string; sequence_order: number }>> = {}

            allSteps.forEach((s) => {
              const projectId = s.project_id
              if (projectId) {
                if (!stepsByProject[projectId]) stepsByProject[projectId] = []
                stepsByProject[projectId].push(s as { name: string; status: string; sequence_order: number })
                
                // Track rejected steps separately (to stop progress at rejected stage)
                if (s.status === 'rejected') {
                  if (!rejectedStepsByProject[projectId]) rejectedStepsByProject[projectId] = []
                  rejectedStepsByProject[projectId].push(s as { name: string; status: string; sequence_order: number })
                }
                
                // Track active steps (pending/in_progress) - but only if no rejected stages exist
                if (s.status === 'pending' || s.status === 'in_progress') {
                  if (!activeStepsByProject[projectId]) activeStepsByProject[projectId] = []
                  activeStepsByProject[projectId].push(s as { name: string; status: string; sequence_order: number })
                }
              }
            })
            
            // Build summaries: all steps with their statuses
            const summaries: Record<string, Array<{ name: string; status: string }>> = {}
            Object.entries(stepsByProject).forEach(([projectId, stepList]) => {
              const sorted = stepList.sort((a, b) => a.sequence_order - b.sequence_order)
              summaries[projectId] = sorted.map((s) => ({ name: s.name, status: s.status }))
            })
            setStepSummaries(summaries)
            
            // Build active steps map with position (1-indexed) and total steps count
            // Priority: rejected stages stop progress, then in_progress, then pending
            const active: Record<string, { name: string; position: number }> = {}
            const totals: Record<string, number> = {}
            
            // Build total steps count first
            Object.entries(stepsByProject).forEach(([projectId, stepList]) => {
              totals[projectId] = stepList.length
            })
            
            // First, check for rejected stages - they stop progress
            Object.entries(rejectedStepsByProject).forEach(([projectId, rejectedList]) => {
              if (rejectedList.length > 0) {
                // Use the first rejected stage (lowest sequence_order)
                const sorted = rejectedList.sort((a, b) => a.sequence_order - b.sequence_order)
                const firstRejected = sorted[0]
                if (firstRejected) {
                  // Find position in sorted list of all steps
                  const allSteps = stepsByProject[projectId]
                  if (allSteps) {
                    const sortedAll = allSteps.sort((a, b) => a.sequence_order - b.sequence_order)
                    const position = sortedAll.findIndex(s => s.sequence_order === firstRejected.sequence_order) + 1
                    active[projectId] = { name: firstRejected.name, position }
                  }
                }
              }
            })
            
            // Then, for projects without rejected stages, use active steps (pending/in_progress)
            Object.entries(activeStepsByProject).forEach(([projectId, stepList]) => {
              // Only set if we haven't already set a rejected stage for this project
              if (!active[projectId] && stepList.length > 0) {
                // Sort: in_progress first, then by sequence_order
                const sorted = stepList.sort((a, b) => {
                  if (a.status === 'in_progress' && b.status !== 'in_progress') return -1
                  if (a.status !== 'in_progress' && b.status === 'in_progress') return 1
                  return a.sequence_order - b.sequence_order
                })
                const firstStep = sorted[0]
                if (firstStep) {
                  // Find position in sorted list of all steps
                  const allSteps = stepsByProject[projectId]
                  if (allSteps) {
                    const sortedAll = allSteps.sort((a, b) => a.sequence_order - b.sequence_order)
                    const position = sortedAll.findIndex(s => s.sequence_order === firstStep.sequence_order) + 1
                    active[projectId] = { name: firstStep.name, position }
                  }
                }
              }
            })
            
            setActiveSteps(active)
            setTotalSteps(totals)
          }
        }
      }
    }
    fetchProjects()
  }, [customerId])

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

  if (loading) return <p>Loading projects…</p>
  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>

  return (
    <div>
      {(myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant') && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => navigate(customerId ? `/projects/new?customer=${customerId}` : '/projects/new')}
            style={{
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            New Project
          </button>
        </div>
      )}
      {customerId && (
        <p style={{ marginBottom: '1rem' }}>
          <Link to="/projects">Show all projects</Link>
        </p>
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
          <Link to={customerId ? `/projects/new?customer=${customerId}` : '/projects/new'}>Add one</Link>.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {projects.map((p) => (
            <li
              key={p.id}
              style={{
                padding: '0.75rem 0',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <Link to={`/workflows/${p.id}`} style={{ fontWeight: 500 }}>{p.name}</Link>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {p.customers?.name ?? '—'} · {p.status}
                  {activeSteps[p.id] && (
                    <span>
                      {' · Current stage: '}
                      {activeSteps[p.id]!.name}
                      {totalSteps[p.id] && (
                        <span> [{activeSteps[p.id]!.position} / {totalSteps[p.id]!}]</span>
                      )}
                    </span>
                  )}
                </div>
                {p.description && <div style={{ fontSize: '0.875rem', marginTop: 2 }}>{p.description}</div>}
                {stepSummaries[p.id] && stepSummaries[p.id]!.length > 0 && (
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 4 }}>
                    {stepSummaries[p.id]!.map((step, i) => {
                      let color = '#6b7280' // default gray
                      let fontWeight: 'normal' | 'bold' = 'normal'
                      if (step.status === 'completed' || step.status === 'approved') {
                        color = '#059669' // green
                      } else if (step.status === 'skipped') {
                        color = '#6b7280' // neutral gray
                      } else if (step.status === 'rejected') {
                        color = '#b91c1c' // red
                      } else if (step.status === 'in_progress') {
                        color = '#E87600' // strong orange
                        fontWeight = 'bold' // bold if started but not completed
                      }
                      return (
                        <span key={i}>
                          <span style={{ color, fontWeight }}>
                            {step.name}
                          </span>
                          {i < stepSummaries[p.id]!.length - 1 && <span> → </span>}
                        </span>
                      )
                    })}
                  </div>
                )}
                {(p.housecallpro_number || p.plans_link || p.address) && (
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 4, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {p.housecallpro_number && <span>HouseCallPro #: {p.housecallpro_number}</span>}
                    {p.housecallpro_number && (p.plans_link || p.address) && <span> · </span>}
                    {p.plans_link && (
                      <span>
                        <a href={p.plans_link} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>
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
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          color: '#2563eb',
                          textDecoration: 'none',
                          cursor: 'pointer',
                        }}
                        title={`View ${p.address} on map`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 640 640"
                          style={{ width: '16px', height: '16px', fill: 'currentColor' }}
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
                  alignItems: 'flex-end',
                  gap: '0.5rem',
                  minWidth: 200,
                  flexShrink: 0,
                  paddingLeft: '1rem',
                  marginLeft: '1rem',
                  borderLeft: '1px solid #e5e7eb',
                }}
              >
                <Link to={`/projects/${p.id}/edit`}>Edit</Link>
                {p.master_user && (
                  <span style={{ padding: '0.2rem 0.5rem', background: '#eff6ff', borderRadius: 4, fontSize: '0.8125rem', fontWeight: 500 }}>
                    Master: {p.master_user.name || p.master_user.email || 'Unknown'}
                  </span>
                )}
                {canAssignSuperintendents && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>Superintendents:</span>
                    {(superintendentsByProject[p.id] ?? []).length === 0 && (
                      <span style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>None</span>
                    )}
                    {(superintendentsByProject[p.id] ?? []).map((s) => (
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
                        {projectSuperintendentIdsByProject[p.id]?.has(s.id) && (
                          <button
                            type="button"
                            onClick={() => removeProjectSuperintendent(p.id, s.id)}
                            disabled={projectSuperintendentSaving}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: projectSuperintendentSaving ? 'not-allowed' : 'pointer', color: 'inherit', fontSize: '0.9em', lineHeight: 1 }}
                            title="Remove"
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
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 24,
                            height: 24,
                            padding: 0,
                            border: '1px solid #bae6fd',
                            borderRadius: 4,
                            background: 'white',
                            color: '#0369a1',
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>Superintendents:</span>
                    {(superintendentsByProject[p.id] ?? []).map((s) => (
                      <span key={s.id} style={{ padding: '0.2rem 0.5rem', background: '#f0fdf4', borderRadius: 4, fontSize: '0.8125rem' }}>
                        {s.name || s.email || 'Unknown'}
                      </span>
                    ))}
                  </div>
                )}
                {(jobsByProject[p.id]?.length ?? 0) > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>Jobs:</span>
                    {(jobsByProject[p.id] ?? []).map((j) => (
                      <Link
                        key={j.id}
                        to={`/jobs?edit=${j.id}&tab=stages`}
                        style={{ padding: '0.2rem 0.5rem', background: '#f5f5f5', borderRadius: 4, fontSize: '0.8125rem', textDecoration: 'none', color: '#374151' }}
                      >
                        {j.hcp_number || j.job_name || 'Job'}
                      </Link>
                    ))}
                    <Link
                      to={`/jobs?newJob=true&project=${p.id}&tab=stages`}
                      style={{ padding: '0.2rem 0.5rem', background: '#e0f2fe', borderRadius: 4, fontSize: '0.8125rem', textDecoration: 'none', color: '#0369a1' }}
                    >
                      + Create Job
                    </Link>
                  </div>
                ) : (
                  <Link
                    to={`/jobs?newJob=true&project=${p.id}&tab=stages`}
                    style={{ fontSize: '0.8125rem', color: '#0369a1', textDecoration: 'none' }}
                  >
                    + Create Job for this project
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {myRole === 'dev' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '1.5rem' }}>
          <Link to="/templates" style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', color: '#6b7280', textDecoration: 'none' }}>
            Edit templates
          </Link>
        </div>
      )}

      {addSuperintendentProject && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
          onClick={() => {
            setAddSuperintendentProject(null)
            setSelectedSuperintendentId('')
          }}
        >
          <div
            style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Add superintendent to {addSuperintendentProject.name}</h3>
            {(() => {
              const available = allSuperintendents.filter((s) =>
                !(superintendentsByProject[addSuperintendentProject.id] ?? []).some((ps) => ps.id === s.id)
              )
              return available.length > 0 ? (
                <select
                  value={selectedSuperintendentId}
                  onChange={(e) => setSelectedSuperintendentId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
                >
                  <option value="">Choose superintendent...</option>
                  {available.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.email || s.id}
                    </option>
                  ))}
                </select>
              ) : (
                <p style={{ color: '#6b7280', marginBottom: '1rem' }}>No superintendents available</p>
              )
            })()}
            <div style={{ display: 'flex', gap: 8 }}>
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
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddSuperintendentProject(null)
                  setSelectedSuperintendentId('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
