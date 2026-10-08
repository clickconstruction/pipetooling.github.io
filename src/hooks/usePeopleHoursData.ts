import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { resolvePersonIdFromRosterName } from '../lib/payPersonSubject'
import { CLOCK_SESSION_LIST_SELECT } from '../lib/clockSessionSelect'
import type { ClockSessionRow } from '../types/clockSessions'
import type { Person } from './usePeopleRoster'

export type HoursRow = { person_name: string; person_id?: string | null; work_date: string; hours: number }

const PEOPLE_HOURS_CLOCK_REALTIME_DEBOUNCE_MS = 450

/** Behaviors the Realtime subscription fans out to (kept in the parent because its refresh refs are shared by ~20 clock-session mutator callbacks). */
export interface PeopleHoursRealtimeCallbacks {
  /** people_hours postgres_changes -> reload the hours grid (immediate). */
  onPeopleHoursChange: () => void
  /** clock_sessions postgres_changes -> reload the queues + draft-payroll (debounced + visibility-gated by the hook). */
  onClockSessionsChange: () => void
}

export interface UsePeopleHoursDataDeps {
  canAccessHours: boolean
  canAccessPay: boolean
  /** Live roster ref (people) for person-id resolution in saveHours. */
  peopleRosterRef: React.MutableRefObject<Person[]>
  authUser: { id: string } | null
  /** Live ref of locked ("days correct") work dates; saveHours is a no-op on those. */
  hoursDaysCorrectRef: React.MutableRefObject<Set<string>>
  setError: (msg: string) => void
  /** v2.839: surface the day-locked save guard instead of silently dropping the entry. */
  showToast: (text: string, variant: 'success' | 'error' | 'info' | 'warning') => void
  // --- Realtime subscription inputs ---
  activeTab: string
  hoursDateStart: string
  hoursDateEnd: string
  isDocVisible: boolean
  /** clock_sessions row filter (e.g. work_date in (...)); null = subscribe unfiltered. */
  peopleHoursClockRealtimeInFilter: string | null
  /** Stable ref to the parent's fan-out behaviors; read at event time so it is never in the effect deps. */
  realtimeCallbacksRef: React.MutableRefObject<PeopleHoursRealtimeCallbacks>
}

export interface UsePeopleHoursDataResult {
  peopleHours: HoursRow[]
  pendingClockSessions: ClockSessionRow[]
  approvedClockSessions: ClockSessionRow[]
  rejectedClockSessions: ClockSessionRow[]
  activeClockSessions: ClockSessionRow[]
  pendingApprovalClockSessions: ClockSessionRow[]
  /** The sessions section's search text. Its four filtered lists live in `PeopleHoursSessions`; the text stays here because the section unmounts while the tab loads (every week change). */
  hoursClockSessionsSearch: string
  setHoursClockSessionsSearch: React.Dispatch<React.SetStateAction<string>>
  loadPeopleHours: (start: string, end: string) => Promise<void>
  loadPendingClockSessions: (start: string, end: string) => Promise<void>
  loadApprovedClockSessions: (start: string, end: string) => Promise<void>
  loadRejectedClockSessions: (start: string, end: string) => Promise<void>
  loadAllClockSessions: (start: string, end: string) => void
  saveHours: (personName: string, workDate: string, hours: number) => Promise<void>
}

/**
 * Owns the People hours + clock-session data layer: `people_hours` + the pending/approved/rejected
 * `clock_sessions` queues, the sessions search text, their range loaders, and the optimistic
 * `saveHours` writer. Extracted from People.tsx (PR1). The live Realtime subscription is added in PR2.
 * Stays in the parent: `hoursReviewed`, `hoursDaysCorrect` (passed in via ref), draft-payroll, and the
 * clock-session approve/reject/split mutators (which refresh via these loaders).
 */
export function usePeopleHoursData(deps: UsePeopleHoursDataDeps): UsePeopleHoursDataResult {
  const {
    canAccessHours,
    canAccessPay,
    peopleRosterRef,
    authUser,
    hoursDaysCorrectRef,
    setError,
    showToast,
    activeTab,
    hoursDateStart,
    hoursDateEnd,
    isDocVisible,
    peopleHoursClockRealtimeInFilter,
    realtimeCallbacksRef,
  } = deps

  const [peopleHours, setPeopleHours] = useState<HoursRow[]>([])
  const [pendingClockSessions, setPendingClockSessions] = useState<ClockSessionRow[]>([])
  const activeClockSessions = useMemo(
    () => pendingClockSessions.filter((s) => s.clocked_out_at == null),
    [pendingClockSessions],
  )
  const pendingApprovalClockSessions = useMemo(
    () => pendingClockSessions.filter((s) => s.clocked_out_at != null),
    [pendingClockSessions],
  )
  const [approvedClockSessions, setApprovedClockSessions] = useState<ClockSessionRow[]>([])
  const [rejectedClockSessions, setRejectedClockSessions] = useState<ClockSessionRow[]>([])
  const [hoursClockSessionsSearch, setHoursClockSessionsSearch] = useState('')

  async function loadPeopleHours(start: string, end: string) {
    if (!canAccessHours && !canAccessPay) return
    const { data, error } = await supabase
      .from('people_hours')
      .select('person_name, person_id, work_date, hours')
      .gte('work_date', start)
      .lte('work_date', end)
    if (error) {
      setError(error.message)
      return
    }
    setPeopleHours((data ?? []) as HoursRow[])
  }

  async function loadPendingClockSessions(start: string, end: string) {
    if (!canAccessHours && !canAccessPay) return
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
    if (!canAccessHours && !canAccessPay) return
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

  async function loadRejectedClockSessions(start: string, end: string) {
    if (!canAccessHours && !canAccessPay) return
    const { data, error } = await supabase
      .from('clock_sessions')
      .select(CLOCK_SESSION_LIST_SELECT)
      .not('rejected_at', 'is', null)
      .gte('work_date', start)
      .lte('work_date', end)
      .order('work_date', { ascending: false })
      .order('clocked_in_at', { ascending: false })
    if (error) {
      setError(error.message)
      return
    }
    setRejectedClockSessions((data ?? []) as unknown as ClockSessionRow[])
  }

  function loadAllClockSessions(start: string, end: string) {
    void loadPendingClockSessions(start, end)
    void loadApprovedClockSessions(start, end)
    void loadRejectedClockSessions(start, end)
  }

  async function saveHours(personName: string, workDate: string, hours: number) {
    if (!canAccessHours && !canAccessPay) return
    if (hoursDaysCorrectRef.current.has(workDate)) {
      // v2.839: this guard used to drop the entry with zero feedback — the
      // grid cell just reverted, reading as "my entry was ignored".
      showToast(`${workDate} is marked Correct — unlock the day before changing hours.`, 'warning')
      return
    }
    const roster = peopleRosterRef.current
    const person_id = resolvePersonIdFromRosterName(roster, personName)
    // Optimistic update: show new value immediately
    setPeopleHours((prev) => {
      const rest = prev.filter((h) => !(h.person_name === personName && h.work_date === workDate))
      return [...rest, { person_name: personName, person_id: person_id ?? null, work_date: workDate, hours }]
    })
    const { error } = await supabase.from('people_hours').upsert(
      { person_name: personName, person_id, work_date: workDate, hours, entered_by: authUser?.id ?? null },
      { onConflict: 'person_name,work_date' },
    )
    if (error) setError(error.message)
  }

  // Realtime: live people_hours + clock_sessions changes on the Hours/Pay Reports tabs.
  const peopleHoursClockRealtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const hasAccess = canAccessHours || canAccessPay
    const isRelevantTab = activeTab === 'hours' || activeTab === 'pay_stubs'
    if (!hasAccess || !isRelevantTab) return

    const runClockDerivedReloads = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      realtimeCallbacksRef.current.onClockSessionsChange()
    }

    const scheduleClockDerivedReloads = () => {
      if (!isDocVisible) return
      if (peopleHoursClockRealtimeTimerRef.current) clearTimeout(peopleHoursClockRealtimeTimerRef.current)
      peopleHoursClockRealtimeTimerRef.current = setTimeout(() => {
        peopleHoursClockRealtimeTimerRef.current = null
        runClockDerivedReloads()
      }, PEOPLE_HOURS_CLOCK_REALTIME_DEBOUNCE_MS)
    }

    const channel = supabase.channel('people-hours-changes')
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'people_hours' }, () => {
      realtimeCallbacksRef.current.onPeopleHoursChange()
    })
    if (peopleHoursClockRealtimeInFilter) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clock_sessions',
          filter: peopleHoursClockRealtimeInFilter,
        },
        scheduleClockDerivedReloads,
      )
    } else {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'clock_sessions' }, scheduleClockDerivedReloads)
    }
    channel.subscribe()
    return () => {
      if (peopleHoursClockRealtimeTimerRef.current) {
        clearTimeout(peopleHoursClockRealtimeTimerRef.current)
        peopleHoursClockRealtimeTimerRef.current = null
      }
      supabase.removeChannel(channel)
    }
  }, [
    activeTab,
    canAccessHours,
    canAccessPay,
    hoursDateStart,
    hoursDateEnd,
    isDocVisible,
    peopleHoursClockRealtimeInFilter,
    realtimeCallbacksRef,
  ])

  return {
    peopleHours,
    pendingClockSessions,
    approvedClockSessions,
    rejectedClockSessions,
    activeClockSessions,
    pendingApprovalClockSessions,
    hoursClockSessionsSearch,
    setHoursClockSessionsSearch,
    loadPeopleHours,
    loadPendingClockSessions,
    loadApprovedClockSessions,
    loadRejectedClockSessions,
    loadAllClockSessions,
    saveHours,
  }
}
