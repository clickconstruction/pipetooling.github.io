import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type CalendarStep = {
  id: string
  name: string
  project_id: string
  project_name: string
  scheduled_start_date: string | null
  started_at: string | null
  status: string
}

// Helper functions for Central Time (America/Chicago timezone)
function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getCentralDateFromUTC(utcString: string | null): string | null {
  if (!utcString) return null
  // Convert UTC string to Central Time date string (YYYY-MM-DD)
  const utcDate = new Date(utcString)
  // Use Intl.DateTimeFormat to get date components in Central Time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(utcDate)
  const year = parts.find(p => p.type === 'year')?.value
  const month = parts.find(p => p.type === 'month')?.value
  const day = parts.find(p => p.type === 'day')?.value
  if (year && month && day) {
    return `${year}-${month}-${day}`
  }
  return null
}

function getCentralDate(date: Date): Date {
  // Get current date in Central Time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10)
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10) - 1
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10)
  return new Date(year, month, day)
}

export default function Calendar() {
  const { user: authUser } = useAuth()
  const [userName, setUserName] = useState<string | null>(null)
  const [steps, setSteps] = useState<CalendarStep[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Initialize currentMonth in Central Time
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return getCentralDate(now)
  })

  useEffect(() => {
    if (!authUser?.id) {
      setLoading(false)
      return
    }
    ;(async () => {
      const { data: userData } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', authUser.id)
        .single()
      if (userData) {
        setUserName((userData as { name: string; email: string | null }).name)
      }
      await loadAssignedSteps((userData as { name: string; email: string | null } | null)?.name ?? null)
      setLoading(false)
    })()
  }, [authUser?.id])

  async function loadAssignedSteps(name: string | null) {
    if (!name) {
      setSteps([])
      return
    }
    // Get all steps assigned to this user (by name match)
    const { data: stepData, error: e } = await supabase
      .from('project_workflow_steps')
      .select('id, name, workflow_id, scheduled_start_date, started_at, status')
      .eq('assigned_to_name', name.trim())
    
    if (e) {
      setError(e.message)
      return
    }
    
    if (!stepData || stepData.length === 0) {
      setSteps([])
      return
    }
    
    // Get workflows and projects
    const workflowIds = [...new Set(stepData.map((s) => s.workflow_id))]
    const { data: workflows } = await supabase
      .from('project_workflows')
      .select('id, project_id')
      .in('id', workflowIds)
    
    if (!workflows) {
      setSteps([])
      return
    }
    
    const projectIds = [...new Set(workflows.map((w) => w.project_id))]
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name')
      .in('id', projectIds)
    
    if (!projects) {
      setSteps([])
      return
    }
    
    const workflowToProject = new Map<string, string>()
    workflows.forEach((w) => workflowToProject.set(w.id, w.project_id))
    const projectMap = new Map<string, string>()
    projects.forEach((p) => projectMap.set(p.id, p.name))
    
    const calendarSteps: CalendarStep[] = stepData.map((s) => {
      const projectId = workflowToProject.get(s.workflow_id)
      const projectName = projectId ? projectMap.get(projectId) : 'Unknown'
      return {
        id: s.id,
        name: s.name,
        project_id: projectId ?? '',
        project_name: projectName ?? 'Unknown',
        scheduled_start_date: s.scheduled_start_date,
        started_at: s.started_at,
        status: s.status,
      }
    })
    
    setSteps(calendarSteps)
  }

  function getDaysInMonth(date: Date): Date[] {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: Date[] = []
    
    // Add padding days from previous month
    const startDayOfWeek = firstDay.getDay()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i))
    }
    
    // Add days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day))
    }
    
    // Add padding days to fill last week
    const endDayOfWeek = lastDay.getDay()
    for (let day = 1; day <= 6 - endDayOfWeek; day++) {
      days.push(new Date(year, month + 1, day))
    }
    
    return days
  }

  function getStepsForDate(date: Date): CalendarStep[] {
    const dateKey = formatDateKey(date)
    return steps.filter((s) => {
      // Convert UTC timestamps to Central Time before extracting date part
      // scheduled_start_date might be a date string (YYYY-MM-DD) or a timestamp
      let stepDate: string | null = null
      if (s.scheduled_start_date) {
        // If it contains 'T', it's a timestamp; otherwise it's already a date string
        if (s.scheduled_start_date.includes('T')) {
          stepDate = getCentralDateFromUTC(s.scheduled_start_date)
        } else {
          stepDate = s.scheduled_start_date
        }
      } else if (s.started_at) {
        stepDate = getCentralDateFromUTC(s.started_at)
      }
      return stepDate === dateKey
    })
  }

  function prevMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  function nextMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  function today() {
    const now = new Date()
    setCurrentMonth(getCentralDate(now))
  }

  if (loading) return <p>Loading...</p>
  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>

  const days = getDaysInMonth(currentMonth)
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'America/Chicago' })
  const now = new Date()
  const centralNow = getCentralDate(now)
  const todayKey = formatDateKey(centralNow)
  const isCurrentMonth = currentMonth.getMonth() === centralNow.getMonth() && currentMonth.getFullYear() === centralNow.getFullYear()

  return (
    <div>
      <h1 style={{ marginBottom: '1rem' }}>Calendar</h1>
      {!userName && (
        <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
          No stages assigned. Stages are assigned by name in workflow steps.
        </p>
      )}
      
      {userName && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button type="button" onClick={prevMonth} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>
                ←
              </button>
              <h2 style={{ margin: 0, fontSize: '1.25rem', minWidth: 200, textAlign: 'center' }}>{monthName}</h2>
              <button type="button" onClick={nextMonth} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>
                →
              </button>
            </div>
            <button type="button" onClick={today} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>
              Today
            </button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: '#e5e7eb', border: '1px solid #e5e7eb' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} style={{ background: 'white', padding: '0.5rem', textAlign: 'center', fontWeight: 500, fontSize: '0.875rem' }}>
                {day}
              </div>
            ))}
            {days.map((day, idx) => {
              const daySteps = getStepsForDate(day)
              const isToday = formatDateKey(day) === todayKey && isCurrentMonth
              const isCurrentMonthDay = day.getMonth() === currentMonth.getMonth()
              return (
                <div
                  key={idx}
                  style={{
                    background: 'white',
                    minHeight: 100,
                    padding: '0.5rem',
                    border: isToday ? '2px solid #2563eb' : 'none',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.875rem',
                      color: isCurrentMonthDay ? '#111827' : '#9ca3af',
                      fontWeight: isToday ? 600 : 400,
                      marginBottom: '0.25rem',
                    }}
                  >
                    {day.getDate()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {daySteps.map((step) => (
                      <Link
                        key={step.id}
                        to={`/workflows/${step.project_id}`}
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 4px',
                          background: step.status === 'completed' || step.status === 'approved' ? '#f0fdf4' : step.status === 'rejected' ? '#fef2f2' : '#eff6ff',
                          color: '#111827',
                          textDecoration: 'none',
                          borderRadius: 3,
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                        title={`${step.name} - ${step.project_name}`}
                      >
                        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {step.name}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {step.project_name}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
