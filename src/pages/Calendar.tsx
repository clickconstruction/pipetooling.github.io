import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'estimator'

type CalendarStep = {
  id: string
  name: string
  project_id: string
  project_name: string
  scheduled_start_date: string | null
  started_at: string | null
  status: string
}

type CalendarBid = {
  id: string
  project_name: string
  bid_due_date: string
  service_type_name: string
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
  const [bids, setBids] = useState<CalendarBid[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDayForModal, setSelectedDayForModal] = useState<Date | null>(null)
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
        .select('name, email, role, estimator_service_type_ids')
        .eq('id', authUser.id)
        .single()
      const user = userData as { name: string; email: string | null; role: UserRole; estimator_service_type_ids?: string[] | null } | null
      if (user) {
        setUserName(user.name)
      }
      await loadAssignedSteps(user?.name ?? null)
      await loadBids(user?.role ?? null, user?.estimator_service_type_ids ?? null)
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

  async function loadBids(userRole: UserRole | null, estServiceTypeIds: string[] | null) {
    // Only show bids for users who can access the Bids page
    if (userRole !== 'dev' && userRole !== 'master_technician' && userRole !== 'assistant' && userRole !== 'estimator') {
      setBids([])
      return
    }
    // Include bids where outcome is null OR outcome != 'lost' (SQL excludes null from neq)
    let query = supabase
      .from('bids')
      .select('id, project_name, bid_due_date, service_type_id, service_type:service_types(name)')
      .not('bid_due_date', 'is', null)
      .or('outcome.is.null,outcome.neq.lost')
    if (userRole === 'estimator' && estServiceTypeIds && estServiceTypeIds.length > 0) {
      query = query.in('service_type_id', estServiceTypeIds)
    }
    const { data: bidData, error: bidError } = await query
    if (bidError) {
      setError(bidError.message)
      return
    }
    if (!bidData) {
      setBids([])
      return
    }
    const calendarBids: CalendarBid[] = (bidData as Array<{
      id: string
      project_name: string | null
      bid_due_date: string
      service_type_id: string
      service_type: { name: string } | null
    }>).map((b) => ({
      id: b.id,
      project_name: b.project_name ?? 'Untitled',
      bid_due_date: b.bid_due_date,
      service_type_name: b.service_type?.name ?? '',
    }))
    setBids(calendarBids)
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

  function getBidsForDate(date: Date): CalendarBid[] {
    const dateKey = formatDateKey(date)
    return bids.filter((b) => {
      // Treat bid_due_date as calendar date (YYYY-MM-DD); avoid timezone conversion
      const bidDate = b.bid_due_date.slice(0, 10)
      return bidDate === dateKey
    })
  }

  function getStepDateKey(step: CalendarStep): string | null {
    if (step.scheduled_start_date) {
      return step.scheduled_start_date.includes('T')
        ? getCentralDateFromUTC(step.scheduled_start_date)
        : step.scheduled_start_date.slice(0, 10)
    }
    if (step.started_at) return getCentralDateFromUTC(step.started_at)
    return null
  }

  function buildUpcomingList(): Array<{ dateKey: string; type: 'step' | 'bid'; step?: CalendarStep; bid?: CalendarBid }> {
    const items: Array<{ dateKey: string; type: 'step' | 'bid'; step?: CalendarStep; bid?: CalendarBid }> = []
    steps.forEach((s) => {
      const key = getStepDateKey(s)
      if (key && key >= todayKey) items.push({ dateKey: key, type: 'step', step: s })
    })
    bids.forEach((b) => {
      const key = b.bid_due_date.slice(0, 10)
      if (key >= todayKey) items.push({ dateKey: key, type: 'bid', bid: b })
    })
    items.sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    return items
  }

  function formatUpcomingDate(dateKey: string): string {
    const parts = dateKey.split('-').map(Number)
    const y = parts[0] ?? 0
    const m = parts[1] ?? 1
    const d = parts[2] ?? 1
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: date.getFullYear() !== centralNow.getFullYear() ? 'numeric' : undefined })
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
      
      {!loading && (
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
              const dayBids = getBidsForDate(day)
              const isToday = formatDateKey(day) === todayKey && isCurrentMonth
              const isCurrentMonthDay = day.getMonth() === currentMonth.getMonth()
              return (
                <div
                  key={idx}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDayForModal(day)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDayForModal(day) } }}
                  style={{
                    background: 'white',
                    height: 120,
                    minHeight: 120,
                    maxHeight: 120,
                    padding: '0.5rem',
                    border: isToday ? '2px solid #2563eb' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.875rem',
                      color: isCurrentMonthDay ? '#111827' : '#9ca3af',
                      fontWeight: isToday ? 600 : 400,
                      marginBottom: '0.25rem',
                      flexShrink: 0,
                    }}
                  >
                    {day.getDate()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto', flex: 1, minHeight: 0 }} onClick={(e) => e.stopPropagation()}>
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
                    {dayBids.map((bid) => (
                      <Link
                        key={bid.id}
                        to={`/bids?bidId=${bid.id}&tab=submission-followup`}
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 4px',
                          background: '#fef3c7',
                          color: '#92400e',
                          textDecoration: 'none',
                          borderRadius: 3,
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                        title={`Bid due: ${bid.project_name}${bid.service_type_name ? ` (${bid.service_type_name})` : ''}`}
                      >
                        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Bid due: {bid.project_name}
                        </div>
                        {bid.service_type_name && (
                          <div style={{ fontSize: '0.6875rem', color: '#b45309', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {bid.service_type_name}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {selectedDayForModal && (() => {
            const modalSteps = getStepsForDate(selectedDayForModal)
            const modalBids = getBidsForDate(selectedDayForModal)
            const modalDateStr = formatUpcomingDate(formatDateKey(selectedDayForModal))
            const hasItems = modalSteps.length > 0 || modalBids.length > 0
            return (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 50,
                }}
                onClick={() => setSelectedDayForModal(null)}
              >
                <div
                  style={{
                    background: 'white',
                    borderRadius: 8,
                    padding: '1.5rem',
                    maxWidth: 400,
                    width: '90%',
                    maxHeight: '80vh',
                    overflow: 'auto',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{modalDateStr}</h3>
                    <button
                      type="button"
                      onClick={() => setSelectedDayForModal(null)}
                      style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                    >
                      Close
                    </button>
                  </div>
                  {!hasItems ? (
                    <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No items on this day.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {modalSteps.map((step) => (
                        <li key={step.id} style={{ marginBottom: '0.5rem' }}>
                          <Link
                            to={`/workflows/${step.project_id}`}
                            onClick={() => setSelectedDayForModal(null)}
                            style={{
                              display: 'block',
                              padding: '0.5rem 0.75rem',
                              background: step.status === 'completed' || step.status === 'approved' ? '#f0fdf4' : step.status === 'rejected' ? '#fef2f2' : '#eff6ff',
                              color: '#111827',
                              textDecoration: 'none',
                              borderRadius: 4,
                              border: '1px solid #e5e7eb',
                            }}
                          >
                            <div style={{ fontWeight: 500 }}>{step.name}</div>
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{step.project_name}</div>
                          </Link>
                        </li>
                      ))}
                      {modalBids.map((bid) => (
                        <li key={bid.id} style={{ marginBottom: '0.5rem' }}>
                          <Link
                            to={`/bids?bidId=${bid.id}&tab=submission-followup`}
                            onClick={() => setSelectedDayForModal(null)}
                            style={{
                              display: 'block',
                              padding: '0.5rem 0.75rem',
                              background: '#fef3c7',
                              color: '#92400e',
                              textDecoration: 'none',
                              borderRadius: 4,
                              border: '1px solid #fde68a',
                            }}
                          >
                            <div style={{ fontWeight: 500 }}>Bid due: {bid.project_name}</div>
                            {bid.service_type_name && (
                              <div style={{ fontSize: '0.875rem', color: '#b45309' }}>{bid.service_type_name}</div>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          })()}

          <section style={{ marginTop: '2rem' }}>
            <h2 style={{ margin: '0 0 0.75rem 0', fontSize: '1.125rem' }}>Upcoming</h2>
            {(() => {
              const upcomingItems = buildUpcomingList()
              return upcomingItems.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No upcoming items.</p>
              ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {upcomingItems.map((item) => (
                  <li key={item.type === 'step' ? item.step!.id : item.bid!.id} style={{ marginBottom: '0.5rem' }}>
                    {item.type === 'step' && item.step ? (
                      <Link
                        to={`/workflows/${item.step.project_id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          padding: '0.5rem 0.75rem',
                          background: item.step.status === 'completed' || item.step.status === 'approved' ? '#f0fdf4' : item.step.status === 'rejected' ? '#fef2f2' : '#eff6ff',
                          color: '#111827',
                          textDecoration: 'none',
                          borderRadius: 4,
                          border: '1px solid #e5e7eb',
                        }}
                      >
                        <span style={{ fontSize: '0.875rem', color: '#6b7280', minWidth: 120 }}>
                          {formatUpcomingDate(item.dateKey)}
                        </span>
                        <span style={{ fontWeight: 500 }}>{item.step.name}</span>
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>— {item.step.project_name}</span>
                      </Link>
                    ) : item.type === 'bid' && item.bid ? (
                      <Link
                        to={`/bids?bidId=${item.bid.id}&tab=submission-followup`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          padding: '0.5rem 0.75rem',
                          background: '#fef3c7',
                          color: '#92400e',
                          textDecoration: 'none',
                          borderRadius: 4,
                          border: '1px solid #fde68a',
                        }}
                      >
                        <span style={{ fontSize: '0.875rem', color: '#b45309', minWidth: 120 }}>
                          {formatUpcomingDate(item.dateKey)}
                        </span>
                        <span style={{ fontWeight: 500 }}>Bid due: {item.bid.project_name}</span>
                        {item.bid.service_type_name && (
                          <span style={{ fontSize: '0.875rem', color: '#b45309' }}>({item.bid.service_type_name})</span>
                        )}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
              )
            })()}
          </section>
        </>
      )}
    </div>
  )
}
