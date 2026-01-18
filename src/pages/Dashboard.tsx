import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type UserRole = 'owner' | 'master' | 'assistant'

type SubscribedStep = {
  step_id: string
  step_name: string
  project_id: string
  project_name: string
  notify_when_started: boolean
  notify_when_complete: boolean
  notify_when_reopened: boolean
}

export default function Dashboard() {
  const { user: authUser } = useAuth()
  const [role, setRole] = useState<UserRole | null>(null)
  const [subscribedSteps, setSubscribedSteps] = useState<SubscribedStep[]>([])
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
        .select('role')
        .eq('id', authUser.id)
        .single()
      if (e) {
        setError(e.message)
        setLoading(false)
        return
      }
      setRole((userData as { role: UserRole } | null)?.role ?? null)
      
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
      
      setLoading(false)
    })()
  }, [authUser?.id])

  if (loading) return <p>Loading…</p>
  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Your role: <strong>{role == null ? '—' : role.charAt(0).toUpperCase() + role.slice(1)}</strong></p>
      
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
