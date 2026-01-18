import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Database } from '../types/database'

type Project = Database['public']['Tables']['projects']['Row']
type ProjectWithCustomer = Project & { customers: { name: string } | null }
type UserRole = 'owner' | 'master_technician' | 'assistant'

export default function Projects() {
  const { user: authUser } = useAuth()
  const [searchParams] = useSearchParams()
  const customerId = searchParams.get('customer')

  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [projects, setProjects] = useState<ProjectWithCustomer[]>([])
  const [activeSteps, setActiveSteps] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      let q = supabase
        .from('projects')
        .select('*, customers(name)')
        .order('name')
      if (customerId) q = q.eq('customer_id', customerId)
      const { data, error: err } = await q
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      const projs = (data as ProjectWithCustomer[]) ?? []
      setProjects(projs)
      
      // Load active steps for all projects
      if (projs.length > 0) {
        const projectIds = projs.map((p) => p.id)
        
        // Get workflows for these projects
        const { data: workflows } = await supabase
          .from('project_workflows')
          .select('id, project_id')
          .in('project_id', projectIds)
        
        if (workflows && workflows.length > 0) {
          const workflowIds = workflows.map((w) => w.id)
          const workflowToProject = new Map<string, string>()
          workflows.forEach((w) => workflowToProject.set(w.id, w.project_id))
          
          // Get all steps for these workflows
          const { data: steps } = await supabase
            .from('project_workflow_steps')
            .select('workflow_id, name, status, sequence_order')
            .in('workflow_id', workflowIds)
            .in('status', ['pending', 'in_progress'])
            .order('sequence_order', { ascending: true })
          
          if (steps) {
            // Find the first active step per project
            // Priority: in_progress first, then pending, by sequence_order
            const stepsByProject: Record<string, Array<{ name: string; status: string; sequence_order: number }>> = {}
            steps.forEach((s) => {
              const projectId = workflowToProject.get(s.workflow_id)
              if (projectId) {
                if (!stepsByProject[projectId]) stepsByProject[projectId] = []
                stepsByProject[projectId].push(s as { name: string; status: string; sequence_order: number })
              }
            })
            
            const active: Record<string, string> = {}
            Object.entries(stepsByProject).forEach(([projectId, stepList]) => {
              // Sort: in_progress first, then by sequence_order
              const sorted = stepList.sort((a, b) => {
                if (a.status === 'in_progress' && b.status !== 'in_progress') return -1
                if (a.status !== 'in_progress' && b.status === 'in_progress') return 1
                return a.sequence_order - b.sequence_order
              })
              const firstStep = sorted[0]
              if (firstStep) {
                active[projectId] = firstStep.name
              }
            })
            setActiveSteps(active)
          }
        }
      }
      
      setLoading(false)
    }
    fetchProjects()
  }, [customerId])

  if (loading) return <p>Loading projects…</p>
  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Projects</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
          <Link to="/projects/new" style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', borderRadius: 6, textDecoration: 'none' }}>
            Add project
          </Link>
          {myRole === 'owner' && (
            <Link to="/templates" style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', color: '#6b7280', textDecoration: 'none' }}>
              Edit templates
            </Link>
          )}
        </div>
      </div>
      {customerId && (
        <p style={{ marginBottom: '1rem' }}>
          <Link to="/projects">Show all projects</Link>
        </p>
      )}
      {projects.length === 0 ? (
        <p>No projects yet. <Link to="/projects/new">Add one</Link>.</p>
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
                alignItems: 'center',
              }}
            >
              <div>
                <Link to={`/workflows/${p.id}`} style={{ fontWeight: 500 }}>{p.name}</Link>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {p.customers?.name ?? '—'} · {p.status}
                  {activeSteps[p.id] && <span> · Current stage: {activeSteps[p.id]}</span>}
                </div>
                {p.description && <div style={{ fontSize: '0.875rem', marginTop: 2 }}>{p.description}</div>}
                {(p.housecallpro_number || p.plans_link) && (
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 4 }}>
                    {p.housecallpro_number && <span>HouseCallPro #: {p.housecallpro_number}</span>}
                    {p.housecallpro_number && p.plans_link && <span> · </span>}
                    {p.plans_link && (
                      <span>
                        <a href={p.plans_link} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>
                          Link to plans
                        </a>
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Link to={`/workflows/${p.id}`}>Workflow</Link>
                <Link to={`/projects/${p.id}/edit`}>Edit</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
