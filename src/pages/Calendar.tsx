import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './Calendar.css'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Database } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'
import { aggregateCalendarClockedHoursByDate } from '../lib/calendarClockedHoursByDate'
import { resolveCalendarWorkday, UNPAID_TIME_OFF_LABEL } from '../lib/resolveCalendarWorkday'

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
  bid_date_sent: string | null
  service_type_name: string
}

type CalendarProspectCallback = {
  id: string
  prospect_id: string
  callback_date: string
  title: string | null
}

type SalaryTemplateRow = Database['public']['Tables']['salary_work_schedule_templates']['Row']
type SalaryOverrideRow = Database['public']['Tables']['salary_work_schedule_day_overrides']['Row']
type UserTimeOffRow = Database['public']['Tables']['user_time_off']['Row']

type NcnsCalendarDayInfo = {
  id: string
  created_at: string
  details: string | null
}

type UpcomingListItem =
  | { dateKey: string; type: 'step'; step: CalendarStep }
  | { dateKey: string; type: 'bid'; bid: CalendarBid }
  | { dateKey: string; type: 'callback'; callback: CalendarProspectCallback }
  | { dateKey: string; type: 'time_off'; timeOff: UserTimeOffRow }
  | { dateKey: string; type: 'salary_override'; workDate: string }

function getBidSubmissionStatus(bid: CalendarBid): 'on time' | 'early' | 'not sent' {
  if (!bid.bid_date_sent || !bid.bid_date_sent.trim()) return 'not sent'
  const dueDate = bid.bid_due_date.slice(0, 10)
  const sentDate = bid.bid_date_sent.slice(0, 10)
  if (sentDate < dueDate) return 'early'
  return 'on time'
}

function getBidSubmissionStatusColor(status: 'on time' | 'early' | 'not sent'): string {
  return status === 'not sent' ? '#dc2626' : '#16a34a'
}

const CALENDAR_DAY_ACCENT = '#2563eb'
const CALENDAR_DAY_HOVER_BG = '#eff6ff'
/** In-month date numeral on white / hover (slightly darker than border for readability). */
const CALENDAR_DAY_NUMERAL = '#1d4ed8'

function calendarGridDayAriaLabel(day: Date): string {
  const when = day.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  return `${when}, open day details`
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

/** Month grid: anchor month plus leading/trailing weekdays from adjacent months (matches calendar UI). */
function getDaysInMonth(date: Date): Date[] {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const days: Date[] = []

  const startDayOfWeek = firstDay.getDay()
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i))
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push(new Date(year, month, day))
  }

  const endDayOfWeek = lastDay.getDay()
  for (let day = 1; day <= 6 - endDayOfWeek; day++) {
    days.push(new Date(year, month + 1, day))
  }

  return days
}

/** YYYY-MM-DD bounds for all cells shown in the month grid (includes padding days). */
function getVisibleGridDateRange(anchorMonth: Date): { gridStart: string; gridEnd: string } {
  const keys = getDaysInMonth(anchorMonth).map((d) => formatDateKey(d))
  if (keys.length === 0) {
    const y = anchorMonth.getFullYear()
    const m = anchorMonth.getMonth()
    const fallbackStart = formatDateKey(new Date(y, m, 1))
    const fallbackEnd = formatDateKey(new Date(y, m + 1, 0))
    return { gridStart: fallbackStart, gridEnd: fallbackEnd }
  }
  let gridStart = keys[0] as string
  let gridEnd = keys[0] as string
  for (const k of keys) {
    if (k < gridStart) gridStart = k
    if (k > gridEnd) gridEnd = k
  }
  return { gridStart, gridEnd }
}

/** Green scheduled chips are a forward projection; PTO (`time_off`) still shows on all dates. */
function showScheduledSalaryProjectionForYmd(dayYmd: string, todayYmd: string): boolean {
  return dayYmd > todayYmd
}

function ncnsCalendarChipTitle(info: NcnsCalendarDayInfo): string {
  const base = 'No-call, no-show recorded for this day.'
  const d = info.details?.trim()
  if (!d) return base
  return d.length > 160 ? `${base} ${d.slice(0, 157)}…` : `${base} ${d}`
}

function formatCalendarRecordedLine(rec: { hours: number; openCount: number } | undefined): {
  text: string
  title: string
} {
  const titleBase = 'Sum of closed clock sessions (not rejected, not revoked).'
  if (!rec || (rec.hours < 1e-6 && rec.openCount === 0)) {
    return { text: 'Recorded —', title: titleBase }
  }
  if (rec.hours < 1e-6 && rec.openCount > 0) {
    return {
      text: rec.openCount === 1 ? 'Clocked in (open)' : `Clocked in (${rec.openCount} open)`,
      title: `${titleBase} Open session(s) not counted in hours until clocked out.`,
    }
  }
  const h = rec.hours
  const value = h >= 10 ? h.toFixed(1) : h.toFixed(2)
  const openNote = rec.openCount > 0 ? ` ${rec.openCount} open session(s).` : ''
  return { text: `Recorded ${value}h`, title: titleBase + openNote }
}

function calendarRecordedHasVisibleSummary(rec: { hours: number; openCount: number } | undefined): boolean {
  return Boolean(rec && (rec.hours >= 1e-6 || rec.openCount > 0))
}

export default function Calendar() {
  const { user: authUser } = useAuth()
  const [userName, setUserName] = useState<string | null>(null)
  const [steps, setSteps] = useState<CalendarStep[]>([])
  const [bids, setBids] = useState<CalendarBid[]>([])
  const [prospectCallbacks, setProspectCallbacks] = useState<CalendarProspectCallback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDayForModal, setSelectedDayForModal] = useState<Date | null>(null)
  const [showMyWorkday, setShowMyWorkday] = useState(true)
  const [showRecordedTime, setShowRecordedTime] = useState(true)
  const [isSalaryLayerEligible, setIsSalaryLayerEligible] = useState(false)
  const [salaryTemplate, setSalaryTemplate] = useState<SalaryTemplateRow | null>(null)
  const [salaryOverridesByDate, setSalaryOverridesByDate] = useState<Record<string, SalaryOverrideRow>>({})
  const [timeOffRows, setTimeOffRows] = useState<UserTimeOffRow[]>([])
  const [ncnsByWorkDate, setNcnsByWorkDate] = useState<Map<string, NcnsCalendarDayInfo>>(() => new Map())
  const [recordedByWorkDate, setRecordedByWorkDate] = useState<
    Record<string, { hours: number; openCount: number }>
  >({})
  // Initialize currentMonth in Central Time
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return getCentralDate(now)
  })

  useEffect(() => {
    if (!authUser?.id) return
    try {
      const v = localStorage.getItem(`calendar_show_my_workday_${authUser.id}`)
      if (v !== null) setShowMyWorkday(v === 'true')
    } catch {
      /* ignore */
    }
  }, [authUser?.id])

  useEffect(() => {
    if (!authUser?.id) return
    try {
      const v = localStorage.getItem(`calendar_show_recorded_time_${authUser.id}`)
      if (v !== null) setShowRecordedTime(v === 'true')
    } catch {
      /* ignore */
    }
  }, [authUser?.id])

  useEffect(() => {
    const uid = authUser?.id
    if (!uid) {
      setNcnsByWorkDate(new Map())
      setRecordedByWorkDate({})
      return
    }
    const { gridStart, gridEnd } = getVisibleGridDateRange(currentMonth)
    let cancelled = false
    ;(async () => {
      try {
        const [incidentList, clockRows] = await Promise.all([
          withSupabaseRetry(
            async () =>
              await supabase
                .from('attendance_incidents')
                .select('id, work_date, created_at, details')
                .eq('subject_user_id', uid)
                .eq('incident_type', 'no_call_no_show')
                .gte('work_date', gridStart)
                .lte('work_date', gridEnd)
                .order('created_at', { ascending: false }),
            'calendar ncns incidents'
          ),
          withSupabaseRetry(
            async () =>
              await supabase
                .from('clock_sessions')
                .select('work_date, clocked_in_at, clocked_out_at, rejected_at, revoked_at')
                .eq('user_id', uid)
                .gte('work_date', gridStart)
                .lte('work_date', gridEnd),
            'calendar clock sessions month'
          ),
        ])
        if (cancelled) return
        const nextNcns = new Map<string, NcnsCalendarDayInfo>()
        for (const row of incidentList ?? []) {
          const wd = row.work_date
          if (!nextNcns.has(wd)) {
            nextNcns.set(wd, {
              id: row.id,
              created_at: row.created_at,
              details: row.details ?? null,
            })
          }
        }
        setNcnsByWorkDate(nextNcns)
        setRecordedByWorkDate(aggregateCalendarClockedHoursByDate(clockRows ?? []))
      } catch {
        if (!cancelled) {
          setNcnsByWorkDate(new Map())
          setRecordedByWorkDate({})
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id, currentMonth])

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
      await loadProspectCallbacks(user?.role ?? null)
      setLoading(false)
    })()
  }, [authUser?.id])

  useEffect(() => {
    if (!authUser?.id || !userName?.trim()) {
      setIsSalaryLayerEligible(false)
      setSalaryTemplate(null)
      setSalaryOverridesByDate({})
      setTimeOffRows([])
      return
    }
    const { gridStart, gridEnd } = getVisibleGridDateRange(currentMonth)
    ;(async () => {
      try {
        const payRow = await withSupabaseRetry(
          async () =>
            supabase.from('people_pay_config').select('is_salary').eq('person_name', userName.trim()).maybeSingle(),
          'calendar pay config',
        )
        const isSalary = !!(payRow as { is_salary?: boolean } | null)?.is_salary
        if (!isSalary) {
          setIsSalaryLayerEligible(false)
          setSalaryTemplate(null)
          setSalaryOverridesByDate({})
          setTimeOffRows([])
          return
        }
        const template = await withSupabaseRetry(
          async () =>
            supabase.from('salary_work_schedule_templates').select('*').eq('user_id', authUser.id).maybeSingle(),
          'calendar salary template',
        )
        if (!template) {
          setIsSalaryLayerEligible(false)
          setSalaryTemplate(null)
          setSalaryOverridesByDate({})
          setTimeOffRows([])
          return
        }
        setIsSalaryLayerEligible(true)
        setSalaryTemplate(template)
        const [ovList, ptoList] = await Promise.all([
          withSupabaseRetry(
            async () =>
              supabase
                .from('salary_work_schedule_day_overrides')
                .select('*')
                .eq('user_id', authUser.id)
                .gte('work_date', gridStart)
                .lte('work_date', gridEnd),
            'calendar salary overrides',
          ),
          withSupabaseRetry(
            async () =>
              supabase
                .from('user_time_off')
                .select('*')
                .eq('user_id', authUser.id)
                .lte('start_date', gridEnd)
                .gte('end_date', gridStart),
            'calendar user time off',
          ),
        ])
        const map: Record<string, SalaryOverrideRow> = {}
        for (const row of ovList ?? []) {
          map[row.work_date] = row
        }
        setSalaryOverridesByDate(map)
        setTimeOffRows(ptoList ?? [])
      } catch {
        setIsSalaryLayerEligible(false)
        setSalaryTemplate(null)
        setSalaryOverridesByDate({})
        setTimeOffRows([])
      }
    })()
  }, [authUser?.id, userName, currentMonth])

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
      .select('id, project_name, bid_due_date, bid_date_sent, service_type_id, service_type:service_types(name)')
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
      bid_date_sent: string | null
      service_type_id: string
      service_type: { name: string } | null
    }>).map((b) => ({
      id: b.id,
      project_name: b.project_name ?? 'Untitled',
      bid_due_date: b.bid_due_date,
      bid_date_sent: b.bid_date_sent ?? null,
      service_type_name: b.service_type?.name ?? '',
    }))
    setBids(calendarBids)
  }

  async function loadProspectCallbacks(userRole: UserRole | null) {
    if (userRole !== 'dev' && userRole !== 'master_technician' && userRole !== 'assistant') {
      setProspectCallbacks([])
      return
    }
    if (!authUser?.id) return
    const { data, error } = await supabase
      .from('prospect_callbacks')
      .select('id, prospect_id, callback_date, title')
      .eq('user_id', authUser.id)
    if (error) {
      setProspectCallbacks([])
      return
    }
    setProspectCallbacks((data ?? []) as CalendarProspectCallback[])
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

  function getCallbacksForDate(date: Date): CalendarProspectCallback[] {
    const dateKey = formatDateKey(date)
    return prospectCallbacks.filter((cb) => {
      const cbDate = getCentralDateFromUTC(cb.callback_date)
      return cbDate === dateKey
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

  function getWorkdayResolutionForDate(date: Date) {
    return resolveCalendarWorkday({
      workDateYmd: formatDateKey(date),
      timeOffRows,
      template: salaryTemplate,
      overrideForDate: salaryOverridesByDate[formatDateKey(date)],
    })
  }

  function buildUpcomingList(): UpcomingListItem[] {
    const items: UpcomingListItem[] = []
    steps.forEach((s) => {
      const key = getStepDateKey(s)
      if (key && key >= todayKey) items.push({ dateKey: key, type: 'step', step: s })
    })
    bids.forEach((b) => {
      const key = b.bid_due_date.slice(0, 10)
      if (key >= todayKey) items.push({ dateKey: key, type: 'bid', bid: b })
    })
    prospectCallbacks.forEach((cb) => {
      const key = getCentralDateFromUTC(cb.callback_date)
      if (key && key >= todayKey) items.push({ dateKey: key, type: 'callback', callback: cb })
    })
    if (isSalaryLayerEligible) {
      timeOffRows.forEach((r) => {
        if (r.end_date >= todayKey) items.push({ dateKey: r.start_date, type: 'time_off', timeOff: r })
      })
      Object.values(salaryOverridesByDate).forEach((ov) => {
        const key = ov.work_date
        if (key >= todayKey && (ov.mode != null || ov.segment_a_start_local != null)) {
          items.push({ dateKey: key, type: 'salary_override', workDate: key })
        }
      })
    }
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              {isSalaryLayerEligible ? (
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}
                  title="Scheduled (green) hours show from tomorrow onward only. Unpaid time off appears on all days. Use recorded time for past days."
                >
                  <input
                    type="checkbox"
                    checked={showMyWorkday}
                    onChange={(e) => {
                      const on = e.target.checked
                      setShowMyWorkday(on)
                      if (authUser?.id) {
                        try {
                          localStorage.setItem(`calendar_show_my_workday_${authUser.id}`, String(on))
                        } catch {
                          /* ignore */
                        }
                      }
                    }}
                  />
                  Show my workday
                </label>
              ) : null}
              {authUser?.id ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={showRecordedTime}
                    onChange={(e) => {
                      const on = e.target.checked
                      setShowRecordedTime(on)
                      if (authUser?.id) {
                        try {
                          localStorage.setItem(`calendar_show_recorded_time_${authUser.id}`, String(on))
                        } catch {
                          /* ignore */
                        }
                      }
                    }}
                  />
                  Show recorded time
                </label>
              ) : null}
              <button type="button" onClick={today} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>
                Today
              </button>
            </div>
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
              const dayCallbacks = getCallbacksForDate(day)
              const isToday = formatDateKey(day) === todayKey && isCurrentMonth
              const isCurrentMonthDay = day.getMonth() === currentMonth.getMonth()
              return (
                <div
                  key={idx}
                  className="calendar-grid-day"
                  role="button"
                  tabIndex={0}
                  aria-label={calendarGridDayAriaLabel(day)}
                  onClick={() => setSelectedDayForModal(day)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDayForModal(day) } }}
                  style={{
                    height: 120,
                    minHeight: 120,
                    maxHeight: 120,
                    padding: '0.5rem',
                    border: isToday ? `2px solid ${CALENDAR_DAY_ACCENT}` : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.875rem',
                      color: isCurrentMonthDay ? CALENDAR_DAY_NUMERAL : '#9ca3af',
                      fontWeight: isToday ? 600 : 400,
                      marginBottom: '0.25rem',
                      flexShrink: 0,
                    }}
                  >
                    {day.getDate()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'auto', flex: 1, minHeight: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {daySteps.map((step) => (
                      <Link
                        key={step.id}
                        to={`/workflows/${step.project_id}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 4px',
                          background: step.status === 'completed' || step.status === 'approved' ? '#f0fdf4' : step.status === 'skipped' ? '#f3f4f6' : step.status === 'rejected' ? '#fef2f2' : CALENDAR_DAY_HOVER_BG,
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
                    {dayBids.map((bid) => {
                      const status = getBidSubmissionStatus(bid)
                      return (
                      <Link
                        key={bid.id}
                        to={`/bids?bidId=${bid.id}&tab=submission-followup`}
                        onClick={(e) => e.stopPropagation()}
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
                        title={`Bid due: ${bid.project_name}${bid.service_type_name ? ` (${bid.service_type_name})` : ''} — ${status}`}
                      >
                        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Bid due: {bid.project_name}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#b45309', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                          {bid.service_type_name ? (
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bid.service_type_name}</span>
                          ) : (
                            <span />
                          )}
                          <span style={{ flexShrink: 0, fontStyle: 'italic', color: getBidSubmissionStatusColor(status) }}>
                            [{status}]
                          </span>
                        </div>
                      </Link>
                    )})}
                    {dayCallbacks.map((cb) => (
                      <Link
                        key={cb.id}
                        to={`/prospects?tab=follow-up&prospect_id=${cb.prospect_id}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 4px',
                          background: '#e0e7ff',
                          color: '#3730a3',
                          textDecoration: 'none',
                          borderRadius: 3,
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                        title={cb.title ?? 'Prospect callback'}
                      >
                        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cb.title ?? 'Call back'}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#4f46e5' }}>Prospect</div>
                      </Link>
                    ))}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                        marginTop: 'auto',
                        flexShrink: 0,
                      }}
                    >
                    {showMyWorkday &&
                      isSalaryLayerEligible &&
                      (() => {
                        const wd = getWorkdayResolutionForDate(day)
                        if (wd.kind === 'none') return null
                        if (wd.kind === 'time_off') {
                          return (
                            <Link
                              key="workday-timeoff"
                              to="/settings#settings-time-off"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                fontSize: '0.75rem',
                                padding: '2px 4px',
                                background: '#f3e8ff',
                                color: '#6b21a8',
                                textDecoration: 'none',
                                borderRadius: 3,
                                overflow: 'hidden',
                                fontWeight: 500,
                              }}
                              title={wd.note ?? wd.kindLabel}
                            >
                              {wd.kindLabel}
                            </Link>
                          )
                        }
                        const dayKey = formatDateKey(day)
                        if (!showScheduledSalaryProjectionForYmd(dayKey, todayKey)) return null
                        return wd.blocks.map((b, idx) => (
                          <Link
                            key={`workday-${wd.source}-${idx}`}
                            to="/settings#settings-salary-workday"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              fontSize: '0.75rem',
                              padding: '2px 4px',
                              background: '#ecfdf5',
                              color: '#065f46',
                              textDecoration: 'none',
                              borderRadius: 3,
                              overflow: 'hidden',
                              fontWeight: 500,
                            }}
                            title={`Workday (${wd.source})${b.segmentIndex ? ` · block ${b.segmentIndex}` : ''}`}
                          >
                            {b.label}
                          </Link>
                        ))
                      })()}
                    {(() => {
                      const dk = formatDateKey(day)
                      const ncns = ncnsByWorkDate.get(dk)
                      return ncns ? (
                        <span
                          key="ncns-chip"
                          role="note"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            fontSize: '0.75rem',
                            padding: '2px 4px',
                            background: '#fff7ed',
                            color: '#9a3412',
                            borderRadius: 3,
                            fontWeight: 600,
                            border: '1px solid #fdba74',
                          }}
                          title={ncnsCalendarChipTitle(ncns)}
                        >
                          NCNS
                        </span>
                      ) : null
                    })()}
                    {showRecordedTime
                      ? (() => {
                          const dk = formatDateKey(day)
                          const rec = recordedByWorkDate[dk]
                          if (!calendarRecordedHasVisibleSummary(rec)) return null
                          const { text, title } = formatCalendarRecordedLine(rec)
                          return (
                            <span
                              key="recorded-chip"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                fontSize: '0.6875rem',
                                padding: '2px 4px',
                                color: '#4b5563',
                                borderRadius: 3,
                                fontWeight: 500,
                              }}
                              title={title}
                            >
                              {text}
                            </span>
                          )
                        })()
                      : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {selectedDayForModal && (() => {
            const modalSteps = getStepsForDate(selectedDayForModal)
            const modalBids = getBidsForDate(selectedDayForModal)
            const modalCallbacks = getCallbacksForDate(selectedDayForModal)
            const modalWorkday = showMyWorkday && isSalaryLayerEligible ? getWorkdayResolutionForDate(selectedDayForModal) : { kind: 'none' as const }
            const modalDateStr = formatUpcomingDate(formatDateKey(selectedDayForModal))
            const modalDayKey = formatDateKey(selectedDayForModal)
            const showModalScheduled = showScheduledSalaryProjectionForYmd(modalDayKey, todayKey)
            const modalHasVisibleSalarySection =
              modalWorkday.kind === 'time_off' ||
              (modalWorkday.kind === 'scheduled' && showModalScheduled)
            const modalNcns = ncnsByWorkDate.get(modalDayKey)
            const modalRec = recordedByWorkDate[modalDayKey]
            const modalRecordedVisible = calendarRecordedHasVisibleSummary(modalRec)
            const modalRecordedFmt = formatCalendarRecordedLine(modalRec)
            const hasItems =
              modalSteps.length > 0 ||
              modalBids.length > 0 ||
              modalCallbacks.length > 0 ||
              modalHasVisibleSalarySection ||
              modalNcns != null ||
              (showRecordedTime && modalRecordedVisible)
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
                      {modalWorkday.kind === 'time_off' && (
                        <li style={{ marginBottom: '0.5rem' }}>
                          <Link
                            to="/settings#settings-time-off"
                            onClick={() => setSelectedDayForModal(null)}
                            style={{
                              display: 'block',
                              padding: '0.5rem 0.75rem',
                              background: '#f3e8ff',
                              color: '#6b21a8',
                              textDecoration: 'none',
                              borderRadius: 4,
                              border: '1px solid #e9d5ff',
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>{modalWorkday.kindLabel}</div>
                            {modalWorkday.note ? <div style={{ fontSize: '0.875rem', marginTop: 4 }}>{modalWorkday.note}</div> : null}
                            <div style={{ fontSize: '0.8125rem', marginTop: 4, color: '#7c3aed' }}>Unpaid time off — Settings</div>
                          </Link>
                        </li>
                      )}
                      {modalWorkday.kind === 'scheduled' && showModalScheduled && (
                        <li style={{ marginBottom: '0.5rem' }}>
                          <Link
                            to="/settings#settings-salary-workday"
                            onClick={() => setSelectedDayForModal(null)}
                            style={{
                              display: 'block',
                              padding: '0.5rem 0.75rem',
                              background: '#ecfdf5',
                              color: '#065f46',
                              textDecoration: 'none',
                              borderRadius: 4,
                              border: '1px solid #a7f3d0',
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>Workday ({modalWorkday.source})</div>
                            <div style={{ fontSize: '0.875rem', marginTop: 4 }}>
                              {modalWorkday.blocks.map((b) => b.label).join(' · ')}
                            </div>
                          </Link>
                        </li>
                      )}
                      {modalNcns ? (
                        <li style={{ marginBottom: '0.5rem' }}>
                          <div
                            style={{
                              display: 'block',
                              padding: '0.5rem 0.75rem',
                              background: '#fff7ed',
                              color: '#9a3412',
                              borderRadius: 4,
                              border: '1px solid #fdba74',
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>No-call, no-show</div>
                            <div style={{ fontSize: '0.875rem', marginTop: 4 }}>
                              Logged {new Date(modalNcns.created_at).toLocaleString()}
                            </div>
                            {modalNcns.details?.trim() ? (
                              <div style={{ fontSize: '0.875rem', marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {modalNcns.details}
                              </div>
                            ) : null}
                          </div>
                        </li>
                      ) : null}
                      {showRecordedTime && modalRecordedVisible ? (
                        <li style={{ marginBottom: '0.5rem' }}>
                          <div
                            style={{
                              display: 'block',
                              padding: '0.5rem 0.75rem',
                              background: '#f9fafb',
                              color: '#374151',
                              borderRadius: 4,
                              border: '1px solid #e5e7eb',
                            }}
                            title={modalRecordedFmt.title}
                          >
                            <div style={{ fontWeight: 600 }}>Recorded time</div>
                            <div style={{ fontSize: '0.875rem', marginTop: 4 }}>{modalRecordedFmt.text}</div>
                          </div>
                        </li>
                      ) : null}
                      {modalSteps.map((step) => (
                        <li key={step.id} style={{ marginBottom: '0.5rem' }}>
                          <Link
                            to={`/workflows/${step.project_id}`}
                            onClick={() => setSelectedDayForModal(null)}
                            style={{
                              display: 'block',
                              padding: '0.5rem 0.75rem',
                              background: step.status === 'completed' || step.status === 'approved' ? '#f0fdf4' : step.status === 'skipped' ? '#f3f4f6' : step.status === 'rejected' ? '#fef2f2' : CALENDAR_DAY_HOVER_BG,
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
                      {modalBids.map((bid) => {
                        const status = getBidSubmissionStatus(bid)
                        return (
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', color: '#b45309' }}>
                              {bid.service_type_name ? <span>{bid.service_type_name}</span> : <span />}
                              <span style={{ fontStyle: 'italic', color: getBidSubmissionStatusColor(status) }}>[{status}]</span>
                            </div>
                          </Link>
                        </li>
                      )})}
                      {modalCallbacks.map((cb) => (
                        <li key={cb.id} style={{ marginBottom: '0.5rem' }}>
                          <Link
                            to={`/prospects?tab=follow-up&prospect_id=${cb.prospect_id}`}
                            onClick={() => setSelectedDayForModal(null)}
                            style={{
                              display: 'block',
                              padding: '0.5rem 0.75rem',
                              background: '#e0e7ff',
                              color: '#3730a3',
                              textDecoration: 'none',
                              borderRadius: 4,
                              border: '1px solid #c7d2fe',
                            }}
                          >
                            <div style={{ fontWeight: 500 }}>{cb.title ?? 'Prospect callback'}</div>
                            <div style={{ fontSize: '0.875rem', color: '#4f46e5' }}>Prospect — Follow Up</div>
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
                  <li
                    key={
                      item.type === 'step'
                        ? `s-${item.step.id}`
                        : item.type === 'bid'
                          ? `b-${item.bid.id}`
                          : item.type === 'callback'
                            ? `c-${item.callback.id}`
                            : item.type === 'time_off'
                              ? `timeoff-${item.timeOff.id}`
                              : `ov-${item.workDate}`
                    }
                    style={{ marginBottom: '0.5rem' }}
                  >
                    {item.type === 'step' && item.step ? (
                      <Link
                        to={`/workflows/${item.step.project_id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          padding: '0.5rem 0.75rem',
                          background: item.step.status === 'completed' || item.step.status === 'approved' ? '#f0fdf4' : item.step.status === 'skipped' ? '#f3f4f6' : item.step.status === 'rejected' ? '#fef2f2' : CALENDAR_DAY_HOVER_BG,
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
                        <span style={{ fontSize: '0.875rem', fontStyle: 'italic', marginLeft: 'auto', color: getBidSubmissionStatusColor(getBidSubmissionStatus(item.bid)) }}>
                          [{getBidSubmissionStatus(item.bid)}]
                        </span>
                      </Link>
                    ) : item.type === 'callback' && item.callback ? (
                      <Link
                        to={`/prospects?tab=follow-up&prospect_id=${item.callback.prospect_id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          padding: '0.5rem 0.75rem',
                          background: '#e0e7ff',
                          color: '#3730a3',
                          textDecoration: 'none',
                          borderRadius: 4,
                          border: '1px solid #c7d2fe',
                        }}
                      >
                        <span style={{ fontSize: '0.875rem', color: '#4f46e5', minWidth: 120 }}>
                          {formatUpcomingDate(item.dateKey)}
                        </span>
                        <span style={{ fontWeight: 500 }}>{item.callback.title ?? 'Prospect callback'}</span>
                        <span style={{ fontSize: '0.875rem', color: '#4f46e5' }}>— Follow Up</span>
                      </Link>
                    ) : item.type === 'time_off' ? (
                      <Link
                        to="/settings#settings-time-off"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          padding: '0.5rem 0.75rem',
                          background: '#f3e8ff',
                          color: '#6b21a8',
                          textDecoration: 'none',
                          borderRadius: 4,
                          border: '1px solid #e9d5ff',
                        }}
                      >
                        <span style={{ fontSize: '0.875rem', color: '#7c3aed', minWidth: 120 }}>
                          {formatUpcomingDate(item.timeOff.start_date)} – {formatUpcomingDate(item.timeOff.end_date)}
                        </span>
                        <span style={{ fontWeight: 500 }}>
                          {UNPAID_TIME_OFF_LABEL}
                          {item.timeOff.note ? ` — ${item.timeOff.note}` : ''}
                        </span>
                      </Link>
                    ) : item.type === 'salary_override' ? (
                      <Link
                        to="/settings#settings-salary-workday"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          padding: '0.5rem 0.75rem',
                          background: '#ecfdf5',
                          color: '#065f46',
                          textDecoration: 'none',
                          borderRadius: 4,
                          border: '1px solid #a7f3d0',
                        }}
                      >
                        <span style={{ fontSize: '0.875rem', color: '#047857', minWidth: 120 }}>
                          {formatUpcomingDate(item.workDate)}
                        </span>
                        <span style={{ fontWeight: 500 }}>Custom workday schedule</span>
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
