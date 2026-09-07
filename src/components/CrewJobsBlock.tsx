import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PayConfigRow as PayConfigRowFull } from '../types/peoplePayConfig'
import { effectiveHoursForCost } from '../lib/salariedEffectiveHours'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDateWithRelativeLabel } from '../lib/format'
import { useAuth } from '../hooks/useAuth'
import { useRealtimeChannel } from '../hooks/useRealtimeChannel'
import { loadTeamLaborData, type TeamLaborRow } from '../utils/teamLabor'
import {
  fetchApprovedClosedClockSessionsForJobLedger,
  type JobDetailClockSessionRow,
} from '../lib/fetchClockSessionsForJobLedger'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import {
  type UnifiedAssignment,
  mergeToUnified,
  formatAssignmentLabel,
  type JobDetails,
  type BidDetails,
} from '../utils/crewAssignments'
import type { UnifiedSearchResult } from '../utils/unifiedJobBidSearch'
import { UnifiedSearchResultRow } from './search/UnifiedSearchResultRow'
import { useJobBidSearchEvidence } from '../hooks/useJobBidSearchEvidence'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { phoneSafeMinWidth } from '../lib/stickyModalHeaderStyle'
import { useToastContext } from '../contexts/ToastContext'
import { DashboardMyTimeDayEditorModal } from './DashboardMyTimeDayEditorModal'
import {
  type CrewDaySession,
  type PersonDaySessions,
  crewAssignCellState,
  crewLinkButtonLabel,
  crewLinkPatch,
  crewLinkSuccessMessage,
  groupCrewDaySessionsByPerson,
} from '../lib/crewAssignSessionLinkPlan'

/** What the crew search modal hands back when a row is picked. */
type CrewPick =
  | { type: 'job'; id: string; hcp_number: string; job_name: string; job_address: string; service_type_id?: string | null }
  | { type: 'bid'; id: string; bid_number: string; project_name: string; address: string; service_type_id?: string | null }

const NOTES_PREVIEW_MAX = 80

function formatTeamLaborClockTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      timeZone: APP_CALENDAR_TZ,
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function formatTeamLaborSessionDuration(inIso: string | null, outIso: string | null): string {
  if (!inIso || !outIso) return '—'
  const a = new Date(inIso).getTime()
  const b = new Date(outIso).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return '—'
  const h = (b - a) / 3600000
  return `${h.toLocaleString('en-US', { maximumFractionDigits: 1 })} h`
}

function formatTeamLaborWorkDate(ymd: string | null): string {
  if (!ymd) return '—'
  try {
    return new Date(ymd + 'T12:00:00').toLocaleDateString('en-US', {
      timeZone: APP_CALENDAR_TZ,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ymd
  }
}

/** Narrow view of the canonical pay-config row (single source of truth for field types). */
type PayConfigRow = Pick<PayConfigRowFull, 'person_name' | 'is_salary'>

type CrewRow = { unifiedAssignments: UnifiedAssignment[] }

interface CrewJobsBlockProps {
  people?: string[]
  crewHoursByPerson?: Record<string, number>
  onCrewJobsChange?: () => void
  canEdit?: boolean
  showTitle?: boolean
  showCrewJobsSection?: boolean
  showTeamLabor?: boolean
  jobIdsFilter?: string[]
  collapsibleCrewJobs?: boolean
  hideJobCostColumn?: boolean
  focusTeamLaborJobId?: string | null
  onFocusTeamLaborConsumed?: () => void
}

export function CrewJobsBlock({
  people: peopleProp,
  crewHoursByPerson: crewHoursByPersonProp,
  onCrewJobsChange,
  canEdit: canEditProp,
  showTitle = false,
  showCrewJobsSection = true,
  showTeamLabor = true,
  jobIdsFilter,
  collapsibleCrewJobs = false,
  hideJobCostColumn = false,
  focusTeamLaborJobId = null,
  onFocusTeamLaborConsumed,
}: CrewJobsBlockProps) {
  const { user: authUser } = useAuth()
  const prefixMap = useLedgerPrefixMap()

  const [canAccess, setCanAccess] = useState(false)
  /** False until `loadAccess` finishes so we do not treat empty team labor as final before fetch runs. */
  const [crewPayAccessResolved, setCrewPayAccessResolved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payConfig, setPayConfig] = useState<Record<string, PayConfigRow>>({})
  /** C1-3a (identity): id-keyed flags (separate from the name map — see loadPayConfig). */
  const [payConfigById, setPayConfigById] = useState<Record<string, PayConfigRow>>({})
  /** C1-3a (identity): person_id per crew-row name for id-first flag lookups. */
  const [crewPersonIdByName, setCrewPersonIdByName] = useState<Record<string, string>>({})
  const [hoursDisplayOrder, setHoursDisplayOrder] = useState<Record<string, number>>({})
  const [crewJobsDate, setCrewJobsDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toLocaleDateString('en-CA')
  })
  const [crewJobsData, setCrewJobsData] = useState<Record<string, CrewRow>>({})
  const [crewJobsLoading, setCrewJobsLoading] = useState(false)
  const [crewJobSearchModal, setCrewJobSearchModal] = useState<{ personName: string } | null>(null)
  const [crewJobSearchText, setCrewJobSearchText] = useState('')
  const [crewJobSearchResults, setCrewJobSearchResults] = useState<UnifiedSearchResult[]>([])
  const { jobEvidence, bidEvidence, evidenceMode } = useJobBidSearchEvidence(crewJobSearchResults)
  const [teamLaborSearch, setTeamLaborSearch] = useState('')
  const [breakdownModal, setBreakdownModal] = useState<{
    jobId: string
    jobName: string
    type: 'hours' | 'cost' | 'sessions'
  } | null>(null)
  const [approvedSessionsState, setApprovedSessionsState] = useState<{
    rows: JobDetailClockSessionRow[]
    truncated: boolean
  } | null>(null)
  const [approvedSessionsLoading, setApprovedSessionsLoading] = useState(false)
  const [approvedSessionsError, setApprovedSessionsError] = useState<string | null>(null)
  const [teamLaborOpen, setTeamLaborOpen] = useState(true)
  const [crewJobDetailsMap, setCrewJobDetailsMap] = useState<Record<string, JobDetails>>({})
  const [crewBidDetailsMap, setCrewBidDetailsMap] = useState<Record<string, BidDetails>>({})
  const [teamLaborData, setTeamLaborData] = useState<TeamLaborRow[]>([])
  const [teamLaborLoading, setTeamLaborLoading] = useState(false)
  /** Brief visual emphasis after deep-link scroll (cleared after a few seconds). */
  const [teamLaborHighlightJobId, setTeamLaborHighlightJobId] = useState<string | null>(null)
  const [hideZeroHours, setHideZeroHours] = useState(true)
  const [crewDateHours, setCrewDateHours] = useState<Record<string, number>>({})
  const [crewJobsSectionOpen, setCrewJobsSectionOpen] = useState(true)
  /**
   * v2.2962: the selected date's approved closed sessions grouped by trimmed
   * user name (the crew-row key). Drives the Assignments cell: unlinked sessions
   * → the `+` links them; all linked → locked (⏱ from clock, v2.1636's rule —
   * `sync_crew_jobs_from_clock` recomputes the day on every approval/adjust);
   * none → no split may be created here. Fail-soft: a fetch error leaves it
   * empty, so every row reads "No clock session" until the next load.
   */
  const [daySessionsByPerson, setDaySessionsByPerson] = useState<Record<string, PersonDaySessions>>({})
  /** Split day…: the shared day editor for one person's sessions on `crewJobsDate`. */
  const [dayEditor, setDayEditor] = useState<{ personName: string; userId: string } | null>(null)
  const { showToast } = useToastContext()

  const canEdit = canEditProp ?? canAccess

  const showPeopleForMatrix = useMemo(() => {
    if (peopleProp && peopleProp.length > 0) return peopleProp
    return Object.keys(payConfig)
      .sort((a, b) => {
        const orderA = hoursDisplayOrder[a] ?? 999999
        const orderB = hoursDisplayOrder[b] ?? 999999
        return orderA !== orderB ? orderA - orderB : a.localeCompare(b)
      })
  }, [peopleProp, payConfig, hoursDisplayOrder])

  const effectiveCrewHours = useMemo(() => {
    if (crewHoursByPersonProp) return crewHoursByPersonProp
    return crewDateHours
  }, [crewHoursByPersonProp, crewDateHours])

  /** C1-3a: id-first flag lookup (crew-row person_id), trimmed-name fallback. */
  const cfgForPerson = useCallback(
    (personName: string): PayConfigRow | undefined => {
      const id = crewPersonIdByName[personName]
      return (id ? payConfigById[id] : undefined) ?? payConfig[personName]
    },
    [crewPersonIdByName, payConfigById, payConfig],
  )

  const dayEditorJobLabels = useMemo(
    () => Object.fromEntries(Object.entries(crewJobDetailsMap).map(([id, d]) => [id, formatAssignmentLabel('job', d, prefixMap)])),
    [crewJobDetailsMap, prefixMap],
  )
  const dayEditorBidLabels = useMemo(
    () => Object.fromEntries(Object.entries(crewBidDetailsMap).map(([id, d]) => [id, formatAssignmentLabel('bid', d, prefixMap)])),
    [crewBidDetailsMap, prefixMap],
  )

  const visiblePeopleForCrew = useMemo(() => {
    // Cost semantics on purpose: salaried people count as 8/0 here even with record_hours_but_salary.
    return showPeopleForMatrix.filter(
      (p) => !hideZeroHours || effectiveHoursForCost(cfgForPerson(p), crewJobsDate, effectiveCrewHours[p] ?? 0) > 0,
    )
  }, [showPeopleForMatrix, hideZeroHours, crewJobsDate, effectiveCrewHours, cfgForPerson])

  const filteredTeamLaborData = useMemo(() => {
    if (!jobIdsFilter || jobIdsFilter.length === 0) return teamLaborData
    const set = new Set(jobIdsFilter)
    return teamLaborData.filter((r) => set.has(r.jobId))
  }, [teamLaborData, jobIdsFilter])

  const onFocusTeamLaborConsumedRef = useRef(onFocusTeamLaborConsumed)
  onFocusTeamLaborConsumedRef.current = onFocusTeamLaborConsumed
  const teamLaborFocusHandledRef = useRef<string | null>(null)
  /** True after first `doLoadTeamLaborData` completes, or when user cannot load team labor (no access). */
  const teamLaborFetchFinishedRef = useRef(false)
  const teamLaborHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => {
    const raw = focusTeamLaborJobId?.trim() ?? ''
    if (!raw) {
      teamLaborFocusHandledRef.current = null
      return
    }
    if (teamLaborLoading) {
      return
    }
    if (teamLaborFocusHandledRef.current === raw) {
      return
    }

    const inFiltered = filteredTeamLaborData.some((r) => r.jobId === raw)
    if (!inFiltered) {
      if (!teamLaborFetchFinishedRef.current) {
        return
      }
      teamLaborFocusHandledRef.current = raw
      onFocusTeamLaborConsumedRef.current?.()
      return
    }

    const q = teamLaborSearch.trim().toLowerCase()
    if (q) {
      const matchesSearch = (r: TeamLaborRow) =>
        (r.hcpNumber ?? '').toLowerCase().includes(q) ||
        (r.jobName ?? '').toLowerCase().includes(q) ||
        (r.jobAddress ?? '').toLowerCase().includes(q)
      const visible = filteredTeamLaborData.some((r) => r.jobId === raw && matchesSearch(r))
      if (!visible) {
        setTeamLaborSearch('')
        return
      }
    }

    teamLaborFocusHandledRef.current = raw
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const el = document.querySelector(`[data-team-labor-job-id="${CSS.escape(raw)}"]`)
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          if (el) {
            if (teamLaborHighlightTimerRef.current) {
              clearTimeout(teamLaborHighlightTimerRef.current)
              teamLaborHighlightTimerRef.current = null
            }
            setTeamLaborHighlightJobId(raw)
            teamLaborHighlightTimerRef.current = setTimeout(() => {
              teamLaborHighlightTimerRef.current = null
              setTeamLaborHighlightJobId((cur) => (cur === raw ? null : cur))
            }, 3200)
          }
          onFocusTeamLaborConsumedRef.current?.()
        }, 0)
      })
    })
  }, [focusTeamLaborJobId, teamLaborLoading, filteredTeamLaborData, teamLaborSearch, jobIdsFilter])

  async function loadAccess() {
    if (!authUser?.id) {
      setCrewPayAccessResolved(true)
      return
    }
    try {
      const [meRes, approvedRes] = await Promise.all([
        supabase.from('users').select('role').eq('id', authUser.id).single(),
        supabase.from('pay_approved_masters').select('master_id'),
      ])
      const role = (meRes.data as { role?: string } | null)?.role ?? null
      const approvedIds = new Set((approvedRes.data ?? []).map((r: { master_id: string }) => r.master_id))
      let canAccessPay = false
      if (role === 'dev') canAccessPay = true
      else if (role === 'master_technician' && approvedIds.has(authUser.id)) canAccessPay = true
      else if (isAssistantLike(role)) canAccessPay = true
      setCanAccess(canAccessPay)
    } finally {
      setCrewPayAccessResolved(true)
    }
  }

  async function loadPayConfig() {
    // RPC (non-wage flags only): assistants can't SELECT people_pay_config since the pay lockdown (v2.660).
    const { data, error: err } = await supabase.rpc('list_people_pay_flags')
    if (err) {
      setError(err.message)
      return
    }
    // C1-3a (identity): the RPC returns person_id — keep a SEPARATE id-keyed
    // map for id-first lookups. It must not share the name map:
    // showPeopleForMatrix derives the people list from Object.keys(payConfig),
    // so id entries there would render as bogus rows.
    const map: Record<string, PayConfigRow> = {}
    const byId: Record<string, PayConfigRow> = {}
    for (const r of (data ?? []) as Array<PayConfigRow & { person_id?: string | null }>) {
      map[r.person_name] = r
      if (r.person_id) byId[r.person_id] = r
    }
    setPayConfig(map)
    setPayConfigById(byId)
  }

  async function loadHoursDisplayOrder() {
    const { data } = await supabase.from('people_hours_display_order').select('person_name, sequence_order')
    const map: Record<string, number> = {}
    for (const r of (data ?? []) as { person_name: string; sequence_order: number }[]) {
      map[r.person_name] = r.sequence_order
    }
    setHoursDisplayOrder(map)
  }

  async function loadCrewJobs(date: string) {
    setCrewJobsLoading(true)
    const [jobsRes, bidsRes, hoursRes, sessionsRes] = await Promise.all([
      supabase.from('people_crew_jobs').select('person_name, person_id, job_assignments').eq('work_date', date),
      supabase.from('people_crew_bids').select('person_name, person_id, bid_assignments').eq('work_date', date),
      supabase.from('people_hours').select('person_name, hours').eq('work_date', date),
      supabase
        .from('clock_sessions')
        .select('id, user_id, job_ledger_id, bid_id, clocked_in_at, clocked_out_at, users!clock_sessions_user_id_fkey(name)')
        .eq('work_date', date)
        .not('approved_at', 'is', null)
        .not('clocked_out_at', 'is', null)
        .is('rejected_at', null)
        .is('revoked_at', null),
    ])
    setCrewJobsLoading(false)
    setDaySessionsByPerson(groupCrewDaySessionsByPerson((sessionsRes.data ?? []) as unknown as CrewDaySession[]))
    const { data: jobsData, error: jobsErr } = jobsRes
    const { data: bidsData, error: bidsErr } = bidsRes
    if (jobsErr || bidsErr) {
      setError(jobsErr?.message ?? bidsErr?.message ?? 'Failed to load crew data')
      return
    }
    const jobsRows = (jobsData ?? []) as Array<{
      person_name: string
      person_id: string | null
      job_assignments: Array<{ job_id: string; pct: number }>
    }>
    const bidsRows = (bidsData ?? []) as Array<{
      person_name: string
      person_id: string | null
      bid_assignments: Array<{ bid_id: string; pct: number }>
    }>
    const idByName: Record<string, string> = {}
    const jobsByPerson: Record<string, Array<{ job_id: string; pct: number }>> = {}
    for (const r of jobsRows) {
      jobsByPerson[r.person_name] = Array.isArray(r.job_assignments) ? r.job_assignments : []
      if (r.person_id && !idByName[r.person_name]) idByName[r.person_name] = r.person_id
    }
    const bidsByPerson: Record<string, Array<{ bid_id: string; pct: number }>> = {}
    for (const r of bidsRows) {
      bidsByPerson[r.person_name] = Array.isArray(r.bid_assignments) ? r.bid_assignments : []
      if (r.person_id && !idByName[r.person_name]) idByName[r.person_name] = r.person_id
    }
    setCrewPersonIdByName(idByName)
    const allPersonNames = new Set([...Object.keys(jobsByPerson), ...Object.keys(bidsByPerson)])
    const map: Record<string, CrewRow> = {}
    for (const personName of allPersonNames) {
      const unified = mergeToUnified(jobsByPerson[personName] ?? [], bidsByPerson[personName] ?? [])
      map[personName] = { unifiedAssignments: unified }
    }
    setCrewJobsData(map)
    if (!crewHoursByPersonProp) {
      const hoursRows = (hoursRes.data ?? []) as Array<{ person_name: string; hours: number }>
      const hoursMap: Record<string, number> = {}
      for (const h of hoursRows) hoursMap[h.person_name] = h.hours
      setCrewDateHours(hoursMap)
    }
  }

  function getAssignmentKey(a: UnifiedAssignment): string {
    return `${a.type}:${a.id}`
  }

  async function doLoadTeamLaborData() {
    setTeamLaborLoading(true)
    try {
      const rows = await loadTeamLaborData(supabase)
      setTeamLaborData(rows)
    } finally {
      setTeamLaborLoading(false)
      teamLaborFetchFinishedRef.current = true
    }
  }

  const refreshCrewFromRealtimeRef = useRef<() => void>(() => {})
  refreshCrewFromRealtimeRef.current = () => {
    void loadCrewJobs(crewJobsDate)
    void doLoadTeamLaborData()
  }

  async function reloadAfterCrewChange() {
    await Promise.all([loadCrewJobs(crewJobsDate), doLoadTeamLaborData()])
    onCrewJobsChange?.()
  }

  /**
   * v2.2962: the only direct crew-table write left. Empties a legacy hand-entered
   * split for a person-day that has NO approved session (a row the sync trigger
   * would never rewrite). Removes a split; never creates one.
   */
  async function clearManualCrewRow(personName: string) {
    if (!canEdit) return
    if (crewAssignCellState(daySessionsByPerson[personName.trim()]).kind !== 'no-clock') return
    const [jobsErr, bidsErr] = await Promise.all([
      supabase
        .from('people_crew_jobs')
        .upsert({ work_date: crewJobsDate, person_name: personName, job_assignments: [] }, { onConflict: 'work_date,person_name' })
        .then((r) => r.error),
      supabase
        .from('people_crew_bids')
        .upsert({ work_date: crewJobsDate, person_name: personName, bid_assignments: [] }, { onConflict: 'work_date,person_name' })
        .then((r) => r.error),
    ])
    if (jobsErr || bidsErr) {
      setError(jobsErr?.message ?? bidsErr?.message ?? 'Failed to clear')
      return
    }
    await reloadAfterCrewChange()
  }

  function pickLabel(item: CrewPick): string {
    return item.type === 'job'
      ? formatAssignmentLabel('job', { hcp_number: item.hcp_number, job_name: item.job_name, job_address: item.job_address, service_type_id: item.service_type_id ?? null }, prefixMap)
      : formatAssignmentLabel('bid', { bid_number: item.bid_number, project_name: item.project_name, address: item.address, service_type_id: item.service_type_id ?? null }, prefixMap)
  }

  /**
   * v2.2962: `+` → link every approved, still-unlinked session the person has
   * that day to the pick. `clock_sessions_sync_crew_assignments_tr` then rewrites
   * the person-day split from session durations; this only reloads. The split is
   * never written by hand here — no session, no split.
   */
  async function linkSessionsToPick(personName: string, item: CrewPick) {
    if (!canEdit) return
    const state = crewAssignCellState(daySessionsByPerson[personName.trim()])
    if (state.kind !== 'link') {
      showToast(
        state.kind === 'no-clock'
          ? `${personName} has no approved clock session on this day — nothing to assign.`
          : `${personName}'s sessions are all linked — use Split day… to change the split.`,
        'warning',
      )
      return
    }
    if (item.type === 'job') {
      setCrewJobDetailsMap((prev) => ({
        ...prev,
        [item.id]: { hcp_number: item.hcp_number, job_name: item.job_name, job_address: item.job_address, service_type_id: item.service_type_id ?? null },
      }))
    } else {
      setCrewBidDetailsMap((prev) => ({
        ...prev,
        [item.id]: { bid_number: item.bid_number, project_name: item.project_name, address: item.address, service_type_id: item.service_type_id ?? null },
      }))
    }
    setCrewJobSearchModal(null)
    setCrewJobSearchText('')
    setCrewJobSearchResults([])
    const { data, error: linkErr } = await supabase.from('clock_sessions').update(crewLinkPatch(item)).in('id', state.unlinkedIds).select('id')
    if (linkErr) {
      setError(linkErr.message)
      showToast(`Could not link ${personName}'s sessions: ${linkErr.message}`, 'error')
      return
    }
    const updated = (data ?? []).length
    if (updated === 0) {
      // RLS: the row policy passes dev, team leads, pay-approved masters and their adopted
      // assistants — a controller outside that set can see the table but not edit the clock.
      showToast(`No sessions were updated — your account can't edit ${personName}'s clock sessions. Ask a pay-approved master to link them.`, 'warning', 8000)
      return
    }
    if (updated < state.unlinkedIds.length) {
      showToast(`Linked ${updated} of ${state.unlinkedIds.length} sessions — the rest are outside your clock-edit access.`, 'warning', 8000)
    } else {
      showToast(crewLinkSuccessMessage(updated, state.unlinkedHours, pickLabel(item)), 'success')
    }
    await reloadAfterCrewChange()
  }

  useEffect(() => {
    loadAccess()
  }, [authUser?.id])

  useEffect(() => {
    return () => {
      if (teamLaborHighlightTimerRef.current) {
        clearTimeout(teamLaborHighlightTimerRef.current)
        teamLaborHighlightTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!canAccess && canEditProp === undefined) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([loadPayConfig(), loadHoursDisplayOrder()]).finally(() => setLoading(false))
  }, [canAccess, canEditProp])

  useEffect(() => {
    if (canAccess || canEditProp) loadCrewJobs(crewJobsDate)
  }, [canAccess, canEditProp, crewJobsDate])

  const crewJobsChannelEnabled = !!(canAccess || canEditProp)
  const crewJobsChannelFilters = useMemo(
    () => [
      { event: '*' as const, schema: 'public', table: 'people_crew_jobs', filter: `work_date=eq.${crewJobsDate}` },
      { event: '*' as const, schema: 'public', table: 'people_crew_bids', filter: `work_date=eq.${crewJobsDate}` },
    ],
    [crewJobsDate],
  )
  useRealtimeChannel(
    crewJobsChannelEnabled,
    `crew-jobs-block-${crewJobsDate}`,
    crewJobsChannelFilters,
    () => refreshCrewFromRealtimeRef.current(),
    { debounceMs: 400 },
  )

  useEffect(() => {
    if (canAccess || canEditProp) doLoadTeamLaborData()
  }, [canAccess, canEditProp])

  useEffect(() => {
    if (!crewPayAccessResolved) return
    if (!(canAccess || canEditProp)) {
      teamLaborFetchFinishedRef.current = true
    }
  }, [crewPayAccessResolved, canAccess, canEditProp])

  useEffect(() => {
    const jobIds = new Set<string>()
    const bidIds = new Set<string>()
    for (const row of Object.values(crewJobsData)) {
      for (const a of row.unifiedAssignments) {
        if (a.type === 'job') jobIds.add(a.id)
        else bidIds.add(a.id)
      }
    }
    const missingJobs = [...jobIds].filter((id) => !crewJobDetailsMap[id])
    const missingBids = [...bidIds].filter((id) => !crewBidDetailsMap[id])
    if (missingJobs.length > 0) {
      supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: missingJobs }).then(({ data }) => {
        const map: Record<string, JobDetails> = {}
        for (const r of (data ?? []) as Array<{
          id: string
          hcp_number: string
          job_name: string
          job_address: string
          service_type_id: string | null
          click_number: string
        }>) {
          map[r.id] = {
            hcp_number: r.hcp_number ?? '',
            job_name: r.job_name ?? '',
            job_address: r.job_address ?? '',
            service_type_id: r.service_type_id,
            click_number: r.click_number,
          }
        }
        setCrewJobDetailsMap((prev) => ({ ...prev, ...map }))
      })
    }
    if (missingBids.length > 0) {
      supabase.rpc('get_bids_by_ids', { p_bid_ids: missingBids }).then(({ data }) => {
        const map: Record<string, BidDetails> = {}
        for (const r of (data ?? []) as Array<{
          id: string
          bid_number: string
          project_name: string
          address: string
          service_type_id: string | null
        }>) {
          map[r.id] = {
            bid_number: r.bid_number ?? '',
            project_name: r.project_name ?? '',
            address: r.address ?? '',
            service_type_id: r.service_type_id,
          }
        }
        setCrewBidDetailsMap((prev) => ({ ...prev, ...map }))
      })
    }
  }, [crewJobsData])

  useEffect(() => {
    const t = setTimeout(() => {
      if (crewJobSearchModal && crewJobSearchText !== undefined) {
        const q = crewJobSearchText.trim()
        Promise.all([
          supabase.rpc('search_jobs_ledger', { search_text: q }),
          supabase.rpc('search_bids_for_clock', { p_search_text: q }),
        ]).then(([jobsRes, bidsRes]) => {
          const jobs = (jobsRes.data ?? []) as Array<{
            id: string
            hcp_number: string
            job_name: string
            job_address: string
            service_type_id: string | null
            service_type_name?: string | null
            click_number: string
          }>
          const bidsRaw = (bidsRes.data ?? []) as Array<{
            id: string
            bid_number?: string
            project_name: string
            address: string
            customer_name?: string
            service_type_name?: string
            service_type_id: string | null
          }>
          const merged: UnifiedSearchResult[] = [
            ...jobs.map((j) => ({ source: 'job' as const, ...j })),
            ...bidsRaw.map((b) => ({ source: 'bid' as const, ...b, bid_number: b.bid_number ?? '', customer_name: b.customer_name ?? '' })),
          ]
          setCrewJobSearchResults(merged)
        })
      }
    }, 300)
    return () => clearTimeout(t)
  }, [crewJobSearchModal, crewJobSearchText])

  useEffect(() => {
    if (!breakdownModal || breakdownModal.type !== 'sessions') {
      setApprovedSessionsState(null)
      setApprovedSessionsError(null)
      setApprovedSessionsLoading(false)
      return
    }
    const jobId = breakdownModal.jobId
    let cancelled = false
    setApprovedSessionsLoading(true)
    setApprovedSessionsError(null)
    setApprovedSessionsState(null)
    void fetchApprovedClosedClockSessionsForJobLedger(jobId).then((res) => {
      if (cancelled) return
      setApprovedSessionsLoading(false)
      if (res.error) {
        setApprovedSessionsError(res.error)
        return
      }
      setApprovedSessionsState({ rows: res.data, truncated: res.truncated })
    })
    return () => {
      cancelled = true
    }
  }, [breakdownModal])

  if (!canAccess && canEditProp === undefined) return null

  const crewJobsContent = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              const d = new Date(crewJobsDate + 'T12:00:00')
              d.setDate(d.getDate() - 1)
              setCrewJobsDate(d.toLocaleDateString('en-CA'))
            }}
            style={{ padding: '0.35rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
          >
            ←
          </button>
          <input
            type="date"
            value={crewJobsDate}
            onChange={(e) => setCrewJobsDate(e.target.value)}
            style={{ padding: '0.35rem 0.5rem', fontSize: '0.9375rem', fontWeight: 500, border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: 140 }}
          />
          {(() => {
            const { formatted, isTodayOrTomorrow } = formatDateWithRelativeLabel(crewJobsDate)
            return (
              <span
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  color: isTodayOrTomorrow ? 'var(--text-red-700)' : 'var(--text-700)',
                }}
              >
                {formatted}
              </span>
            )
          })()}
          <button
            type="button"
            onClick={() => {
              const d = new Date(crewJobsDate + 'T12:00:00')
              d.setDate(d.getDate() + 1)
              setCrewJobsDate(d.toLocaleDateString('en-CA'))
            }}
            style={{ padding: '0.35rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
          >
            →
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={hideZeroHours} onChange={(e) => setHideZeroHours(e.target.checked)} />
            Hide users with zero hours
          </label>
        </div>
      </div>
      {crewJobsLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : showPeopleForMatrix.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No people in Cost Matrix. Go to People → Pay and check Show in Cost Matrix.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4, marginBottom: '1.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Name</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Hours</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Assignments</th>
              </tr>
            </thead>
            <tbody>
              {visiblePeopleForCrew.map((personName) => {
                const row = crewJobsData[personName] ?? { unifiedAssignments: [] }
                const effectiveHours = effectiveHoursForCost(cfgForPerson(personName), crewJobsDate, effectiveCrewHours[personName] ?? 0)
                const sessionState = crewAssignCellState(daySessionsByPerson[personName.trim()])
                const chips = row.unifiedAssignments.map((a) => {
                  const details = a.type === 'job' ? crewJobDetailsMap[a.id] : crewBidDetailsMap[a.id]
                  const label = formatAssignmentLabel(a.type, details, prefixMap) || a.id.slice(0, 8)
                  const titleAttr = a.type === 'job' ? (details as JobDetails | undefined)?.job_address : (details as BidDetails | undefined)?.address
                  return (
                    <span
                      key={getAssignmentKey(a)}
                      title={titleAttr}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.2rem 0.4rem',
                        background: 'var(--bg-muted)',
                        borderRadius: 4,
                        fontSize: '0.8125rem',
                      }}
                    >
                      {label}
                      <span style={{ color: 'var(--text-muted)' }}>{a.pct}%</span>
                    </span>
                  )
                })
                const hasManualRow = sessionState.kind === 'no-clock' && row.unifiedAssignments.length > 0
                const smallButton = {
                  padding: '0.2rem 0.5rem',
                  borderRadius: 4,
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                } as const
                return (
                  <tr key={personName} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem' }}>{personName}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                      {effectiveHours > 0 ? effectiveHours.toFixed(2) : '—'}
                    </td>
                    <td style={{ padding: '0.75rem', background: !canEdit ? 'var(--bg-muted)' : undefined }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' }}>
                        {sessionState.kind !== 'no-clock' && sessionState.linkedCount > 0 && (
                          <span
                            title="This day's split comes from approved clock sessions and recomputes on every approval or time adjustment. To move hours between jobs, split a session (Split day…) or link the unlinked ones."
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              padding: '0.1rem 0.45rem',
                              borderRadius: 999,
                              background: 'var(--bg-blue-tint)',
                              color: 'var(--text-link)',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              cursor: 'help',
                            }}
                          >
                            ⏱ from clock
                          </span>
                        )}
                        {hasManualRow && (
                          <span
                            title="A hand-entered split with no approved clock session behind it. Clear it — the hours stay unassigned until a session is approved and linked."
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.1rem 0.45rem',
                              borderRadius: 999,
                              background: 'var(--bg-muted)',
                              color: 'var(--text-muted)',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              cursor: 'help',
                            }}
                          >
                            manual · no clock
                          </span>
                        )}
                        {chips}
                        {chips.length === 0 && sessionState.kind === 'locked' && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        {sessionState.kind === 'no-clock' && !hasManualRow && (
                          <span
                            title="No approved clock session for this person on this day — there is no split without a clock session. Approve their session first (People → Hours or the clock strip), then link it here."
                            style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', cursor: 'help' }}
                          >
                            No clock session
                          </span>
                        )}
                        {canEdit && sessionState.kind === 'link' && (
                          <button
                            type="button"
                            onClick={() => {
                              setCrewJobSearchModal({ personName })
                              setCrewJobSearchText('')
                              setCrewJobSearchResults([])
                            }}
                            title="Pick a job or bid — every unlinked approved session that day is linked to it and the split is recomputed from the clock."
                            style={{ ...smallButton, border: '1px dashed var(--border-strong)' }}
                          >
                            + {crewLinkButtonLabel(sessionState)}
                          </button>
                        )}
                        {canEdit && hasManualRow && (
                          <button
                            type="button"
                            onClick={() => void clearManualCrewRow(personName)}
                            title="Remove this hand-entered split"
                            style={{ ...smallButton, border: '1px solid var(--border-strong)' }}
                          >
                            Clear
                          </button>
                        )}
                        {canEdit && sessionState.kind !== 'no-clock' && (
                          <button
                            type="button"
                            onClick={() => {
                              const p = daySessionsByPerson[personName.trim()]
                              if (p) setDayEditor({ personName, userId: p.userId })
                            }}
                            title="Open the day editor to split a session between two jobs, or change which job a session carries"
                            style={{ ...smallButton, border: '1px solid var(--border-strong)', color: 'var(--text-muted)' }}
                          >
                            Split day…
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )

  const teamLaborTable = (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="search"
          placeholder="Search HCP, job name, address…"
          value={teamLaborSearch}
          onChange={(e) => setTeamLaborSearch(e.target.value)}
          style={{ width: '100%', maxWidth: 400, padding: '0.5rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
        />
      </div>
      {teamLaborLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading Team Job Labor…</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Job #</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Job</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>People</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Man Hours</th>
                {!hideJobCostColumn && <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Job Cost</th>}
                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Approved sessions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeamLaborData
                .filter((r) => {
                  const q = teamLaborSearch.trim().toLowerCase()
                  if (!q) return true
                  return (
                    (r.hcpNumber ?? '').toLowerCase().includes(q) ||
                    (r.jobName ?? '').toLowerCase().includes(q) ||
                    (r.jobAddress ?? '').toLowerCase().includes(q)
                  )
                })
                .map((r) => (
                  <tr
                    key={r.jobId}
                    data-team-labor-job-id={r.jobId}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      ...(r.jobId === teamLaborHighlightJobId
                        ? {
                            backgroundColor: 'var(--bg-amber-tint)',
                            boxShadow: 'inset 4px 0 0 0 #ca8a04',
                            transition: 'background-color 0.35s ease, box-shadow 0.35s ease',
                          }
                        : {}),
                    }}
                  >
                    <td style={{ padding: '0.75rem' }}>{r.hcpNumber || '—'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <div>{r.jobName || '—'}</div>
                      {r.jobAddress && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{r.jobAddress}</div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{r.people.join(', ') || '—'}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setBreakdownModal({ jobId: r.jobId, jobName: r.jobName, type: 'hours' })}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: 'var(--text-link)',
                          textDecoration: 'underline',
                          fontSize: 'inherit',
                        }}
                      >
                        {r.manHours.toFixed(2)}
                      </button>
                    </td>
                    {!hideJobCostColumn && (
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => setBreakdownModal({ jobId: r.jobId, jobName: r.jobName, type: 'cost' })}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            color: 'var(--text-link)',
                            textDecoration: 'underline',
                            fontSize: 'inherit',
                          }}
                        >
                          ${formatCurrency(r.jobCost)}
                        </button>
                      </td>
                    )}
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setApprovedSessionsState(null)
                          setApprovedSessionsError(null)
                          setApprovedSessionsLoading(true)
                          setBreakdownModal({ jobId: r.jobId, jobName: r.jobName, type: 'sessions' })
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: 'var(--text-link)',
                          textDecoration: 'underline',
                          fontSize: 'inherit',
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {filteredTeamLaborData.length === 0 && (
            <p style={{ padding: '1rem', color: 'var(--text-muted)', margin: 0 }}>
              No team labor data yet. Add jobs or bids in Crew Jobs / Bids above.
            </p>
          )}
        </div>
      )}
    </>
  )

  return (
    <section style={{ marginBottom: '2rem' }}>
      {showTitle && (
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem', textAlign: 'center' }}>Crew Jobs / Bids</h2>
      )}
      {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <>
          {showCrewJobsSection &&
            (collapsibleCrewJobs ? (
              <div style={{ marginBottom: '1rem', border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setCrewJobsSectionOpen((prev) => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    margin: 0,
                    padding: '1rem',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '0.75rem' }}>{crewJobsSectionOpen ? '▼' : '▶'}</span>
                  Crew Jobs / Bids
                </button>
                {crewJobsSectionOpen && <div style={{ padding: '0 1rem 1rem 1rem' }}>{crewJobsContent}</div>}
              </div>
            ) : (
              crewJobsContent
            ))}
          {showTeamLabor &&
            (collapsibleCrewJobs ? (
              <div style={{ marginTop: '1rem' }}>
                <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Team Job Labor</h2>
                {teamLaborTable}
              </div>
            ) : (
              <div style={{ marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setTeamLaborOpen((prev) => !prev)}
                  aria-expanded={teamLaborOpen}
                  style={{
                    margin: 0,
                    width: '100%',
                    fontSize: '1rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: 'inherit',
                  }}
                >
                  <span aria-hidden>{teamLaborOpen ? '\u25BC' : '\u25B6'}</span>
                  Team Job Labor
                </button>
                {teamLaborOpen && <div style={{ marginTop: '0.75rem' }}>{teamLaborTable}</div>}
              </div>
            ))}
        </>
      )}

      {crewJobSearchModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
        >
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: phoneSafeMinWidth(400), boxSizing: 'border-box', maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>
              {(() => {
                const st = crewAssignCellState(daySessionsByPerson[crewJobSearchModal.personName.trim()])
                const n = st.kind === 'link' ? st.unlinkedIds.length : 0
                return `Link ${crewJobSearchModal.personName}'s ${n === 1 ? 'session' : `${n} sessions`} to a job or bid`
              })()}
            </h3>
            <p style={{ margin: '-0.5rem 0 1rem 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              The pick goes on the clock sessions; the day's split is recomputed from their hours.
            </p>
            <input
              type="search"
              placeholder="Search HCP, bid #, job name, project, address…"
              value={crewJobSearchText}
              onChange={(e) => setCrewJobSearchText(e.target.value)}
              autoFocus
              style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            />
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {crewJobSearchResults.map((item) => (
                <button
                  key={`${item.source}:${item.id}`}
                  type="button"
                  onClick={() => {
                    if (item.source !== 'job' && item.source !== 'bid') return
                    void linkSessionsToPick(
                      crewJobSearchModal!.personName,
                      item.source === 'job'
                        ? {
                            type: 'job',
                            id: item.id,
                            hcp_number: item.hcp_number,
                            job_name: item.job_name,
                            job_address: item.job_address,
                            service_type_id: item.service_type_id ?? null,
                          }
                        : {
                            type: 'bid',
                            id: item.id,
                            bid_number: item.bid_number,
                            project_name: item.project_name,
                            address: item.address,
                            service_type_id: item.service_type_id ?? null,
                          }
                    )
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.5rem',
                    textAlign: 'left',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  <UnifiedSearchResultRow
                    result={item}
                    prefixMap={prefixMap}
                    jobEvidence={item.source === 'job' ? jobEvidence.get(item.id) : null}
                    bidEvidence={item.source === 'bid' ? bidEvidence.get(item.id) : null}
                    evidenceMode={evidenceMode}
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setCrewJobSearchModal(null)
                setCrewJobSearchText('')
                setCrewJobSearchResults([])
              }}
              style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {breakdownModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
        >
          <div role="dialog" aria-modal="true"
            style={{
              background: 'var(--surface)',
              padding: '1.5rem',
              borderRadius: 8,
              minWidth: breakdownModal.type === 'sessions' ? 480 : 360,
              maxWidth: 'min(95vw, 920px)',
              width: breakdownModal.type === 'sessions' ? '100%' : undefined,
            }}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>
              {breakdownModal.type === 'sessions'
                ? `Approved clock sessions — ${breakdownModal.jobName}`
                : `Crew ${breakdownModal.type === 'hours' ? 'Man Hours' : 'Job Cost'} Breakdown for Job ${breakdownModal.jobName}`}
            </h3>
            {breakdownModal.type === 'sessions' ? (
              <>
                {approvedSessionsLoading && <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading…</p>}
                {!approvedSessionsLoading && approvedSessionsError && (
                  <p style={{ color: 'var(--text-red-700)', margin: 0 }}>{approvedSessionsError}</p>
                )}
                {!approvedSessionsLoading && !approvedSessionsError && approvedSessionsState && (
                  <>
                    {approvedSessionsState.rows.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', margin: 0 }}>No approved closed sessions for this job.</p>
                    ) : (
                      <>
                        <div style={{ maxHeight: '60vh', overflow: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead style={{ background: 'var(--bg-subtle)', position: 'sticky', top: 0 }}>
                              <tr>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Work date</th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Person</th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>In</th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Out</th>
                                <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Duration</th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {approvedSessionsState.rows.map((s) => {
                                const notes = (s.notes ?? '').trim()
                                const preview =
                                  notes.length > NOTES_PREVIEW_MAX ? `${notes.slice(0, NOTES_PREVIEW_MAX)}…` : notes || '—'
                                return (
                                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                                    <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{formatTeamLaborWorkDate(s.work_date)}</td>
                                    <td style={{ padding: '0.5rem' }}>{s.users?.name ?? '—'}</td>
                                    <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{formatTeamLaborClockTime(s.clocked_in_at)}</td>
                                    <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{formatTeamLaborClockTime(s.clocked_out_at)}</td>
                                    <td style={{ padding: '0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                      {formatTeamLaborSessionDuration(s.clocked_in_at, s.clocked_out_at)}
                                    </td>
                                    <td
                                      style={{ padding: '0.5rem', maxWidth: 200, wordBreak: 'break-word' }}
                                      title={notes || undefined}
                                    >
                                      {preview}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        {approvedSessionsState.truncated && (
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0.75rem 0 0 0' }}>
                            List shows the first 100 sessions; more exist for this job.
                          </p>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              (() => {
                const row = teamLaborData.find((r) => r.jobId === breakdownModal.jobId)
                if (!row) return <p style={{ color: 'var(--text-muted)' }}>No data</p>
                const items =
                  breakdownModal.type === 'hours'
                    ? row.breakdown.map((b) => ({ ...b, value: b.hours }))
                    : row.breakdown.map((b) => ({ ...b, value: b.cost }))
                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Person</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>{breakdownModal.type === 'hours' ? 'Hours' : 'Cost'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((b) => (
                        <tr key={b.personName} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.5rem' }}>{b.personName}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                            {breakdownModal.type === 'hours' ? b.value.toFixed(2) : `$${formatCurrency(b.value)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              })()
            )}
            <button type="button" onClick={() => setBreakdownModal(null)} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {dayEditor && (
        <DashboardMyTimeDayEditorModal
          dateStr={crewJobsDate}
          sessions={[]}
          subjectUserId={dayEditor.userId}
          subjectDisplayName={dayEditor.personName}
          jobLabels={dayEditorJobLabels}
          bidLabels={dayEditorBidLabels}
          onClose={() => setDayEditor(null)}
          onSaved={() => {
            setDayEditor(null)
            void reloadAfterCrewChange()
          }}
          onLinkedSessionsUpdated={() => void reloadAfterCrewChange()}
        />
      )}
    </section>
  )
}
