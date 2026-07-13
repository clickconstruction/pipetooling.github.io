import { useEffect, useMemo, useRef, useState } from 'react'
import type { PayConfigRow as PayConfigRowFull } from '../../types/peoplePayConfig'
import { effectiveHoursForDisplay, canEditRecordedHours } from '../../lib/salariedEffectiveHours'
import { Link } from 'react-router-dom'
import { CLOCK_SESSION_LIST_SELECT } from '../../lib/clockSessionSelect'
import { approveClockSessions } from '../../lib/approveClockSessions'
import { supabase } from '../../lib/supabase'
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel'
import { HOURS_GRID_FIRST_COL_LABEL } from '../../constants/hoursGridFirstCol'
import { useAuth } from '../../hooks/useAuth'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { useHoursGridFirstColWidthPx } from '../../hooks/useHoursGridFirstColWidthPx'
import { HoursUnassignedModal } from '../HoursUnassignedModal'
import { PeopleHoursDayAuditModal } from '../PeopleHoursDayAuditModal'
import {
  AssignSessionJobPopover,
  ClockSessionsTable,
  ClockSessionsSection,
  formatClockSessionJobOrBidLabel,
} from '../clock-sessions'
import type { ClockSessionRow } from '../../types/clockSessions'
import { mergeToUnified, type UnifiedAssignment } from '../../utils/crewAssignments'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'

/** Narrow view of the canonical pay-config row (single source of truth for field types). */
type PayConfigRow = Pick<PayConfigRowFull, 'person_name' | 'hourly_wage' | 'is_salary' | 'show_in_hours' | 'show_in_cost_matrix' | 'record_hours_but_salary'>
type HoursRow = { person_name: string; work_date: string; hours: number }
type CrewRow = { unifiedAssignments: UnifiedAssignment[] }

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = []
  const d = new Date(start + 'T12:00:00')
  const endD = new Date(end + 'T12:00:00')
  while (d <= endD) {
    days.push(d.toLocaleDateString('en-CA'))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function decimalToHms(decimal: number): string {
  if (!decimal || decimal <= 0) return ''
  const h = Math.floor(decimal)
  const m = Math.floor((decimal - h) * 60)
  const s = Math.round(((decimal - h) * 60 - m) * 60)
  if (s > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${h}:${String(m).padStart(2, '0')}:00`
}

function hmsToDecimal(str: string): number {
  const trimmed = str.trim()
  if (!trimmed) return 0
  // "8.5" (one digit after dot) = 8.5 decimal hours. "8.30" (two digits, ≤59) = 8:30.
  if (!trimmed.includes(':') && /^\d+\.(\d+)$/.test(trimmed)) {
    const m = trimmed.match(/^\d+\.(\d+)$/)!
    const frac = m[1]!
    if (frac.length === 1) return parseFloat(trimmed) // 8.5 → 8.5 hrs
    if (parseInt(frac, 10) > 59) return parseFloat(trimmed) // 8.75 → 8.75 hrs
  }
  const normalized = trimmed.replace(/\./g, ':').replace(/\s+/g, ':')
  const parts = normalized.split(':').map((p) => parseInt(p, 10) || 0)
  const [h = 0, m = 0, s = 0] = parts
  return h + m / 60 + s / 3600
}

export function HoursSection() {
  const { user: authUser } = useAuth()
  const prefixMap = useLedgerPrefixMap()
  const [canAccessHours, setCanAccessHours] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payConfig, setPayConfig] = useState<Record<string, PayConfigRow>>({})
  const [peopleHours, setPeopleHours] = useState<HoursRow[]>([])
  const [hoursDisplayOrder, setHoursDisplayOrder] = useState<Record<string, number>>({})
  const [hoursDateStart, setHoursDateStart] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day)
    return start.toLocaleDateString('en-CA')
  })
  const [hoursDateEnd, setHoursDateEnd] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day + 6)
    return start.toLocaleDateString('en-CA')
  })
  const [editingHoursCell, setEditingHoursCell] = useState<{ personName: string; workDate: string } | null>(null)
  const [editingHoursValue, setEditingHoursValue] = useState('')
  const [hoursDaysCorrect, setHoursDaysCorrect] = useState<Set<string>>(new Set())
  const [crewJobsByDatePerson, setCrewJobsByDatePerson] = useState<Record<string, CrewRow>>({})
  const [hoursUnassignedModal, setHoursUnassignedModal] = useState<{ personName: string } | null>(null)
  const [hoursDayAuditModal, setHoursDayAuditModal] = useState<{ personName: string; workDate: string } | null>(null)
  const [pendingClockSessions, setPendingClockSessions] = useState<ClockSessionRow[]>([])
  const [approvedClockSessions, setApprovedClockSessions] = useState<ClockSessionRow[]>([])

  const { widthPx: hoursGridFirstColWidthPx, measurer: hoursGridFirstColMeasurer } = useHoursGridFirstColWidthPx()
  const hoursGridFirstColW = hoursGridFirstColWidthPx ?? 200

  const canEditCrewJobs = canAccessHours

  const loadPeopleHoursRef = useRef<() => void>()
  loadPeopleHoursRef.current = () => loadPeopleHours(hoursDateStart, hoursDateEnd)
  const loadHoursDaysCorrectRef = useRef<() => void>()
  loadHoursDaysCorrectRef.current = () => loadHoursDaysCorrect(hoursDateStart, hoursDateEnd)
  const loadCrewJobsRef = useRef<() => void>()
  loadCrewJobsRef.current = () => loadCrewJobsForDateRange(hoursDateStart, hoursDateEnd)
  const loadAllClockSessionsRef = useRef<() => void>()
  loadAllClockSessionsRef.current = () => {
    loadPendingClockSessions(hoursDateStart, hoursDateEnd)
    loadApprovedClockSessions(hoursDateStart, hoursDateEnd)
  }

  async function loadPendingClockSessions(start: string, end: string) {
    if (!canAccessHours) return
    const { data, error } = await supabase
      .from('clock_sessions')
      .select(CLOCK_SESSION_LIST_SELECT)
      .is('approved_at', null)
      .is('rejected_at', null)
      .gte('work_date', start)
      .lte('work_date', end)
      .order('work_date', { ascending: false })
      .order('clocked_in_at', { ascending: false })
    if (error) {
      setError(error.message)
      return
    }
    setPendingClockSessions((data ?? []) as unknown as ClockSessionRow[])
  }

  async function loadApprovedClockSessions(start: string, end: string) {
    if (!canAccessHours) return
    const { data, error } = await supabase
      .from('clock_sessions')
      .select(CLOCK_SESSION_LIST_SELECT)
      .not('approved_at', 'is', null)
      .gte('work_date', start)
      .lte('work_date', end)
      .order('work_date', { ascending: false })
      .order('clocked_in_at', { ascending: false })
    if (error) {
      setError(error.message)
      return
    }
    setApprovedClockSessions((data ?? []) as unknown as ClockSessionRow[])
  }

  async function loadPayAccess() {
    if (!authUser?.id) return
    const [meRes, approvedRes] = await Promise.all([
      supabase.from('users').select('role').eq('id', authUser.id).single(),
      supabase.from('pay_approved_masters').select('master_id'),
    ])
    const role = (meRes.data as { role?: string } | null)?.role ?? null
    const approvedIds = new Set((approvedRes.data ?? []).map((r: { master_id: string }) => r.master_id))
    if (role === 'dev') {
      setCanAccessHours(true)
      return
    }
    if (role === 'assistant') {
      setCanAccessHours(true)
      return
    }
    if (role === 'master_technician' && approvedIds.has(authUser.id)) {
      setCanAccessHours(true)
    }
  }

  async function loadPayConfig() {
    const { data, error: err } = await supabase.from('people_pay_config').select('person_name, hourly_wage, is_salary, show_in_hours, show_in_cost_matrix, record_hours_but_salary')
    if (err) {
      setError(err.message)
      return
    }
    const map: Record<string, PayConfigRow> = {}
    for (const r of (data ?? []) as PayConfigRow[]) {
      map[r.person_name] = r
    }
    setPayConfig(map)
  }

  async function loadPeopleHours(start: string, end: string) {
    const { data, error: err } = await supabase
      .from('people_hours')
      .select('person_name, work_date, hours')
      .gte('work_date', start)
      .lte('work_date', end)
    if (err) {
      setError(err.message)
      return
    }
    setPeopleHours((data ?? []) as HoursRow[])
  }

  async function loadHoursDisplayOrder() {
    const { data } = await supabase.from('people_hours_display_order').select('person_name, sequence_order')
    const map: Record<string, number> = {}
    for (const r of (data ?? []) as { person_name: string; sequence_order: number }[]) {
      map[r.person_name] = r.sequence_order
    }
    setHoursDisplayOrder(map)
  }

  async function loadHoursDaysCorrect(start: string, end: string) {
    if (!canAccessHours) return
    const { data, error } = await supabase.from('hours_days_correct').select('work_date').gte('work_date', start).lte('work_date', end)
    if (error) {
      setError(error.message)
      return
    }
    const days = getDaysInRange(start, end)
    setHoursDaysCorrect((prev) => {
      const next = new Set(prev)
      for (const d of days) next.delete(d)
      for (const r of (data ?? []) as { work_date: string }[]) next.add(r.work_date)
      return next
    })
  }

  async function loadCrewJobsForDateRange(start: string, end: string) {
    if (!canAccessHours) return
    const days = getDaysInRange(start, end)
    if (days.length === 0) return
    const [jobsRes, bidsRes] = await Promise.all([
      supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').in('work_date', days),
      supabase.from('people_crew_bids').select('work_date, person_name, bid_assignments').in('work_date', days),
    ])
    const jobsRows = (jobsRes.data ?? []) as Array<{
      work_date: string
      person_name: string
      job_assignments: Array<{ job_id: string; pct: number }>
    }>
    const bidsRows = (bidsRes.data ?? []) as Array<{
      work_date: string
      person_name: string
      bid_assignments: Array<{ bid_id: string; pct: number }>
    }>
    const jobsByKey: Record<string, Array<{ job_id: string; pct: number }>> = {}
    for (const r of jobsRows) {
      const k = `${r.work_date}:${r.person_name}`
      jobsByKey[k] = Array.isArray(r.job_assignments) ? r.job_assignments : []
    }
    const bidsByKey: Record<string, Array<{ bid_id: string; pct: number }>> = {}
    for (const r of bidsRows) {
      const k = `${r.work_date}:${r.person_name}`
      bidsByKey[k] = Array.isArray(r.bid_assignments) ? r.bid_assignments : []
    }
    const allKeys = new Set([...Object.keys(jobsByKey), ...Object.keys(bidsByKey)])
    const map: Record<string, CrewRow> = {}
    for (const k of allKeys) {
      const unified = mergeToUnified(jobsByKey[k] ?? [], bidsByKey[k] ?? [])
      map[k] = { unifiedAssignments: unified }
    }
    setCrewJobsByDatePerson(map)
  }

  async function toggleHoursDayCorrect(workDate: string) {
    if (!canAccessHours) return
    const isCorrect = hoursDaysCorrect.has(workDate)
    if (isCorrect) {
      const { error } = await supabase.from('hours_days_correct').delete().eq('work_date', workDate)
      if (error) setError(error.message)
      else setHoursDaysCorrect((prev) => { const next = new Set(prev); next.delete(workDate); return next })
    } else {
      const { error } = await supabase.from('hours_days_correct').insert({ work_date: workDate, marked_by: authUser?.id ?? null })
      if (error) setError(error.message)
      else setHoursDaysCorrect((prev) => { const next = new Set(prev); next.add(workDate); return next })
    }
  }

  async function moveHoursRow(personName: string, direction: 'up' | 'down') {
    const showPeople = Object.keys(payConfig)
      .filter((n) => payConfig[n]?.show_in_hours ?? false)
      .sort((a, b) => {
        const orderA = hoursDisplayOrder[a] ?? 999999
        const orderB = hoursDisplayOrder[b] ?? 999999
        return orderA !== orderB ? orderA - orderB : a.localeCompare(b)
      })
    const idx = showPeople.indexOf(personName)
    if (idx < 0) return
    const otherIdx = direction === 'up' ? idx - 1 : idx + 1
    if (otherIdx < 0 || otherIdx >= showPeople.length) return
    const otherName = showPeople[otherIdx]
    if (!otherName) return
    const newOrderA = otherIdx
    const newOrderB = idx
    setHoursDisplayOrder((prev) => ({
      ...prev,
      [personName]: newOrderA,
      [otherName]: newOrderB,
    }))
    await Promise.all([
      supabase.from('people_hours_display_order').upsert({ person_name: personName, sequence_order: newOrderA }, { onConflict: 'person_name' }),
      supabase.from('people_hours_display_order').upsert({ person_name: otherName, sequence_order: newOrderB }, { onConflict: 'person_name' }),
    ])
  }

  async function saveHours(personName: string, workDate: string, hours: number) {
    if (hoursDaysCorrect.has(workDate)) return
    setPeopleHours((prev) => {
      const rest = prev.filter((h) => !(h.person_name === personName && h.work_date === workDate))
      return [...rest, { person_name: personName, work_date: workDate, hours }]
    })
    const { error: err } = await supabase.from('people_hours').upsert(
      { person_name: personName, work_date: workDate, hours, entered_by: authUser?.id ?? null },
      { onConflict: 'person_name,work_date' }
    )
    if (err) setError(err.message)
  }

  function getHoursForPersonDate(personName: string, workDate: string): number {
    const row = peopleHours.find((h) => h.person_name === personName && h.work_date === workDate)
    return row?.hours ?? 0
  }

  function canEditHours(personName: string): boolean {
    return canEditRecordedHours(payConfig[personName])
  }

  /** Hours-surface display (record_hours_but_salary people show their logged hours). */
  function getDisplayHours(personName: string, workDate: string): number {
    return effectiveHoursForDisplay(payConfig[personName], workDate, getHoursForPersonDate(personName, workDate))
  }

  function shiftHoursWeek(delta: number) {
    const dStart = new Date(hoursDateStart + 'T12:00:00')
    const dEnd = new Date(hoursDateEnd + 'T12:00:00')
    dStart.setDate(dStart.getDate() + delta * 7)
    dEnd.setDate(dEnd.getDate() + delta * 7)
    setHoursDateStart(dStart.toLocaleDateString('en-CA'))
    setHoursDateEnd(dEnd.toLocaleDateString('en-CA'))
  }

  useEffect(() => {
    loadPayAccess()
  }, [authUser?.id])

  useEffect(() => {
    if (!canAccessHours) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      loadPayConfig(),
      loadPeopleHours(hoursDateStart, hoursDateEnd),
      loadHoursDisplayOrder(),
      loadHoursDaysCorrect(hoursDateStart, hoursDateEnd),
      loadCrewJobsForDateRange(hoursDateStart, hoursDateEnd),
      loadPendingClockSessions(hoursDateStart, hoursDateEnd),
      loadApprovedClockSessions(hoursDateStart, hoursDateEnd),
    ]).finally(() => setLoading(false))
  }, [canAccessHours, hoursDateStart, hoursDateEnd])

  const peopleHoursChannelFilters = useMemo(
    () => [
      { event: '*' as const, schema: 'public', table: 'people_hours' },
      { event: '*' as const, schema: 'public', table: 'hours_days_correct' },
      { event: '*' as const, schema: 'public', table: 'people_crew_jobs' },
      { event: '*' as const, schema: 'public', table: 'people_crew_bids' },
      { event: '*' as const, schema: 'public', table: 'clock_sessions' },
    ],
    [],
  )
  useRealtimeChannel(
    canAccessHours,
    'quickfill-people-hours-changes',
    peopleHoursChannelFilters,
    (event) => {
      switch (event.table) {
        case 'people_hours':
          loadPeopleHoursRef.current?.()
          break
        case 'hours_days_correct':
          loadHoursDaysCorrectRef.current?.()
          break
        case 'people_crew_jobs':
        case 'people_crew_bids':
          loadCrewJobsRef.current?.()
          break
        case 'clock_sessions':
          loadAllClockSessionsRef.current?.()
          break
      }
    },
    { debounceMs: 500 },
  )

  const showPeopleForHours = Object.keys(payConfig)
    .filter((n) => payConfig[n]?.show_in_hours ?? false)
    .sort((a, b) => {
      const orderA = hoursDisplayOrder[a] ?? 999999
      const orderB = hoursDisplayOrder[b] ?? 999999
      return orderA !== orderB ? orderA - orderB : a.localeCompare(b)
    })
  const hoursDays = getDaysInRange(hoursDateStart, hoursDateEnd)

  function hasAssignmentsForDate(personName: string, workDate: string): boolean {
    const key = `${workDate}:${personName}`
    const row = crewJobsByDatePerson[key]
    if (!row) return false
    return (row.unifiedAssignments?.length ?? 0) > 0
  }

  function isCorrectDayMissingJob(personName: string, workDate: string): boolean {
    if (!hoursDaysCorrect.has(workDate)) return false
    const hours = getDisplayHours(personName, workDate)
    if (hours <= 0) return false
    return !hasAssignmentsForDate(personName, workDate)
  }

  function hasUnassignedCorrectDays(personName: string): boolean {
    return hoursDays.some((d) => isCorrectDayMissingJob(personName, d))
  }

  useReportQuickfillSectionMetric(
    'hours',
    !canAccessHours || !authUser?.id ? null : loading ? null : pendingClockSessions.length,
    !!(canAccessHours && authUser?.id && loading),
  )

  if (!canAccessHours) {
    return (
      <section style={{ marginBottom: '2rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>You do not have access to the Hours tab.</p>
      </section>
    )
  }

  return (
    <section style={{ marginBottom: '2rem' }}>
      {hoursGridFirstColMeasurer}
      {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <label>
              <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Start</span>
              <input type="date" value={hoursDateStart} onChange={(e) => setHoursDateStart(e.target.value)} style={{ padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
            </label>
            <label>
              <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>End</span>
              <input type="date" value={hoursDateEnd} onChange={(e) => setHoursDateEnd(e.target.value)} style={{ padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
            </label>
            <button type="button" onClick={() => shiftHoursWeek(-1)} style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', fontSize: '0.875rem' }}>← last week</button>
            <button type="button" onClick={() => shiftHoursWeek(1)} style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', fontSize: '0.875rem' }}>next week →</button>
          </div>
          <div style={{ marginBottom: '1rem', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-subtle)', fontWeight: 600, fontSize: '0.875rem' }}>
              Pending clock sessions ({pendingClockSessions.length})
            </div>
            <ClockSessionsTable
              sessions={pendingClockSessions}
              showActionsColumn
              locationVariant="full"
              emptyMessage="No pending sessions"
              renderNotesSecondary={(s) => {
                const label = formatClockSessionJobOrBidLabel(s, prefixMap)
                return label ? <span title={label}>{label}</span> : null
              }}
              renderJob={(s) => {
                const isActive = s.clocked_out_at == null
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'nowrap', minWidth: 0 }}>
                    {!isActive && (
                      <span style={{ flexShrink: 0 }}>
                        <AssignSessionJobPopover
                          session={s}
                          onSaved={() => {
                            loadAllClockSessionsRef.current?.()
                            loadPeopleHoursRef.current?.()
                          }}
                          onError={(msg) => setError(msg)}
                          dispatchScheduleAssigneeUserId={s.user_id}
                          dispatchScheduleWorkDateYmd={s.work_date}
                        />
                      </span>
                    )}
                  </div>
                )
              }}
              renderActions={(s) => {
                const personName = s.users?.name?.trim() ?? 'Unknown'
                const isActive = s.clocked_out_at == null
                return (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {isActive && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Force clock out ${personName}?`)) return
                          const now = new Date().toISOString()
                          const { error } = await supabase.from('clock_sessions').update({ clocked_out_at: now }).eq('id', s.id)
                          if (error) setError(error.message)
                          else loadAllClockSessionsRef.current?.()
                        }}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #dc2626', borderRadius: 4, background: 'var(--bg-red-tint)', color: 'var(--text-red-600)', cursor: 'pointer' }}
                      >
                        Force clock out
                      </button>
                    )}
                    {!isActive && (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            const { data, error } = await approveClockSessions([s.id])
                            if (error) { setError(error.message); return }
                            const result = (data ?? []) as Array<{ approved_count: number; error_message: string | null }>
                            const row = result[0]
                            if (row?.error_message) { setError(row.error_message); return }
                            loadAllClockSessionsRef.current?.()
                            loadPeopleHoursRef.current?.()
                          }}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #22c55e', borderRadius: 4, background: 'var(--bg-green-tint)', color: '#16a34a', cursor: 'pointer' }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm('Reject this clock session?')) return
                            const { error } = await supabase.from('clock_sessions').update({ rejected_at: new Date().toISOString(), rejected_by: authUser?.id ?? null }).eq('id', s.id)
                            if (error) setError(error.message)
                            else loadAllClockSessionsRef.current?.()
                          }}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #dc2626', borderRadius: 4, background: 'var(--bg-red-tint)', color: 'var(--text-red-600)', cursor: 'pointer' }}
                        >
                          Reject
                        </button>
                        <Link
                          to="/people?tab=hours"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', textDecoration: 'none' }}
                        >
                          Edit
                        </Link>
                      </>
                    )}
                  </div>
                )
              }}
            />
          </div>
          <ClockSessionsSection
            title="Approved Sessions"
            sessions={approvedClockSessions}
            collapsedByDefault
            showActionsColumn
            renderActions={(s) => (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm('Revoke this session? It will move back to Pending and remove its hours from Hours.')) return
                  const { data, error } = await supabase.rpc('revoke_clock_sessions', { p_session_ids: [s.id] })
                  if (error) { setError(error.message); return }
                  const result = (data ?? []) as Array<{ revoked_count: number; error_message: string | null }>
                  const row = result[0]
                  if (row?.error_message) { setError(row.error_message); return }
                  loadAllClockSessionsRef.current?.()
                  loadPeopleHoursRef.current?.()
                }}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #f59e0b', borderRadius: 4, background: 'var(--bg-amber-tint)', color: '#d97706', cursor: 'pointer' }}
              >
                Revoke
              </button>
            )}
          />
          {showPeopleForHours.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No people with Show in Hours selected. Go to People → Hours and open People pay config; check Show in Hours for people to track.</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: hoursGridFirstColW }} />
                  {hoursDays.map((d) => (
                    <col key={d} style={{ width: 72 }} />
                  ))}
                  <col style={{ width: 90 }} />
                  <col style={{ width: 90 }} />
                </colgroup>
                <thead style={{ background: 'var(--bg-subtle)' }}>
                  <tr>
                    <th
                      style={{
                        padding: '0.5rem 0.75rem',
                        textAlign: 'left',
                        borderBottom: '1px solid var(--border)',
                        position: 'sticky',
                        left: 0,
                        zIndex: 3,
                        background: 'var(--bg-subtle)',
                        boxShadow: '4px 0 8px -4px rgba(0, 0, 0, 0.08)',
                        maxWidth: hoursGridFirstColW,
                        minWidth: 0,
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                      }}
                    >
                      Person
                    </th>
                    {hoursDays.map((d) => (
                      <th key={d} style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                        {new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })}
                      </th>
                    ))}
                    <th style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>HH:MM:SS</th>
                    <th style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Decimal</th>
                  </tr>
                </thead>
                <tbody>
                  {showPeopleForHours.map((personName, idx) => {
                    const isUnassigned = hasUnassignedCorrectDays(personName)
                    return (
                      <tr
                        key={personName}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          ...(isUnassigned && canEditCrewJobs && { cursor: 'pointer' }),
                        }}
                        title={isUnassigned ? (canEditCrewJobs ? 'Click to assign jobs or bids' : 'Assign jobs or bids in Crew Jobs / Bids section above') : undefined}
                        {...(isUnassigned && canEditCrewJobs && {
                          role: 'button',
                          tabIndex: 0,
                          onClick: (e: React.MouseEvent) => {
                            if ((e.target as HTMLElement).closest('input, button, label')) return
                            setHoursUnassignedModal({ personName })
                          },
                          onKeyDown: (e: React.KeyboardEvent) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setHoursUnassignedModal({ personName })
                            }
                          },
                        })}
                      >
                        <td
                          style={{
                            padding: '0.5rem 0.75rem',
                            position: 'sticky',
                            left: 0,
                            zIndex: 2,
                            background: 'var(--surface)',
                            boxShadow: '4px 0 8px -4px rgba(0, 0, 0, 0.08)',
                            maxWidth: hoursGridFirstColW,
                            minWidth: 0,
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                            <span style={{ display: 'flex', flexDirection: 'row', gap: 0, marginRight: '0.25rem', flexShrink: 0 }}>
                              <button type="button" onClick={() => moveHoursRow(personName, 'up')} disabled={idx === 0} title="Move up" style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? 'var(--text-faint-300)' : 'var(--text-muted)', lineHeight: 1 }}>▲</button>
                              <button type="button" onClick={() => moveHoursRow(personName, 'down')} disabled={idx === showPeopleForHours.length - 1} title="Move down" style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: idx === showPeopleForHours.length - 1 ? 'not-allowed' : 'pointer', color: idx === showPeopleForHours.length - 1 ? 'var(--text-faint-300)' : 'var(--text-muted)', lineHeight: 1 }}>▼</button>
                            </span>
                            <span style={{ minWidth: 0 }}>{personName}</span>
                          </div>
                        </td>
                        {hoursDays.map((d) => {
                          const dayLocked = hoursDaysCorrect.has(d)
                          const canEdit = canEditHours(personName)
                          const missingJob = isCorrectDayMissingJob(personName, d)
                          const missingJobTitle = 'Correct day with hours but no job assignment — assign in Crew Jobs / Bids'
                          return (
                            <td
                              key={d}
                              title={missingJob ? missingJobTitle : undefined}
                              style={{
                                padding: '0.35rem 0.5rem',
                                textAlign: canEdit ? 'right' : 'center',
                                ...(missingJob && {
                                  background: 'rgba(254, 242, 242, 0.9)',
                                  boxShadow: 'inset 0 0 0 1px rgba(252, 165, 165, 0.45)',
                                  borderRadius: 8,
                                }),
                              }}
                            >
                              {!canEdit ? (
                                <span style={{ color: 'var(--text-muted)' }}>{decimalToHms(getDisplayHours(personName, d)) || '-'}</span>
                              ) : dayLocked ? (
                                canEdit ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setHoursDayAuditModal({ personName, workDate: d })
                                    }}
                                    title="Day marked Correct — click to view clock sessions and job assignments"
                                    style={{
                                      color: 'var(--text-muted)',
                                      cursor: 'pointer',
                                      width: '100%',
                                      textAlign: 'right',
                                      padding: '0.15rem 0',
                                      border: 'none',
                                      background: 'none',
                                      font: 'inherit',
                                    }}
                                  >
                                    {decimalToHms(getDisplayHours(personName, d)) || '-'}
                                  </button>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }} title="Day marked Correct — locked">
                                    {decimalToHms(getDisplayHours(personName, d)) || '-'}
                                  </span>
                                )
                              ) : (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={editingHoursCell?.personName === personName && editingHoursCell?.workDate === d ? editingHoursValue : decimalToHms(getHoursForPersonDate(personName, d))}
                                  placeholder="-"
                                  onFocus={(e) => {
                                    setEditingHoursCell({ personName, workDate: d })
                                    setEditingHoursValue(decimalToHms(getHoursForPersonDate(personName, d)) || '')
                                    e.target.select()
                                  }}
                                  onChange={(e) => setEditingHoursValue(e.target.value)}
                                  onBlur={() => {
                                    const v = hmsToDecimal(editingHoursValue)
                                    saveHours(personName, d, v)
                                    setEditingHoursCell(null)
                                  }}
                                  style={{ width: 72, padding: '0.25rem 0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'right' }}
                                />
                              )}
                            </td>
                          )
                        })}
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{decimalToHms(hoursDays.reduce((s, d) => s + getDisplayHours(personName, d), 0)) || '-'}</td>
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{(hoursDays.reduce((s, d) => s + getDisplayHours(personName, d), 0)).toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot style={{ background: 'var(--bg-subtle)', fontWeight: 600 }}>
                  {(() => {
                    const grandTotal = showPeopleForHours.reduce((s, p) => s + hoursDays.reduce((ds, d) => ds + getDisplayHours(p, d), 0), 0)
                    return (
                      <>
                        <tr>
                          <td
                            style={{
                              padding: '0.5rem 0.75rem',
                              borderTop: '1px solid var(--border)',
                              position: 'sticky',
                              left: 0,
                              zIndex: 2,
                              background: 'var(--bg-subtle)',
                              boxShadow: '4px 0 8px -4px rgba(0, 0, 0, 0.08)',
                            }}
                          >
                            {HOURS_GRID_FIRST_COL_LABEL}
                          </td>
                          {hoursDays.map((d) => {
                            const daySum = showPeopleForHours.reduce((s, p) => s + getDisplayHours(p, d), 0)
                            return (
                              <td key={d} style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderTop: '1px solid var(--border)' }}>
                                {decimalToHms(daySum) || '-'}
                              </td>
                            )
                          })}
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderTop: '1px solid var(--border)' }}>{decimalToHms(grandTotal) || '-'}</td>
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderTop: '1px solid var(--border)' }}>-</td>
                        </tr>
                        <tr>
                          <td
                            style={{
                              padding: '0.5rem 0.75rem',
                              borderTop: '1px solid var(--border)',
                              position: 'sticky',
                              left: 0,
                              zIndex: 2,
                              background: 'var(--bg-subtle)',
                              boxShadow: '4px 0 8px -4px rgba(0, 0, 0, 0.08)',
                            }}
                          >
                            Total (Decimal):
                          </td>
                          {hoursDays.map((d) => {
                            const daySum = showPeopleForHours.reduce((s, p) => s + getDisplayHours(p, d), 0)
                            return (
                              <td key={d} style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderTop: '1px solid var(--border)' }}>
                                {daySum.toFixed(2)}
                              </td>
                            )
                          })}
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderTop: '1px solid var(--border)' }}>-</td>
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', borderTop: '1px solid var(--border)' }}>{grandTotal.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td
                            style={{
                              padding: '0.5rem 0.75rem',
                              borderTop: '1px solid var(--border)',
                              position: 'sticky',
                              left: 0,
                              zIndex: 2,
                              background: 'var(--bg-subtle)',
                              fontWeight: 500,
                              fontSize: '0.8125rem',
                              boxShadow: '4px 0 8px -4px rgba(0, 0, 0, 0.08)',
                            }}
                            title="Mark day as verified to lock from edits"
                          >
                            Correct:
                          </td>
                          {hoursDays.map((d) => {
                            const checked = hoursDaysCorrect.has(d)
                            return (
                              <td key={d} style={{ padding: '0.35rem 0.5rem', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title={checked ? 'Uncheck to allow edits' : 'Check to lock this day'}>
                                  <input type="checkbox" checked={checked} onChange={() => toggleHoursDayCorrect(d)} />
                                </label>
                              </td>
                            )
                          })}
                          <td colSpan={2} style={{ padding: '0.35rem 0.5rem', borderTop: '1px solid var(--border)' }} />
                        </tr>
                      </>
                    )
                  })()}
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {hoursUnassignedModal && canEditCrewJobs && (
        <HoursUnassignedModal
          personName={hoursUnassignedModal.personName}
          hoursDateStart={hoursDateStart}
          hoursDateEnd={hoursDateEnd}
          onClose={() => setHoursUnassignedModal(null)}
          onSaved={() => {
            loadCrewJobsRef.current?.()
            loadHoursDaysCorrectRef.current?.()
          }}
          canEditCrewJobs={canEditCrewJobs}
        />
      )}

      {hoursDayAuditModal && (
        <PeopleHoursDayAuditModal
          personName={hoursDayAuditModal.personName}
          workDate={hoursDayAuditModal.workDate}
          onClose={() => setHoursDayAuditModal(null)}
          initialCrewRow={crewJobsByDatePerson[`${hoursDayAuditModal.workDate}:${hoursDayAuditModal.personName}`] ?? null}
          canEditCrewJobs={canEditCrewJobs}
          crewJobsByDatePerson={crewJobsByDatePerson}
          hoursDateStart={hoursDateStart}
          hoursDateEnd={hoursDateEnd}
          onCrewSaved={() => {
            loadCrewJobsRef.current?.()
            loadHoursDaysCorrectRef.current?.()
          }}
        />
      )}
    </section>
  )
}
