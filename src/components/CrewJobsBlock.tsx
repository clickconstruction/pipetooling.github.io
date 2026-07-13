import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  splitFromUnified,
  formatAssignmentLabel,
  type JobDetails,
  type BidDetails,
} from '../utils/crewAssignments'
import { getBidServiceTypeTag } from '../utils/unifiedJobBidSearch'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerShortLine, formatJobLedgerShortLine } from '../lib/ledgerDisplayPrefixes'

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
type PayConfigRow = Pick<PayConfigRowFull, 'person_name' | 'hourly_wage' | 'is_salary' | 'show_in_hours' | 'show_in_cost_matrix'>

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
  const [crewJobSearchResults, setCrewJobSearchResults] = useState<
    Array<
      | { type: 'job'; id: string; hcp_number: string; job_name: string; job_address: string; service_type_id?: string | null; click_number?: string | null }
      | {
          type: 'bid'
          id: string
          bid_number: string
          project_name: string
          address: string
          service_type_name?: string
          service_type_id?: string | null
        }
    >
  >([])
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

  const canEdit = canEditProp ?? canAccess

  const showPeopleForMatrix = useMemo(() => {
    if (peopleProp && peopleProp.length > 0) return peopleProp
    return Object.keys(payConfig)
      .filter((n) => payConfig[n]?.show_in_cost_matrix ?? false)
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

  const visiblePeopleForCrew = useMemo(() => {
    // Cost semantics on purpose: salaried people count as 8/0 here even with record_hours_but_salary.
    return showPeopleForMatrix.filter(
      (p) => !hideZeroHours || effectiveHoursForCost(payConfig[p], crewJobsDate, effectiveCrewHours[p] ?? 0) > 0,
    )
  }, [showPeopleForMatrix, hideZeroHours, crewJobsDate, effectiveCrewHours, payConfig])

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
      const [meRes, approvedRes, sharesRes] = await Promise.all([
        supabase.from('users').select('role').eq('id', authUser.id).single(),
        supabase.from('pay_approved_masters').select('master_id'),
        supabase.from('cost_matrix_teams_shares').select('shared_with_user_id').eq('shared_with_user_id', authUser.id).maybeSingle(),
      ])
      const role = (meRes.data as { role?: string } | null)?.role ?? null
      const approvedIds = new Set((approvedRes.data ?? []).map((r: { master_id: string }) => r.master_id))
      const hasCostMatrixShare = !!sharesRes.data
      const canViewCostMatrixShared = hasCostMatrixShare
      let canAccessPay = false
      if (role === 'dev') canAccessPay = true
      else if (role === 'master_technician' && approvedIds.has(authUser.id)) canAccessPay = true
      else if (role === 'assistant') canAccessPay = true
      setCanAccess(canAccessPay || canViewCostMatrixShared)
    } finally {
      setCrewPayAccessResolved(true)
    }
  }

  async function loadPayConfig() {
    const { data, error: err } = await supabase
      .from('people_pay_config')
      .select('person_name, hourly_wage, is_salary, show_in_hours, show_in_cost_matrix')
    if (err) {
      setError(err.message)
      return
    }
    const map: Record<string, PayConfigRow> = {}
    for (const r of (data ?? []) as PayConfigRow[]) map[r.person_name] = r
    setPayConfig(map)
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
    const [jobsRes, bidsRes, hoursRes] = await Promise.all([
      supabase.from('people_crew_jobs').select('person_name, job_assignments').eq('work_date', date),
      supabase.from('people_crew_bids').select('person_name, bid_assignments').eq('work_date', date),
      supabase.from('people_hours').select('person_name, hours').eq('work_date', date),
    ])
    setCrewJobsLoading(false)
    const { data: jobsData, error: jobsErr } = jobsRes
    const { data: bidsData, error: bidsErr } = bidsRes
    if (jobsErr || bidsErr) {
      setError(jobsErr?.message ?? bidsErr?.message ?? 'Failed to load crew data')
      return
    }
    const jobsRows = (jobsData ?? []) as Array<{
      person_name: string
      job_assignments: Array<{ job_id: string; pct: number }>
    }>
    const bidsRows = (bidsData ?? []) as Array<{
      person_name: string
      bid_assignments: Array<{ bid_id: string; pct: number }>
    }>
    const jobsByPerson: Record<string, Array<{ job_id: string; pct: number }>> = {}
    for (const r of jobsRows) {
      jobsByPerson[r.person_name] = Array.isArray(r.job_assignments) ? r.job_assignments : []
    }
    const bidsByPerson: Record<string, Array<{ bid_id: string; pct: number }>> = {}
    for (const r of bidsRows) {
      bidsByPerson[r.person_name] = Array.isArray(r.bid_assignments) ? r.bid_assignments : []
    }
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

  async function saveCrewRow(personName: string, row: CrewRow) {
    if (!canEdit) return
    setCrewJobsData((prev) => ({ ...prev, [personName]: row }))
    const { jobAssignments, bidAssignments } = splitFromUnified(row.unifiedAssignments)
    const [jobsErr, bidsErr] = await Promise.all([
      supabase
        .from('people_crew_jobs')
        .upsert(
          {
            work_date: crewJobsDate,
            person_name: personName,
            job_assignments: jobAssignments,
          },
          { onConflict: 'work_date,person_name' }
        )
        .then((r) => r.error),
      supabase
        .from('people_crew_bids')
        .upsert(
          {
            work_date: crewJobsDate,
            person_name: personName,
            bid_assignments: bidAssignments,
          },
          { onConflict: 'work_date,person_name' }
        )
        .then((r) => r.error),
    ])
    if (jobsErr || bidsErr) setError(jobsErr?.message ?? bidsErr?.message ?? 'Failed to save')
    else {
      await doLoadTeamLaborData()
      onCrewJobsChange?.()
    }
  }

  function addAssignmentToPerson(
    personName: string,
    item:
      | {
          type: 'job'
          id: string
          hcp_number: string
          job_name: string
          job_address: string
          service_type_id?: string | null
        }
      | {
          type: 'bid'
          id: string
          bid_number: string
          project_name: string
          address: string
          service_type_id?: string | null
        },
  ) {
    const row = crewJobsData[personName] ?? { unifiedAssignments: [] }
    if (row.unifiedAssignments.some((a) => a.type === item.type && a.id === item.id)) return
    const n = row.unifiedAssignments.length + 1
    const pct = Math.round((100 / n) * 10) / 10
    const newAssignments = row.unifiedAssignments.map((a) => ({ ...a, pct }))
    newAssignments.push({
      type: item.type,
      id: item.id,
      pct: Math.round((100 - newAssignments.reduce((s, a) => s + a.pct, 0)) * 10) / 10,
    })
    if (item.type === 'job') {
      setCrewJobDetailsMap((prev) => ({
        ...prev,
        [item.id]: {
          hcp_number: item.hcp_number,
          job_name: item.job_name,
          job_address: item.job_address,
          service_type_id: item.service_type_id ?? null,
        },
      }))
    } else {
      setCrewBidDetailsMap((prev) => ({
        ...prev,
        [item.id]: {
          bid_number: item.bid_number,
          project_name: item.project_name,
          address: item.address,
          service_type_id: item.service_type_id ?? null,
        },
      }))
    }
    saveCrewRow(personName, { ...row, unifiedAssignments: newAssignments })
    setCrewJobSearchModal(null)
    setCrewJobSearchText('')
    setCrewJobSearchResults([])
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
            click_number: string
          }>
          const bidsRaw = (bidsRes.data ?? []) as Array<{
            id: string
            bid_number?: string
            project_name: string
            address: string
            service_type_name?: string
            service_type_id: string | null
          }>
          const bids = bidsRaw.map((b) => ({ ...b, bid_number: b.bid_number ?? '' }))
          const merged = [
            ...jobs.map((j) => ({ type: 'job' as const, ...j })),
            ...bids.map((b) => ({ type: 'bid' as const, ...b })),
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
                const effectiveHours = effectiveHoursForCost(payConfig[personName], crewJobsDate, effectiveCrewHours[personName] ?? 0)
                return (
                  <tr key={personName} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem' }}>{personName}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                      {effectiveHours > 0 ? effectiveHours.toFixed(2) : '—'}
                    </td>
                    <td style={{ padding: '0.75rem', background: !canEdit ? 'var(--bg-muted)' : undefined }}>
                      {canEdit ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' }}>
                          {row.unifiedAssignments.map((a, idx) => {
                            const details = a.type === 'job' ? crewJobDetailsMap[a.id] : crewBidDetailsMap[a.id]
                            const label = formatAssignmentLabel(a.type, details, prefixMap) || a.id.slice(0, 8)
                            const titleAttr = a.type === 'job' ? (details as JobDetails)?.job_address : (details as BidDetails)?.address
                            return (
                              <span
                                key={getAssignmentKey(a)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.2rem 0.4rem',
                                  background: 'var(--bg-muted)',
                                  borderRadius: 4,
                                  fontSize: '0.8125rem',
                                }}
                              >
                                <span title={titleAttr}>{label}</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={a.pct}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value) || 0
                                    const rest = row.unifiedAssignments.filter((_, i) => i !== idx)
                                    const restSum = rest.reduce((s, x) => s + x.pct, 0)
                                    const scale = restSum > 0 ? (100 - v) / restSum : 1
                                    let newAssignments = row.unifiedAssignments.map((x, i) =>
                                      i === idx ? { ...x, pct: v } : { ...x, pct: Math.round(x.pct * scale * 10) / 10 }
                                    )
                                    const sum = newAssignments.reduce((s, x) => s + x.pct, 0)
                                    if (Math.abs(sum - 100) > 0.01 && newAssignments.length > 0) {
                                      const lastIdx = newAssignments.length - 1
                                      newAssignments = newAssignments.map((x, i) =>
                                        i === lastIdx ? { ...x, pct: Math.round((x.pct + (100 - sum)) * 10) / 10 } : x
                                      )
                                    }
                                    saveCrewRow(personName, { ...row, unifiedAssignments: newAssignments })
                                  }}
                                  style={{ width: 44, padding: '0.15rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                                />
                                %
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rest = row.unifiedAssignments.filter((_, i) => i !== idx)
                                    if (rest.length === 0) {
                                      saveCrewRow(personName, { ...row, unifiedAssignments: [] })
                                      return
                                    }
                                    const n = rest.length
                                    const pctEach = Math.round((100 / n) * 10) / 10
                                    const newAssignments = rest.map((x, i) => ({
                                      ...x,
                                      pct: i === n - 1 ? Math.round((100 - (n - 1) * pctEach) * 10) / 10 : pctEach,
                                    }))
                                    saveCrewRow(personName, { ...row, unifiedAssignments: newAssignments })
                                  }}
                                  style={{
                                    padding: '0.1rem 0.25rem',
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.875rem',
                                    lineHeight: 1,
                                  }}
                                  title="Remove"
                                >
                                  ×
                                </button>
                              </span>
                            )
                          })}
                          <button
                            type="button"
                            onClick={() => {
                              setCrewJobSearchModal({ personName })
                              setCrewJobSearchText('')
                              setCrewJobSearchResults([])
                            }}
                            style={{
                              padding: '0.2rem 0.5rem',
                              border: '1px dashed var(--border-strong)',
                              borderRadius: 4,
                              background: 'var(--surface)',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                            }}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                          {row.unifiedAssignments.length > 0
                            ? row.unifiedAssignments
                                .map((a) => {
                                  const details = a.type === 'job' ? crewJobDetailsMap[a.id] : crewBidDetailsMap[a.id]
                                  return formatAssignmentLabel(a.type, details, prefixMap)
                                })
                                .join(', ')
                            : '—'}
                        </span>
                      )}
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
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>HCP</th>
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
                            backgroundColor: '#fef9c3',
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
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Add job or bid for {crewJobSearchModal.personName}</h3>
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
                  key={`${item.type}:${item.id}`}
                  type="button"
                  onClick={() =>
                    addAssignmentToPerson(
                      crewJobSearchModal!.personName,
                      item.type === 'job'
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
                  }
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
                  <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {item.type === 'bid' && (() => {
                      const t = getBidServiceTypeTag(item.service_type_name)
                      return t ? (
                        <span style={{ padding: '0.1rem 0.35rem', fontSize: '0.6875rem', fontWeight: 500, background: t.color, color: '#fff', borderRadius: 4 }}>
                          [{t.tag}]
                        </span>
                      ) : null
                    })()}
                    {item.type === 'job'
                      ? formatJobLedgerShortLine(prefixMap, item.service_type_id ?? null, item.hcp_number, item.job_name, item.click_number)
                      : formatBidLedgerShortLine(prefixMap, item.service_type_id ?? null, item.bid_number, item.project_name)}
                  </div>
                  {(item.type === 'job' ? item.job_address : item.address) && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {item.type === 'job' ? item.job_address : item.address}
                    </div>
                  )}
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
          <div
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
    </section>
  )
}
