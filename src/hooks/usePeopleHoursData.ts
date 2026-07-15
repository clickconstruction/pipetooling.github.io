import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { resolvePersonIdFromRosterName } from '../lib/payPersonSubject'
import { CLOCK_SESSION_LIST_SELECT } from '../lib/clockSessionSelect'
import { clockSessionMatchesSearch } from '../lib/clockSessionSearch'
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
  /** Ledger display-prefix map (3rd arg of clockSessionMatchesSearch) for the filtered selectors. */
  prefixMap: Parameters<typeof clockSessionMatchesSearch>[2]
  /** Live roster ref (people) for person-id resolution in saveHours. */
  peopleRosterRef: React.MutableRefObject<Person[]>
  authUser: { id: string } | null
  /** Live ref of locked ("days correct") work dates; saveHours is a no-op on those. */
  hoursDaysCorrectRef: React.MutableRefObject<Set<string>>
  setError: (msg: string) => void
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
  activeClockSessionsFiltered: ClockSessionRow[]
  pendingApprovalClockSessionsFiltered: ClockSessionRow[]
  approvedClockSessionsFiltered: ClockSessionRow[]
  rejectedClockSessionsFiltered: ClockSessionRow[]
  hoursClockSessionsSearch: string
  setHoursClockSessionsSearch: React.Dispatch<React.SetStateAction<string>>
  hoursClockSessionsSearching: boolean
  noClockSessionsMatchSearch: boolean
  loadPeopleHours: (start: string, end: string) => Promise<void>
  loadPendingClockSessions: (start: string, end: string) => Promise<void>
  loadApprovedClockSessions: (start: string, end: string) => Promise<void>
  loadRejectedClockSessions: (start: string, end: string) => Promise<void>
  loadAllClockSessions: (start: string, end: string) => void
  saveHours: (personName: string, workDate: string, hours: number) => Promise<void>
}

/**
 * Owns the People hours + clock-session data layer: `people_hours` + the pending/approved/rejected
 * `clock_sessions` queues, the search-filtered selectors, their range loaders, and the optimistic
 * `saveHours` writer. Extracted from People.tsx (PR1). The live Realtime subscription is added in PR2.
 * Stays in the parent: `hoursReviewed`, `hoursDaysCorrect` (passed in via ref), draft-payroll, and the
 * clock-session approve/reject/split mutators (which refresh via these loaders).
 */
export function usePeopleHoursData(deps: UsePeopleHoursDataDeps): UsePeopleHoursDataResult {
  const {
    canAccessHours,
    canAccessPay,
    prefixMap,
    peopleRosterRef,
    authUser,
    hoursDaysCorrectRef,
    setError,
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
  const activeClockSessionsFiltered = useMemo(
    () => activeClockSessions.filter((s) => clockSessionMatchesSearch(s, hoursClockSessionsSearch, prefixMap)),
    [activeClockSessions, hoursClockSessionsSearch, prefixMap],
  )
  const pendingApprovalClockSessionsFiltered = useMemo(
    () =>
      pendingApprovalClockSessions.filter((s) => clockSessionMatchesSearch(s, hoursClockSessionsSearch, prefixMap)),
    [pendingApprovalClockSessions, hoursClockSessionsSearch, prefixMap],
  )
  const approvedClockSessionsFiltered = useMemo(
    () => approvedClockSessions.filter((s) => clockSessionMatchesSearch(s, hoursClockSessionsSearch, prefixMap)),
    [approvedClockSessions, hoursClockSessionsSearch, prefixMap],
  )
  const rejectedClockSessionsFiltered = useMemo(
    () => rejectedClockSessions.filter((s) => clockSessionMatchesSearch(s, hoursClockSessionsSearch, prefixMap)),
    [rejectedClockSessions, hoursClockSessionsSearch, prefixMap],
  )
  const hoursClockSessionsSearching = hoursClockSessionsSearch.trim().length > 0
  const noClockSessionsMatchSearch =
    hoursClockSessionsSearching &&
    activeClockSessionsFiltered.length === 0 &&
    pendingApprovalClockSessionsFiltered.length === 0 &&
    approvedClockSessionsFiltered.length === 0 &&
    rejectedClockSessionsFiltered.length === 0

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
    if (hoursDaysCorrectRef.current.has(workDate)) return
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

  // Realtime: live people_hours + clock_sessions changes on the Hours/Pay Stubs tabs.
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
    activeClockSessionsFiltered,
    pendingApprovalClockSessionsFiltered,
    approvedClockSessionsFiltered,
    rejectedClockSessionsFiltered,
    hoursClockSessionsSearch,
    setHoursClockSessionsSearch,
    hoursClockSessionsSearching,
    noClockSessionsMatchSearch,
    loadPeopleHours,
    loadPendingClockSessions,
    loadApprovedClockSessions,
    loadRejectedClockSessions,
    loadAllClockSessions,
    saveHours,
  }
}
