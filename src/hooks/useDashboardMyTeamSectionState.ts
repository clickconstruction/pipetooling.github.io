import { useCallback, useEffect, useMemo, useState } from 'react'
import { CLOCK_SESSION_LIST_SELECT } from '../lib/clockSessionSelect'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import type { ClockSessionRow } from '../types/clockSessions'

function weekStartEndEnCA(): { start: string; end: string } {
  const d = new Date()
  const day = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  const end = new Date(d)
  end.setDate(d.getDate() - day + 6)
  return { start: start.toLocaleDateString('en-CA'), end: end.toLocaleDateString('en-CA') }
}

function displayNameForTeamMember(
  memberUserId: string,
  u: { id: string; name: string | null; email: string | null } | null,
): string {
  if (u) {
    const n = u.name?.trim()
    if (n) return n
    const em = u.email?.trim()
    if (em) return em
  }
  return `User (${memberUserId.slice(-6)})`
}

export type TeamMemberRosterRow = { assignmentId: string; userId: string; displayName: string }

/** Pending = clocked out, awaiting approval; active = still clocked in (unapproved). */
export type TeamHoursSummary = { active: number; pending: number; approved: number; total: number }

function sessionDurationSeconds(
  clockedIn: string,
  clockedOut: string | null,
  nowMs: number,
): number {
  const inMs = new Date(clockedIn).getTime()
  const outMs = clockedOut ? new Date(clockedOut).getTime() : nowMs
  return Math.max(0, Math.floor((outMs - inMs) / 1000))
}

const CLOCK_ACTIVITY_SIMPLE_STORAGE_KEY = 'dashboard_my_team_clock_activity_simple'
const CLOCK_ACTIVITY_LIST_MODE_STORAGE_KEY = 'dashboard_my_team_clock_activity_list_mode'

function readClockActivitySimplePreference(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(CLOCK_ACTIVITY_SIMPLE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export type ClockActivityListMode = 'chronological' | 'byPerson'

function readClockActivityListMode(): ClockActivityListMode {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(CLOCK_ACTIVITY_LIST_MODE_STORAGE_KEY) : null
    return v === 'byPerson' ? 'byPerson' : 'chronological'
  } catch {
    return 'chronological'
  }
}

function personDisplayName(s: ClockSessionRow): string {
  return s.users?.name?.trim() ?? 'Unknown'
}

export function useDashboardMyTeamSectionState(authUserId: string | undefined) {
  const [memberUserIds, setMemberUserIds] = useState<string[]>([])
  const [teamMemberRoster, setTeamMemberRoster] = useState<TeamMemberRosterRow[]>([])
  const [hoursSummaryByUserId, setHoursSummaryByUserId] = useState<Record<string, TeamHoursSummary>>({})
  const [loadingHours, setLoadingHours] = useState(false)
  const [notifyByAssignment, setNotifyByAssignment] = useState<Record<string, boolean>>({})
  const [notifySavingId, setNotifySavingId] = useState<string | null>(null)
  const [clockActivityExpanded, setClockActivityExpanded] = useState(false)
  const [clockActivitySimpleView, setClockActivitySimpleView] = useState(readClockActivitySimplePreference)
  const [clockActivityListMode, setClockActivityListMode] = useState<ClockActivityListMode>(readClockActivityListMode)
  const [clockActivityVisibleUserIds, setClockActivityVisibleUserIds] = useState<Set<string>>(() => new Set())
  const [ledgerSessions, setLedgerSessions] = useState<ClockSessionRow[]>([])
  const [loadingLedger, setLoadingLedger] = useState(false)
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [pendingSessions, setPendingSessions] = useState<ClockSessionRow[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [myTeamExpanded, setMyTeamExpanded] = useState(true)
  const [{ start: dateStart, end: dateEnd }, setDateRange] = useState(weekStartEndEnCA)

  const loadAssignments = useCallback(async () => {
    if (!authUserId) {
      setMemberUserIds([])
      setTeamMemberRoster([])
      setNotifyByAssignment({})
      setHoursSummaryByUserId({})
      setLoadingMeta(false)
      return
    }
    setLoadingMeta(true)
    setError(null)
    try {
      const rows = await withSupabaseRetry(
        async () =>
          supabase
            .from('team_leader_assignments')
            .select(
              'id, member_user_id, users!team_leader_assignments_member_user_id_fkey(id, name, email)',
            )
            .eq('leader_user_id', authUserId),
        'load team leader assignments',
      )
      type Row = {
        id: string
        member_user_id: string
        users: { id: string; name: string | null; email: string | null } | null
      }
      const list = (rows ?? []) as Row[]
      const roster = list
        .map((r) => ({
          assignmentId: r.id,
          userId: r.member_user_id,
          displayName: displayNameForTeamMember(r.member_user_id, r.users),
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }))
      setTeamMemberRoster(roster)
      setMemberUserIds([...new Set(roster.map((x) => x.userId))])

      const assignmentIds = roster.map((r) => r.assignmentId)
      if (assignmentIds.length > 0) {
        const prefRows = await withSupabaseRetry(
          async () =>
            supabase
              .from('team_leader_clock_notify_prefs')
              .select('team_leader_assignment_id, notify_enabled')
              .in('team_leader_assignment_id', assignmentIds),
          'load team leader clock notify prefs',
        )
        const next: Record<string, boolean> = {}
        for (const p of (prefRows ?? []) as Array<{ team_leader_assignment_id: string; notify_enabled: boolean }>) {
          next[p.team_leader_assignment_id] = p.notify_enabled
        }
        setNotifyByAssignment(next)
      } else {
        setNotifyByAssignment({})
      }
    } catch (e) {
      setError(formatErrorMessage(e))
      setMemberUserIds([])
      setTeamMemberRoster([])
      setNotifyByAssignment({})
      setHoursSummaryByUserId({})
    } finally {
      setLoadingMeta(false)
    }
  }, [authUserId])

  const loadTeamHoursSummary = useCallback(async () => {
    if (!authUserId || memberUserIds.length === 0) {
      setHoursSummaryByUserId({})
      return
    }
    setLoadingHours(true)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .select('user_id, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at')
            .in('user_id', memberUserIds)
            .gte('work_date', dateStart)
            .lte('work_date', dateEnd),
        'load team hours summary',
      )
      const nowMs = Date.now()
      type SlimRow = {
        user_id: string
        clocked_in_at: string
        clocked_out_at: string | null
        approved_at: string | null
        rejected_at: string | null
        revoked_at: string | null
      }
      const byUser: Record<string, TeamHoursSummary> = {}
      for (const uid of memberUserIds) {
        byUser[uid] = { active: 0, pending: 0, approved: 0, total: 0 }
      }
      for (const row of (data ?? []) as SlimRow[]) {
        if (row.rejected_at || row.revoked_at) continue
        const sec = sessionDurationSeconds(row.clocked_in_at, row.clocked_out_at, nowMs)
        const hrs = sec / 3600
        const u = byUser[row.user_id]
        if (!u) continue
        if (row.approved_at) {
          u.approved += hrs
        } else if (row.clocked_out_at == null) {
          u.active += hrs
        } else {
          u.pending += hrs
        }
        u.total = u.active + u.pending + u.approved
      }
      setHoursSummaryByUserId(byUser)
    } catch (e) {
      setError(formatErrorMessage(e))
      setHoursSummaryByUserId({})
    } finally {
      setLoadingHours(false)
    }
  }, [authUserId, memberUserIds, dateStart, dateEnd])

  const loadPending = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    if (!authUserId || memberUserIds.length === 0) {
      setPendingSessions([])
      setHoursSummaryByUserId({})
      return
    }
    if (!silent) {
      setLoadingSessions(true)
    }
    setError(null)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .select(CLOCK_SESSION_LIST_SELECT)
            .in('user_id', memberUserIds)
            .is('approved_at', null)
            .is('rejected_at', null)
            .gte('work_date', dateStart)
            .lte('work_date', dateEnd)
            .order('work_date', { ascending: false })
            .order('clocked_in_at', { ascending: false }),
        'load team pending clock sessions',
      )
      setPendingSessions((data ?? []) as unknown as ClockSessionRow[])
      await loadTeamHoursSummary()
    } catch (e) {
      setError(formatErrorMessage(e))
      if (!silent) {
        setPendingSessions([])
      }
    } finally {
      if (!silent) {
        setLoadingSessions(false)
      }
    }
  }, [authUserId, memberUserIds, dateStart, dateEnd, loadTeamHoursSummary])

  const removePendingSessionFromState = useCallback((sessionId: string) => {
    setPendingSessions((prev) => prev.filter((s) => s.id !== sessionId))
  }, [])

  useEffect(() => {
    void loadAssignments()
  }, [loadAssignments])

  useEffect(() => {
    void loadPending()
  }, [loadPending])

  const loadLedger = useCallback(async () => {
    if (!authUserId || memberUserIds.length === 0) {
      setLedgerSessions([])
      return
    }
    setLoadingLedger(true)
    setError(null)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .select(CLOCK_SESSION_LIST_SELECT)
            .in('user_id', memberUserIds)
            .gte('work_date', dateStart)
            .lte('work_date', dateEnd)
            .order('clocked_in_at', { ascending: false }),
        'load team clock activity ledger',
      )
      setLedgerSessions((data ?? []) as unknown as ClockSessionRow[])
    } catch (e) {
      setError(formatErrorMessage(e))
      setLedgerSessions([])
    } finally {
      setLoadingLedger(false)
    }
  }, [authUserId, memberUserIds, dateStart, dateEnd])

  useEffect(() => {
    void loadLedger()
  }, [loadLedger])

  useEffect(() => {
    try {
      localStorage.setItem(CLOCK_ACTIVITY_SIMPLE_STORAGE_KEY, clockActivitySimpleView ? '1' : '0')
    } catch {
      /* ignore quota / private mode */
    }
  }, [clockActivitySimpleView])

  useEffect(() => {
    const userIdSet = new Set(ledgerSessions.map((s) => s.user_id))
    setClockActivityVisibleUserIds(new Set(userIdSet))
  }, [ledgerSessions])

  useEffect(() => {
    try {
      localStorage.setItem(
        CLOCK_ACTIVITY_LIST_MODE_STORAGE_KEY,
        clockActivityListMode === 'byPerson' ? 'byPerson' : 'chronological',
      )
    } catch {
      /* ignore */
    }
  }, [clockActivityListMode])

  const filteredLedgerSessions = useMemo(
    () => ledgerSessions.filter((s) => clockActivityVisibleUserIds.has(s.user_id)),
    [ledgerSessions, clockActivityVisibleUserIds],
  )

  const orderedLedgerSessions = useMemo(() => {
    const arr = [...filteredLedgerSessions]
    if (clockActivityListMode === 'chronological') {
      arr.sort((a, b) => new Date(b.clocked_in_at).getTime() - new Date(a.clocked_in_at).getTime())
    } else {
      arr.sort((a, b) => {
        const an = personDisplayName(a)
        const bn = personDisplayName(b)
        const c = an.localeCompare(bn, undefined, { sensitivity: 'base' })
        if (c !== 0) return c
        return new Date(b.clocked_in_at).getTime() - new Date(a.clocked_in_at).getTime()
      })
    }
    return arr
  }, [filteredLedgerSessions, clockActivityListMode])

  const ledgerPeopleForFilter = useMemo(() => {
    const byId = new Map<string, string>()
    for (const s of ledgerSessions) {
      if (!byId.has(s.user_id)) byId.set(s.user_id, personDisplayName(s))
    }
    return [...byId.entries()]
      .map(([userId, name]) => ({ userId, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [ledgerSessions])

  const simpleLedgerGroups = useMemo(() => {
    if (clockActivityListMode !== 'byPerson') return null
    const groups: { userId: string; name: string; sessions: ClockSessionRow[] }[] = []
    let cur: { userId: string; name: string; sessions: ClockSessionRow[] } | null = null
    for (const s of orderedLedgerSessions) {
      if (!cur || cur.userId !== s.user_id) {
        if (cur) groups.push(cur)
        cur = { userId: s.user_id, name: personDisplayName(s), sessions: [s] }
      } else {
        cur.sessions.push(s)
      }
    }
    if (cur) groups.push(cur)
    return groups
  }, [orderedLedgerSessions, clockActivityListMode])

  const toggleLedgerPersonVisible = useCallback((userId: string) => {
    setClockActivityVisibleUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        if (next.size <= 1) return prev
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }, [])

  const setNotifyPreference = useCallback(async (assignmentId: string, enabled: boolean) => {
    setNotifySavingId(assignmentId)
    setNotifyByAssignment((prev) => ({ ...prev, [assignmentId]: enabled }))
    setError(null)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('team_leader_clock_notify_prefs').upsert(
            {
              team_leader_assignment_id: assignmentId,
              notify_enabled: enabled,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'team_leader_assignment_id' },
          ),
        'save team leader clock notify pref',
      )
    } catch (e) {
      setNotifyByAssignment((prev) => ({ ...prev, [assignmentId]: !enabled }))
      setError(formatErrorMessage(e))
    } finally {
      setNotifySavingId(null)
    }
  }, [])

  const shiftWeek = useCallback((delta: number) => {
    setDateRange((prev) => {
      const s = new Date(prev.start + 'T12:00:00')
      s.setDate(s.getDate() + delta * 7)
      const e = new Date(s)
      e.setDate(s.getDate() + 6)
      return { start: s.toLocaleDateString('en-CA'), end: e.toLocaleDateString('en-CA') }
    })
  }, [])

  const pendingApprovalCount = useMemo(
    () => pendingSessions.filter((s) => s.clocked_out_at != null).length,
    [pendingSessions],
  )

  return {
    authUserId,
    memberUserIds,
    teamMemberRoster,
    hoursSummaryByUserId,
    loadingHours,
    notifyByAssignment,
    notifySavingId,
    clockActivityExpanded,
    setClockActivityExpanded,
    clockActivitySimpleView,
    setClockActivitySimpleView,
    clockActivityListMode,
    setClockActivityListMode,
    clockActivityVisibleUserIds,
    toggleLedgerPersonVisible,
    ledgerSessions,
    loadingLedger,
    loadingMeta,
    pendingSessions,
    pendingApprovalCount,
    loadingSessions,
    error,
    setError,
    myTeamExpanded,
    setMyTeamExpanded,
    dateStart,
    dateEnd,
    setDateRange,
    shiftWeek,
    loadPending,
    removePendingSessionFromState,
    setNotifyPreference,
    orderedLedgerSessions,
    ledgerPeopleForFilter,
    simpleLedgerGroups,
  }
}

export type DashboardMyTeamSectionState = ReturnType<typeof useDashboardMyTeamSectionState>
