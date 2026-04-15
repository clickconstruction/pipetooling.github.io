import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIntervalNowMs } from './useIntervalNowMs'
import { CLOCK_SESSION_LIST_SELECT, CLOCK_SESSION_TODAY_STRIP_SELECT } from '../lib/clockSessionSelect'
import { getPersonNamesForUser } from '../lib/cascadePersonName'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import {
  formatClockSessionJobOrBidModalLinesFromEmbeds,
  shortJobOrBidLabelFromEmbeds,
  type ClockSessionRow,
  type SyntheticSalaryStripSession,
} from '../types/clockSessions'
import type { Database } from '../types/database'
import { getSalarySyntheticClockInIso } from '../lib/salaryOnShift'
import { denverCalendarDayKey } from '../utils/dateUtils'
import type { AssignSessionJobSavedPatch } from '../components/clock-sessions/AssignSessionJobPopover'
import {
  fetchSalariedUserIdSetFromUserIds,
  filterSessionsToSalariedSalaryOrigin,
} from '../lib/salaryPayConfigGate'
import { hasPairwiseClockIntervalOverlap } from '../lib/myTimeDayTimeline'

function optimisticPatchClockSessionRow(row: ClockSessionRow, patch: AssignSessionJobSavedPatch): ClockSessionRow {
  if (row.id !== patch.sessionId) return row
  if (patch.selection === null) {
    return { ...row, job_ledger_id: null, bid_id: null, jobs_ledger: null, bids: null }
  }
  const sel = patch.selection
  if (sel.source === 'job') {
    return {
      ...row,
      job_ledger_id: sel.id,
      bid_id: null,
      jobs_ledger: {
        hcp_number: sel.hcp_number ?? null,
        job_name: sel.job_name ?? null,
        job_address: sel.job_address ?? null,
      },
      bids: null,
    }
  }
  return {
    ...row,
    bid_id: sel.id,
    job_ledger_id: null,
    bids: {
      bid_number: sel.bid_number ?? null,
      project_name: sel.project_name ?? null,
      address: sel.address ?? null,
      customers: { name: sel.customer_name?.trim() ? sel.customer_name : null },
    },
    jobs_ledger: null,
  }
}

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

export type DashboardHoursVisibility = 'full' | 'strip_only'

export type TeamMemberRosterRow = {
  assignmentId: string
  userId: string
  displayName: string
  dashboard_visibility: DashboardHoursVisibility
}

/** Pending = clocked out, awaiting approval; active = still clocked in (unapproved). manual = People Hours grid sum minus approved clock hours for the week (avoids double-count when approval merges into `people_hours`). total = active + pending + approved + manual. */
export type TeamHoursSummary = { active: number; pending: number; approved: number; manual: number; total: number }

function sessionDurationSeconds(
  clockedIn: string,
  clockedOut: string | null,
  nowMs: number,
): number {
  const inMs = new Date(clockedIn).getTime()
  const outMs = clockedOut ? new Date(clockedOut).getTime() : nowMs
  return Math.max(0, Math.floor((outMs - inMs) / 1000))
}

export type TodaySessionStripRow = {
  id: string
  user_id: string
  clocked_in_at: string
  clocked_out_at: string | null
  approved_at: string | null
  rejected_at: string | null
  revoked_at: string | null
  notes: string | null
  job_ledger_id: string | null
  bid_id: string | null
  users: { name: string | null } | null
  jobs_ledger: { hcp_number: string | null; job_name: string | null; job_address: string | null } | null
  bids: {
    bid_number: string | null
    project_name: string | null
    address: string | null
    customers: { name: string | null } | null
  } | null
}

function optimisticPatchTodayStripRow(row: TodaySessionStripRow, patch: AssignSessionJobSavedPatch): TodaySessionStripRow {
  if (row.id !== patch.sessionId) return row
  if (patch.selection === null) {
    return { ...row, job_ledger_id: null, bid_id: null, jobs_ledger: null, bids: null }
  }
  const sel = patch.selection
  if (sel.source === 'job') {
    return {
      ...row,
      job_ledger_id: sel.id,
      bid_id: null,
      jobs_ledger: {
        hcp_number: sel.hcp_number ?? null,
        job_name: sel.job_name ?? null,
        job_address: sel.job_address ?? null,
      },
      bids: null,
    }
  }
  return {
    ...row,
    bid_id: sel.id,
    job_ledger_id: null,
    bids: {
      bid_number: sel.bid_number ?? null,
      project_name: sel.project_name ?? null,
      address: sel.address ?? null,
      customers: { name: sel.customer_name?.trim() ? sel.customer_name : null },
    },
    jobs_ledger: null,
  }
}

/** One row per user for the dashboard "Clocked in today" table below the open-sessions strip. */
export type ClockedInTodayStripRow = {
  userId: string
  displayName: string
  firstClockedInAt: string
  hoursToday: number
  /** Non-rejected, non-revoked sessions for today (work_date), sorted by clock-in ascending. */
  todaySessions: TodaySessionStripRow[]
  /** Two+ sessions with clock intervals overlapping by more than CLUSTER_CONTIGUITY_EPS_MS. */
  hasIntervalOverlapToday: boolean
}

/** One row per job for the dashboard "Jobs worked today" subsection (job-linked sessions only). */
export type JobsWorkedTodayStripRow = {
  jobLedgerId: string
  label: string
  addressLine: string | null
  totalSeconds: number
  distinctPeopleCount: number
  sessions: TodaySessionStripRow[]
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

function sortPendingSessionsDesc(a: ClockSessionRow, b: ClockSessionRow): number {
  const wd = b.work_date.localeCompare(a.work_date)
  if (wd !== 0) return wd
  return b.clocked_in_at.localeCompare(a.clocked_in_at)
}

/** Unapproved rows merged with approved-but-still-open `salary_schedule` rows (dedupe by `id`). */
function mergePendingWithOpenSalarySchedule(
  unapproved: ClockSessionRow[],
  openSalary: ClockSessionRow[],
): ClockSessionRow[] {
  const byId = new Map<string, ClockSessionRow>()
  for (const s of openSalary) byId.set(s.id, s)
  for (const s of unapproved) byId.set(s.id, s)
  return [...byId.values()].sort(sortPendingSessionsDesc)
}

export type DashboardMyTeamSectionOptions = {
  /** When true, load org-wide pending sessions + today hours for the clock strip (RLS-bounded). */
  orgWideStripEnabled?: boolean
  /**
   * When set (e.g. Quickfill day picker), load strip `clock_sessions` for this `work_date` (YYYY-MM-DD)
   * and align salary strip meta. When unset, team/org loaders use browser-local today (unchanged).
   */
  stripWorkDateYmd?: string
  /**
   * When set, `loadPending` / `loadOrgWidePending` use this work_date range instead of the dashboard week.
   * Other loaders (hours summary, etc.) still use the dashboard `dateStart`/`dateEnd`.
   */
  pendingWorkDateRange?: { start: string; end: string }
}

export function useDashboardMyTeamSectionState(
  authUserId: string | undefined,
  options?: DashboardMyTeamSectionOptions,
) {
  const orgWideStripEnabled = options?.orgWideStripEnabled === true
  const stripWorkDateYmd = options?.stripWorkDateYmd
  const [{ start: dateStart, end: dateEnd }, setDateRange] = useState(weekStartEndEnCA)
  const pendingQueryStart = options?.pendingWorkDateRange?.start ?? dateStart
  const pendingQueryEnd = options?.pendingWorkDateRange?.end ?? dateEnd
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
  const [todaySessionsRows, setTodaySessionsRows] = useState<TodaySessionStripRow[]>([])
  const [orgWidePendingSessions, setOrgWidePendingSessions] = useState<ClockSessionRow[]>([])
  const [todaySessionsRowsOrg, setTodaySessionsRowsOrg] = useState<TodaySessionStripRow[]>([])
  const [salaryStripMeta, setSalaryStripMeta] = useState<{
    todayYmd: string
    templates: Database['public']['Tables']['salary_work_schedule_templates']['Row'][]
    overrides: Database['public']['Tables']['salary_work_schedule_day_overrides']['Row'][]
    timeOff: Database['public']['Tables']['user_time_off']['Row'][]
    /** Resolved from `users` for every salary template `user_id` (org-wide strip names not on team roster). */
    displayNameByUserId: Readonly<Record<string, string>>
  } | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(false)
  /** Latest-wins for overlapping `loadPending` runs (unstable effect deps / fast re-snapshot). */
  const loadPendingGenerationRef = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const [myTeamExpanded, setMyTeamExpanded] = useState(false)

  /** Team strip: members plus viewer (leader is not in `team_leader_assignments` as member). */
  const stripTeamUserIds = useMemo(
    () => [...new Set([...memberUserIds, ...(authUserId ? [authUserId] : [])])],
    [memberUserIds, authUserId],
  )

  const loadAssignments = useCallback(async () => {
    if (!authUserId) {
      setMemberUserIds([])
      setTeamMemberRoster([])
      setNotifyByAssignment({})
      setHoursSummaryByUserId({})
      setTodaySessionsRows([])
      setOrgWidePendingSessions([])
      setTodaySessionsRowsOrg([])
      setSalaryStripMeta(null)
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
              'id, member_user_id, dashboard_hours_visibility, users!team_leader_assignments_member_user_id_fkey(id, name, email)',
            )
            .eq('leader_user_id', authUserId),
        'load team leader assignments',
      )
      type Row = {
        id: string
        member_user_id: string
        dashboard_hours_visibility: string | null
        users: { id: string; name: string | null; email: string | null } | null
      }
      const list = (rows ?? []) as Row[]
      const roster = list
        .map((r) => ({
          assignmentId: r.id,
          userId: r.member_user_id,
          displayName: displayNameForTeamMember(r.member_user_id, r.users),
          dashboard_visibility:
            r.dashboard_hours_visibility === 'strip_only' ? ('strip_only' as const) : ('full' as const),
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
      setTodaySessionsRows([])
      setOrgWidePendingSessions([])
      setTodaySessionsRowsOrg([])
      setSalaryStripMeta(null)
    } finally {
      setLoadingMeta(false)
    }
  }, [authUserId])

  const loadTodayClockSessions = useCallback(async () => {
    if (!authUserId) {
      setTodaySessionsRows([])
      return
    }
    const workDate = stripWorkDateYmd ?? new Date().toLocaleDateString('en-CA')
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .select(CLOCK_SESSION_TODAY_STRIP_SELECT)
            .in('user_id', stripTeamUserIds)
            .eq('work_date', workDate),
        'load team today clock sessions',
      )
      setTodaySessionsRows((data ?? []) as TodaySessionStripRow[])
    } catch {
      setTodaySessionsRows([])
    }
  }, [authUserId, stripTeamUserIds, stripWorkDateYmd])

  const loadTodayClockSessionsOrg = useCallback(async () => {
    if (!authUserId) {
      setTodaySessionsRowsOrg([])
      return
    }
    const workDate = stripWorkDateYmd ?? new Date().toLocaleDateString('en-CA')
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .select(CLOCK_SESSION_TODAY_STRIP_SELECT)
            .eq('work_date', workDate),
        'load org today clock sessions',
      )
      setTodaySessionsRowsOrg((data ?? []) as TodaySessionStripRow[])
    } catch {
      setTodaySessionsRowsOrg([])
    }
  }, [authUserId, stripWorkDateYmd])

  const loadSalaryStripContext = useCallback(async () => {
    if (!authUserId) {
      setSalaryStripMeta(null)
      return
    }
    const todayYmd = stripWorkDateYmd ?? denverCalendarDayKey(Date.now())
    try {
      let tmplQuery = supabase.from('salary_work_schedule_templates').select('*')
      if (!orgWideStripEnabled) {
        if (stripTeamUserIds.length === 0) {
          setSalaryStripMeta({ todayYmd, templates: [], overrides: [], timeOff: [], displayNameByUserId: {} })
          return
        }
        tmplQuery = tmplQuery.in('user_id', stripTeamUserIds)
      }
      const templates = await withSupabaseRetry(async () => await tmplQuery, 'salary strip templates')
      const tlistRaw = (templates ?? []) as Database['public']['Tables']['salary_work_schedule_templates']['Row'][]
      const salariedTemplateOwners = await fetchSalariedUserIdSetFromUserIds([
        ...new Set(tlistRaw.map((t) => t.user_id)),
      ])
      const tlist = tlistRaw.filter((t) => salariedTemplateOwners.has(t.user_id))
      const ids = [...new Set(tlist.map((t) => t.user_id))]
      if (ids.length === 0) {
        setSalaryStripMeta({ todayYmd, templates: [], overrides: [], timeOff: [], displayNameByUserId: {} })
        return
      }
      const userRows = await withSupabaseRetry(
        async () => supabase.from('users').select('id, name, email').in('id', ids),
        'salary strip template user names',
      )
      type UserMini = { id: string; name: string | null; email: string | null }
      const userById = new Map<string, UserMini>(((userRows ?? []) as UserMini[]).map((u) => [u.id, u]))
      const displayNameByUserId: Record<string, string> = {}
      for (const uid of ids) {
        displayNameByUserId[uid] = displayNameForTeamMember(uid, userById.get(uid) ?? null)
      }
      const [overrides, timeOff] = await Promise.all([
        withSupabaseRetry(
          async () =>
            supabase
              .from('salary_work_schedule_day_overrides')
              .select('*')
              .in('user_id', ids)
              .eq('work_date', todayYmd),
          'salary strip day overrides',
        ),
        withSupabaseRetry(
          async () =>
            supabase
              .from('user_time_off')
              .select('*')
              .in('user_id', ids)
              .lte('start_date', todayYmd)
              .gte('end_date', todayYmd),
          'salary strip time off',
        ),
      ])
      setSalaryStripMeta({
        todayYmd,
        templates: tlist,
        overrides: (overrides ?? []) as Database['public']['Tables']['salary_work_schedule_day_overrides']['Row'][],
        timeOff: (timeOff ?? []) as Database['public']['Tables']['user_time_off']['Row'][],
        displayNameByUserId,
      })
    } catch {
      setSalaryStripMeta(null)
    }
  }, [authUserId, orgWideStripEnabled, stripTeamUserIds, stripWorkDateYmd])

  const loadOrgWidePending = useCallback(async () => {
    if (!authUserId) {
      setOrgWidePendingSessions([])
      setTodaySessionsRowsOrg([])
      setSalaryStripMeta(null)
      return
    }
    try {
      const [unapprovedRes, salaryOpenRes] = await Promise.all([
        withSupabaseRetry(
          async () =>
            supabase
              .from('clock_sessions')
              .select(CLOCK_SESSION_LIST_SELECT)
              .is('approved_at', null)
              .is('rejected_at', null)
              .is('revoked_at', null)
              .gte('work_date', pendingQueryStart)
              .lte('work_date', pendingQueryEnd)
              .order('work_date', { ascending: false })
              .order('clocked_in_at', { ascending: false }),
          'load org-wide pending clock sessions',
        ),
        withSupabaseRetry(
          async () =>
            supabase
              .from('clock_sessions')
              .select(CLOCK_SESSION_LIST_SELECT)
              .eq('origin', 'salary_schedule')
              .is('clocked_out_at', null)
              .is('rejected_at', null)
              .is('revoked_at', null)
              .gte('work_date', pendingQueryStart)
              .lte('work_date', pendingQueryEnd)
              .order('work_date', { ascending: false })
              .order('clocked_in_at', { ascending: false }),
          'load org-wide open approved salary clock sessions',
        ),
      ])
      const merged = mergePendingWithOpenSalarySchedule(
        (unapprovedRes ?? []) as ClockSessionRow[],
        (salaryOpenRes ?? []) as ClockSessionRow[],
      )
      const salariedForPending = await fetchSalariedUserIdSetFromUserIds([
        ...new Set(merged.map((s) => s.user_id)),
      ])
      setOrgWidePendingSessions(filterSessionsToSalariedSalaryOrigin(merged, salariedForPending))
      await Promise.all([loadTodayClockSessionsOrg(), loadSalaryStripContext()])
    } catch {
      setOrgWidePendingSessions([])
      setTodaySessionsRowsOrg([])
    }
  }, [authUserId, pendingQueryStart, pendingQueryEnd, loadTodayClockSessionsOrg, loadSalaryStripContext])

  const loadTeamHoursSummary = useCallback(async () => {
    const fullDetailIds = teamMemberRoster
      .filter((r) => r.dashboard_visibility !== 'strip_only')
      .map((r) => r.userId)
    if (!authUserId || fullDetailIds.length === 0) {
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
            .in('user_id', fullDetailIds)
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
      for (const uid of fullDetailIds) {
        byUser[uid] = { active: 0, pending: 0, approved: 0, manual: 0, total: 0 }
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
      }

      const memberEmails = await withSupabaseRetry(
        async () => supabase.from('users').select('id, email').in('id', fullDetailIds),
        'load team member emails for manual hours',
      )
      const emailByUserId = new Map<string, string | null>(
        ((memberEmails ?? []) as Array<{ id: string; email: string | null }>).map((r) => [r.id, r.email]),
      )
      const nameLists = await Promise.all(
        fullDetailIds.map((uid) => getPersonNamesForUser(uid, emailByUserId.get(uid) ?? null)),
      )
      const namesByUserId = new Map<string, Set<string>>()
      const allNames: string[] = []
      fullDetailIds.forEach((uid, i) => {
        const list = nameLists[i] ?? []
        const set = new Set(list.map((n) => n.trim()).filter(Boolean))
        namesByUserId.set(uid, set)
        for (const n of set) allNames.push(n)
      })
      const uniqueNames = [...new Set(allNames)]
      if (uniqueNames.length > 0) {
        const phRows = await withSupabaseRetry(
          async () =>
            supabase
              .from('people_hours')
              .select('person_name, hours')
              .gte('work_date', dateStart)
              .lte('work_date', dateEnd)
              .in('person_name', uniqueNames),
          'load team manual people_hours',
        )
        for (const raw of (phRows ?? []) as Array<{ person_name: string; hours: number | string }>) {
          const pn = raw.person_name?.trim()
          if (!pn) continue
          const hrs = typeof raw.hours === 'number' ? raw.hours : Number(raw.hours)
          if (!Number.isFinite(hrs)) continue
          for (const uid of fullDetailIds) {
            const set = namesByUserId.get(uid)
            if (set?.has(pn)) {
              const u = byUser[uid]
              if (u) u.manual += hrs
              break
            }
          }
        }
      }

      for (const uid of fullDetailIds) {
        const u = byUser[uid]
        if (!u) continue
        const gridSum = u.manual
        u.manual = Math.max(0, gridSum - u.approved)
        u.total = u.active + u.pending + u.approved + u.manual
      }
      setHoursSummaryByUserId(byUser)
    } catch (e) {
      setError(formatErrorMessage(e))
      setHoursSummaryByUserId({})
    } finally {
      setLoadingHours(false)
    }
  }, [authUserId, teamMemberRoster, dateStart, dateEnd])

  const loadPending = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    if (!authUserId) {
      setPendingSessions([])
      setHoursSummaryByUserId({})
      setTodaySessionsRows([])
      setSalaryStripMeta(null)
      return
    }
    let generation = -1
    if (!silent) {
      setLoadingSessions(true)
      generation = ++loadPendingGenerationRef.current
    }
    setError(null)
    try {
      const [unapprovedRes, salaryOpenRes] = await Promise.all([
        withSupabaseRetry(
          async () =>
            supabase
              .from('clock_sessions')
              .select(CLOCK_SESSION_LIST_SELECT)
              .in('user_id', stripTeamUserIds)
              .is('approved_at', null)
              .is('rejected_at', null)
              .is('revoked_at', null)
              .gte('work_date', pendingQueryStart)
              .lte('work_date', pendingQueryEnd)
              .order('work_date', { ascending: false })
              .order('clocked_in_at', { ascending: false }),
          'load team pending clock sessions',
        ),
        withSupabaseRetry(
          async () =>
            supabase
              .from('clock_sessions')
              .select(CLOCK_SESSION_LIST_SELECT)
              .in('user_id', stripTeamUserIds)
              .eq('origin', 'salary_schedule')
              .is('clocked_out_at', null)
              .is('rejected_at', null)
              .is('revoked_at', null)
              .gte('work_date', pendingQueryStart)
              .lte('work_date', pendingQueryEnd)
              .order('work_date', { ascending: false })
              .order('clocked_in_at', { ascending: false }),
          'load team open approved salary clock sessions',
        ),
      ])
      const merged = mergePendingWithOpenSalarySchedule(
        (unapprovedRes ?? []) as ClockSessionRow[],
        (salaryOpenRes ?? []) as ClockSessionRow[],
      )
      const salariedForPending = await fetchSalariedUserIdSetFromUserIds([
        ...new Set(merged.map((s) => s.user_id)),
      ])
      if (!silent && generation !== loadPendingGenerationRef.current) return
      setPendingSessions(filterSessionsToSalariedSalaryOrigin(merged, salariedForPending))
      await Promise.all([
        loadTeamHoursSummary(),
        loadTodayClockSessions(),
        orgWideStripEnabled ? loadOrgWidePending() : loadSalaryStripContext(),
      ])
    } catch (e) {
      setError(formatErrorMessage(e))
      if (!silent && generation === loadPendingGenerationRef.current) {
        setPendingSessions([])
      }
    } finally {
      if (!silent) {
        if (generation === loadPendingGenerationRef.current) {
          setLoadingSessions(false)
        }
      }
    }
  }, [
    authUserId,
    stripTeamUserIds,
    pendingQueryStart,
    pendingQueryEnd,
    loadTeamHoursSummary,
    loadTodayClockSessions,
    orgWideStripEnabled,
    loadOrgWidePending,
    loadSalaryStripContext,
  ])

  const applyOptimisticClockSessionAssign = useCallback((patch: AssignSessionJobSavedPatch) => {
    setPendingSessions((prev) => prev.map((r) => optimisticPatchClockSessionRow(r, patch)))
    setOrgWidePendingSessions((prev) => prev.map((r) => optimisticPatchClockSessionRow(r, patch)))
    setTodaySessionsRows((prev) => prev.map((r) => optimisticPatchTodayStripRow(r, patch)))
    setTodaySessionsRowsOrg((prev) => prev.map((r) => optimisticPatchTodayStripRow(r, patch)))
  }, [])

  const removePendingSessionFromState = useCallback((sessionId: string) => {
    setPendingSessions((prev) => prev.filter((s) => s.id !== sessionId))
  }, [])

  useEffect(() => {
    void loadAssignments()
  }, [loadAssignments])

  useEffect(() => {
    void loadPending()
  }, [loadPending])

  useEffect(() => {
    if (!authUserId) {
      setOrgWidePendingSessions([])
      setTodaySessionsRowsOrg([])
      setSalaryStripMeta(null)
      return
    }
    if (!orgWideStripEnabled) {
      setOrgWidePendingSessions([])
      setTodaySessionsRowsOrg([])
      return
    }
    void loadOrgWidePending()
  }, [orgWideStripEnabled, authUserId, loadOrgWidePending])

  const loadLedger = useCallback(async () => {
    const fullDetailIds = teamMemberRoster
      .filter((r) => r.dashboard_visibility !== 'strip_only')
      .map((r) => r.userId)
    if (!authUserId || fullDetailIds.length === 0) {
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
            .in('user_id', fullDetailIds)
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
  }, [authUserId, teamMemberRoster, dateStart, dateEnd])

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

  const todayHoursNowMs = useIntervalNowMs(45_000)
  const hoursTodayByUserId = useMemo(() => {
    const out: Record<string, number> = {}
    const stripSet = new Set(stripTeamUserIds)
    for (const uid of stripTeamUserIds) {
      out[uid] = 0
    }
    for (const row of todaySessionsRows) {
      if (row.rejected_at || row.revoked_at) continue
      if (!stripSet.has(row.user_id)) continue
      const sec = sessionDurationSeconds(row.clocked_in_at, row.clocked_out_at, todayHoursNowMs)
      out[row.user_id] = (out[row.user_id] ?? 0) + sec / 3600
    }
    return out
  }, [stripTeamUserIds, todaySessionsRows, todayHoursNowMs])

  const hoursTodayByUserIdOrg = useMemo(() => {
    const out: Record<string, number> = {}
    for (const row of todaySessionsRowsOrg) {
      if (row.rejected_at || row.revoked_at) continue
      const sec = sessionDurationSeconds(row.clocked_in_at, row.clocked_out_at, todayHoursNowMs)
      out[row.user_id] = (out[row.user_id] ?? 0) + sec / 3600
    }
    return out
  }, [todaySessionsRowsOrg, todayHoursNowMs])

  const todaySessionsForStripScope = useMemo(
    () => (orgWideStripEnabled ? todaySessionsRowsOrg : todaySessionsRows),
    [orgWideStripEnabled, todaySessionsRowsOrg, todaySessionsRows],
  )

  const clockedInTodayStripRows = useMemo((): ClockedInTodayStripRow[] => {
    const hoursMap = orgWideStripEnabled ? hoursTodayByUserIdOrg : hoursTodayByUserId
    const rosterMap = new Map(teamMemberRoster.map((r) => [r.userId, r.displayName]))
    const byUser = new Map<string, { firstIn: string; joinName: string | null }>()
    const sessionsByUser = new Map<string, TodaySessionStripRow[]>()

    for (const row of todaySessionsForStripScope) {
      if (row.rejected_at || row.revoked_at) continue
      const list = sessionsByUser.get(row.user_id)
      if (list) {
        list.push(row)
      } else {
        sessionsByUser.set(row.user_id, [row])
      }
      const joinName = row.users?.name?.trim() || null
      const existing = byUser.get(row.user_id)
      if (!existing) {
        byUser.set(row.user_id, { firstIn: row.clocked_in_at, joinName })
      } else {
        if (row.clocked_in_at < existing.firstIn) {
          existing.firstIn = row.clocked_in_at
        }
        if (!existing.joinName && joinName) existing.joinName = joinName
      }
    }

    for (const [, list] of sessionsByUser) {
      list.sort((a, b) => a.clocked_in_at.localeCompare(b.clocked_in_at))
    }

    const rows: ClockedInTodayStripRow[] = []
    for (const [userId, { firstIn, joinName }] of byUser) {
      let displayName = joinName ?? ''
      if (!displayName && !orgWideStripEnabled) {
        displayName = rosterMap.get(userId) ?? ''
      }
      if (!displayName) {
        displayName = `User (${userId.slice(-6)})`
      }
      const todaySessions = sessionsByUser.get(userId) ?? []
      rows.push({
        userId,
        displayName,
        firstClockedInAt: firstIn,
        hoursToday: hoursMap[userId] ?? 0,
        todaySessions,
        hasIntervalOverlapToday: hasPairwiseClockIntervalOverlap(todaySessions, todayHoursNowMs),
      })
    }
    rows.sort((a, b) => {
      const aSelf = authUserId != null && a.userId === authUserId ? 0 : 1
      const bSelf = authUserId != null && b.userId === authUserId ? 0 : 1
      if (aSelf !== bSelf) return aSelf - bSelf
      const c = a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
      if (c !== 0) return c
      return a.userId.localeCompare(b.userId)
    })
    return rows
  }, [
    authUserId,
    todaySessionsForStripScope,
    orgWideStripEnabled,
    hoursTodayByUserIdOrg,
    hoursTodayByUserId,
    teamMemberRoster,
    todayHoursNowMs,
  ])

  const jobsWorkedTodayStripRows = useMemo((): JobsWorkedTodayStripRow[] => {
    const byJob = new Map<string, TodaySessionStripRow[]>()
    for (const row of todaySessionsForStripScope) {
      if (row.rejected_at || row.revoked_at) continue
      if (!row.job_ledger_id) continue
      const jid = row.job_ledger_id
      const list = byJob.get(jid)
      if (list) list.push(row)
      else byJob.set(jid, [row])
    }
    const out: JobsWorkedTodayStripRow[] = []
    for (const [jobLedgerId, sessions] of byJob) {
      sessions.sort((a, b) => a.clocked_in_at.localeCompare(b.clocked_in_at))
      let totalSeconds = 0
      for (const s of sessions) {
        totalSeconds += sessionDurationSeconds(s.clocked_in_at, s.clocked_out_at, todayHoursNowMs)
      }
      const labelSession = sessions[0]!
      const label =
        shortJobOrBidLabelFromEmbeds({
          jobs_ledger: labelSession.jobs_ledger,
          bids: null,
        }) ?? 'Job linked'
      const lines = formatClockSessionJobOrBidModalLinesFromEmbeds({
        jobs_ledger: labelSession.jobs_ledger,
        bids: null,
      })
      const rawAddr = (lines?.line2 ?? labelSession.jobs_ledger?.job_address ?? '').trim()
      const addressLine = rawAddr.length > 0 ? rawAddr : null
      const distinctPeopleCount = new Set(sessions.map((s) => s.user_id)).size
      out.push({
        jobLedgerId,
        label,
        addressLine,
        totalSeconds,
        distinctPeopleCount,
        sessions,
      })
    }
    out.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
    )
    return out
  }, [todaySessionsForStripScope, todayHoursNowMs])

  const stripSyntheticSalarySessions = useMemo((): SyntheticSalaryStripSession[] => {
    if (!salaryStripMeta) return []
    if (
      stripWorkDateYmd !== undefined &&
      stripWorkDateYmd !== denverCalendarDayKey(Date.now())
    ) {
      return []
    }
    const { todayYmd, templates, overrides, timeOff, displayNameByUserId } = salaryStripMeta
    const ovByUser = new Map(overrides.map((o) => [o.user_id, o]))
    const timeOffByUser = new Map<string, Database['public']['Tables']['user_time_off']['Row'][]>()
    for (const r of timeOff) {
      const arr = timeOffByUser.get(r.user_id) ?? []
      arr.push(r)
      timeOffByUser.set(r.user_id, arr)
    }
    const pendingSource = orgWideStripEnabled ? orgWidePendingSessions : pendingSessions
    const openUserIds = new Set<string>()
    for (const row of pendingSource) {
      if (row.clocked_out_at == null) openUserIds.add(row.user_id)
    }
    const rosterName = new Map(teamMemberRoster.map((r) => [r.userId, r.displayName]))
    const out: SyntheticSalaryStripSession[] = []
    for (const template of templates) {
      const uid = template.user_id
      if (openUserIds.has(uid)) continue
      const toRows = timeOffByUser.get(uid) ?? []
      const ov = ovByUser.get(uid)
      const clockInIso = getSalarySyntheticClockInIso({
        workDateYmd: todayYmd,
        nowMs: todayHoursNowMs,
        timeOffRows: toRows,
        template,
        overrideForDate: ov,
      })
      if (!clockInIso) continue
      const rosterD = rosterName.get(uid)?.trim()
      const usersTableD = displayNameByUserId[uid]?.trim()
      const display = rosterD || usersTableD || `User (${uid.slice(-6)})`
      out.push({
        kind: 'synthetic_salary',
        id: `synthetic-salary-${uid}-${todayYmd}`,
        user_id: uid,
        clocked_in_at: clockInIso,
        clocked_out_at: null,
        work_date: todayYmd,
        notes: '',
        job_ledger_id: null,
        bid_id: null,
        approved_at: null,
        rejected_at: null,
        revoked_at: null,
        users: { name: display },
        jobs_ledger: null,
        bids: null,
      })
    }
    out.sort((a, b) => {
      const an = (a.users?.name ?? '').trim() || a.user_id
      const bn = (b.users?.name ?? '').trim() || b.user_id
      const c = an.localeCompare(bn, undefined, { sensitivity: 'base' })
      if (c !== 0) return c
      return a.user_id.localeCompare(b.user_id)
    })
    return out
  }, [
    salaryStripMeta,
    orgWideStripEnabled,
    orgWidePendingSessions,
    pendingSessions,
    teamMemberRoster,
    todayHoursNowMs,
    stripWorkDateYmd,
  ])

  const fullDetailMemberUserIdSet = useMemo(
    () =>
      new Set(
        teamMemberRoster.filter((r) => r.dashboard_visibility !== 'strip_only').map((r) => r.userId),
      ),
    [teamMemberRoster],
  )

  const fullDetailMemberIds = useMemo(
    () => [...fullDetailMemberUserIdSet],
    [fullDetailMemberUserIdSet],
  )

  const pendingApprovalCount = useMemo(
    () =>
      pendingSessions.filter(
        (s) => s.clocked_out_at != null && fullDetailMemberUserIdSet.has(s.user_id),
      ).length,
    [pendingSessions, fullDetailMemberUserIdSet],
  )

  const clockStripWorkDateYmd = useMemo(
    () => stripWorkDateYmd ?? new Date().toLocaleDateString('en-CA'),
    [stripWorkDateYmd],
  )

  return {
    authUserId,
    memberUserIds,
    fullDetailMemberIds,
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
    orgWidePendingSessions,
    hoursTodayByUserId,
    hoursTodayByUserIdOrg,
    todaySessionsForStripScope,
    clockedInTodayStripRows,
    clockStripWorkDateYmd,
    jobsWorkedTodayStripRows,
    stripSyntheticSalarySessions,
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
    applyOptimisticClockSessionAssign,
    removePendingSessionFromState,
    setNotifyPreference,
    orderedLedgerSessions,
    ledgerPeopleForFilter,
    simpleLedgerGroups,
  }
}

export type DashboardMyTeamSectionState = ReturnType<typeof useDashboardMyTeamSectionState>
