import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Database } from '../types/database'

type UserRole = 'owner' | 'master_technician' | 'assistant'

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
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function personDisplay(name: string | null): string {
  return (name && name.trim()) ? name.trim() : 'Assigned to: unknown'
}

export default function Dashboard() {
  const { user: authUser } = useAuth()
  const [role, setRole] = useState<UserRole | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [subscribedSteps, setSubscribedSteps] = useState<SubscribedStep[]>([])
  const [assignedSteps, setAssignedSteps] = useState<AssignedStep[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authUser?.id) {
      setLoading(false)
      return
    }
    ;(async () => {
      const { data: userData, error: e } = await supabase
        .from('users')
        .select('role, name')
        .eq('id', authUser.id)
        .single()
      if (e) {
        setError(e.message)
        setLoading(false)
        return
      }
      const user = userData as { role: UserRole; name: string | null } | null
      setRole(user?.role ?? null)
      const name = user?.name ?? null
      setUserName(name)
      
      // Load subscribed steps
      const { data: subs } = await supabase
        .from('step_subscriptions')
        .select('step_id, notify_when_started, notify_when_complete, notify_when_reopened')
        .eq('user_id', authUser.id)
        .or('notify_when_started.eq.true,notify_when_complete.eq.true,notify_when_reopened.eq.true')
      
      if (subs && subs.length > 0) {
        const stepIds = subs.map((s) => s.step_id)
        const { data: steps } = await supabase
          .from('project_workflow_steps')
          .select('id, name, workflow_id')
          .in('id', stepIds)
        
        if (steps && steps.length > 0) {
          const workflowIds = [...new Set(steps.map((s) => s.workflow_id))]
          const { data: workflows } = await supabase
            .from('project_workflows')
            .select('id, project_id')
            .in('id', workflowIds)
          
          if (workflows) {
            const projectIds = [...new Set(workflows.map((w) => w.project_id))]
            const { data: projects } = await supabase
              .from('projects')
              .select('id, name')
              .in('id', projectIds)
            
            if (projects) {
              const workflowToProject = new Map<string, string>()
              workflows.forEach((w) => workflowToProject.set(w.id, w.project_id))
              const projectMap = new Map<string, string>()
              projects.forEach((p) => projectMap.set(p.id, p.name))
              
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
                    notify_when_started: sub.notify_when_started,
                    notify_when_complete: sub.notify_when_complete,
                    notify_when_reopened: sub.notify_when_reopened,
                  })
                }
              })
              setSubscribedSteps(subscribed)
            }
          }
        }
      }
      
      // Load assigned steps
      if (name) {
        const { data: steps } = await supabase
          .from('project_workflow_steps')
          .select('*')
          .eq('assigned_to_name', name)
          .order('created_at', { ascending: false })
        
        if (steps && steps.length > 0) {
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
        }
      }
      
      setLoading(false)
    })()
  }, [authUser?.id])

  if (loading) return <p>Loading…</p>
  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Your role: <strong>{role == null ? '—' : role.charAt(0).toUpperCase() + role.slice(1)}</strong></p>
      
      {assignedSteps.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>Assigned Stages</h2>
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
                    <div style={{ fontWeight: 600 }}>{s.name} - {personDisplay(s.assigned_to_name)}</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 4 }}>
                      Project: <Link to={`/workflows/${s.project_id}#step-${s.id}`} style={{ color: '#2563eb' }}>{s.project_name}</Link>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.875rem', marginBottom: 8 }}>Status: {s.status}</div>
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
              </div>
            ))}
          </div>
        </div>
      )}
      
      {subscribedSteps.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>Subscribed Stages</h2>
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
                    <Link to={`/workflows/${sub.project_id}`} style={{ fontWeight: 500 }}>
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
        </div>
      )}
    </div>
  )
}
