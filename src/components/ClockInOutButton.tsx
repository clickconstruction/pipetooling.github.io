import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useDailyGoalsGate } from '../contexts/DailyGoalsGateContext'
import { useToastContext } from '../contexts/ToastContext'
import {
  formatUnifiedResult,
  formatUnifiedJobSchedulePrimaryLine,
  getBidServiceTypeTag,
  type JobSearchResult,
  type BidSearchResult,
  type UnifiedSearchResult,
} from '../utils/unifiedJobBidSearch'
import { getTeamFeedbackEligibility } from '../lib/teamFeedback'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { denverCalendarDayKey } from '../utils/dateUtils'
import {
  fetchDispatchScheduledJobsForAssigneeDay,
  type DispatchScheduledJobForAssign,
} from '../lib/jobScheduleBlocks'
import { fetchWorkingBoardClockBidPicks, type WorkingBoardClockBidPick } from '../lib/fetchWorkingBoardClockBidPicks'
import { syncSalaryClockSessionsForUserDay } from '../lib/salaryScheduleSync'
import {
  scheduleClockInLocationPatch,
  scheduleClockOutLocationPatch,
  scheduleUpdateFocusLocationPatches,
} from '../lib/patchClockPunchSessionLocations'
import { buildClockBidsSearchParams } from '../lib/clockBidsSearchParams'
import BidServiceTypeSearchToggles from './BidServiceTypeSearchToggles'
import TeamFeedbackWizard from './team-feedback/TeamFeedbackWizard'

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

type OpenSession = {
  id: string
  clocked_in_at: string
  work_date: string
  notes: string
  job_ledger_id: string | null
  bid_id: string | null
}

type TodaySession = {
  id: string
  clocked_in_at: string
  clocked_out_at: string | null
  work_date?: string
  notes: string
  origin?: string
  job_ledger_id: string | null
  bid_id: string | null
}

function dispatchScheduledJobToUnified(d: DispatchScheduledJobForAssign): Extract<UnifiedSearchResult, { source: 'job' }> {
  return {
    source: 'job',
    id: d.jobId,
    hcp_number: d.hcp_number,
    job_name: d.job_name,
    job_address: d.job_address,
  }
}

function computeTotalSecondsToday(sessions: TodaySession[]): number {
  const now = Date.now()
  return sessions.reduce((sum, s) => {
    const inMs = new Date(s.clocked_in_at).getTime()
    const outMs = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : now
    return sum + Math.floor((outMs - inMs) / 1000)
  }, 0)
}

type Props = {
  userId: string
  userName: string | null
  /** Opens My Time day editor (e.g. Dashboard read-only preview). */
  onOpenMyTimeDayEditor?: () => void
  /** Called after a successful clock-in (new open session), after sessions refresh. */
  onClockInSuccess?: () => void
}

export default function ClockInOutButton({ userId, userName, onOpenMyTimeDayEditor, onClockInSuccess }: Props) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const { notifyFirstClockInOfDay } = useDailyGoalsGate()
  const [openSession, setOpenSession] = useState<OpenSession | null>(null)
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([])
  const [totalSecondsToday, setTotalSecondsToday] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clockInModalOpen, setClockInModalOpen] = useState(false)
  const [clockInNotes, setClockInNotes] = useState('')
  const [clockInError, setClockInError] = useState<string | null>(null)
  const clockInNotesRef = useRef<HTMLTextAreaElement>(null)
  const [updateFocusModalOpen, setUpdateFocusModalOpen] = useState(false)
  const [updateFocusNotes, setUpdateFocusNotes] = useState('')
  const [updateFocusError, setUpdateFocusError] = useState<string | null>(null)
  const [updateFocusLoading, setUpdateFocusLoading] = useState(false)
  const updateFocusNotesRef = useRef<HTMLTextAreaElement>(null)
  const [clockOutReviewOpen, setClockOutReviewOpen] = useState(false)
  const [clockOutReviewNotes, setClockOutReviewNotes] = useState('')
  const [clockOutReviewError, setClockOutReviewError] = useState<string | null>(null)
  const [clockOutSaving, setClockOutSaving] = useState(false)
  const clockOutNotesRef = useRef<HTMLTextAreaElement>(null)
  const [unifiedSearchText, setUnifiedSearchText] = useState('')
  const [unifiedSearchResults, setUnifiedSearchResults] = useState<UnifiedSearchResult[]>([])
  const [selectedAssociation, setSelectedAssociation] = useState<UnifiedSearchResult | null>(null)
  const [serviceTypes, setServiceTypes] = useState<Array<{ id: string; name: string }>>([])
  const [enabledBidServiceTypeIds, setEnabledBidServiceTypeIds] = useState<string[]>([])
  const [subcontractorServiceTypeIds, setSubcontractorServiceTypeIds] = useState<string[] | null>(null)
  const [lastSelectedJobBid, setLastSelectedJobBid] = useState<UnifiedSearchResult | null>(null)
  const assignedJobsShownRef = useRef(false)
  const assignedJobsFetchGenRef = useRef(0)
  const showToastRef = useRef(showToast)
  showToastRef.current = showToast
  const noAssignedJobsInfoToastShownRef = useRef(false)
  const unifiedSearchTextRef = useRef(unifiedSearchText)
  unifiedSearchTextRef.current = unifiedSearchText
  const [assignedJobsListLoading, setAssignedJobsListLoading] = useState(false)
  const [scheduledDispatchJobs, setScheduledDispatchJobs] = useState<DispatchScheduledJobForAssign[]>([])
  const [workingBoardBidPicks, setWorkingBoardBidPicks] = useState<WorkingBoardClockBidPick[]>([])
  const lastDefaultUnifiedResultsRef = useRef<UnifiedSearchResult[]>([])
  const useLastHiddenBySchedule = useMemo(() => {
    if (lastSelectedJobBid?.source !== 'job') return false
    return scheduledDispatchJobs.some((d) => d.jobId === lastSelectedJobBid.id)
  }, [lastSelectedJobBid, scheduledDispatchJobs])
  const [teamFeedbackOpen, setTeamFeedbackOpen] = useState(false)
  const [salaryUiActive, setSalaryUiActive] = useState(false)

  function parseLastJobBidFromStorage(raw: string | null): UnifiedSearchResult | null {
    if (!raw?.trim()) return null
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object') return null
      const o = parsed as Record<string, unknown>
      const source = o.source
      const id = o.id
      if (source === 'job' && typeof id === 'string') {
        if (typeof o.hcp_number === 'string' && typeof o.job_name === 'string' && typeof o.job_address === 'string') {
          return { source: 'job', id, hcp_number: o.hcp_number, job_name: o.job_name, job_address: o.job_address }
        }
      }
      if (source === 'bid' && typeof id === 'string') {
        if (
          typeof o.bid_number === 'string' &&
          typeof o.project_name === 'string' &&
          typeof o.address === 'string' &&
          typeof o.customer_name === 'string'
        ) {
          return {
            source: 'bid',
            id,
            bid_number: o.bid_number,
            project_name: o.project_name,
            address: o.address,
            customer_name: o.customer_name,
            service_type_name: typeof o.service_type_name === 'string' ? o.service_type_name : null,
          }
        }
      }
    } catch {
      // ignore parse errors
    }
    return null
  }

  useEffect(() => {
    if (!userId || typeof localStorage === 'undefined') return
    const stored = localStorage.getItem(`clock_in_last_job_bid_${userId}`)
    setLastSelectedJobBid(parseLastJobBidFromStorage(stored))
  }, [userId])

  const fetchSessions = useCallback(async () => {
    if (!userId) return
    const today = denverCalendarDayKey(Date.now())

    const [openResult, todayResult] = await Promise.all([
      (async (): Promise<
        | { ok: true; row: TodaySession | null }
        | { ok: false; error: unknown }
      > => {
        try {
          const row = await withSupabaseRetry(
            async () =>
              supabase
                .from('clock_sessions')
                .select('id, clocked_in_at, clocked_out_at, work_date, notes, job_ledger_id, bid_id, origin')
                .eq('user_id', userId)
                .is('clocked_out_at', null)
                .is('rejected_at', null)
                .is('revoked_at', null)
                .order('clocked_in_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
            'clock_sessions open for user'
          )
          return { ok: true, row: (row ?? null) as TodaySession | null }
        } catch (e) {
          return { ok: false, error: e }
        }
      })(),
      (async (): Promise<
        | { ok: true; sessions: TodaySession[] }
        | { ok: false; error: unknown }
      > => {
        try {
          const rows = await withSupabaseRetry(
            async () =>
              supabase
                .from('clock_sessions')
                .select('id, clocked_in_at, clocked_out_at, notes, job_ledger_id, bid_id, origin')
                .eq('user_id', userId)
                .eq('work_date', today),
            'clock_sessions today for user'
          )
          return { ok: true, sessions: (rows ?? []) as TodaySession[] }
        } catch (e) {
          return { ok: false, error: e }
        }
      })(),
    ])

    const errParts: string[] = []
    if (!openResult.ok) {
      errParts.push(formatErrorMessage(openResult.error, 'Could not load open clock session'))
    }
    if (!todayResult.ok) {
      errParts.push(formatErrorMessage(todayResult.error, 'Could not load today clock sessions'))
    }
    setError(errParts.length > 0 ? errParts.join(' ') : null)

    if (openResult.ok) {
      const open = openResult.row
      if (open && !open.clocked_out_at) {
        setOpenSession({
          id: open.id,
          clocked_in_at: open.clocked_in_at,
          work_date: open.work_date?.trim() || denverCalendarDayKey(new Date(open.clocked_in_at).getTime()),
          notes: open.notes ?? '',
          job_ledger_id: open.job_ledger_id,
          bid_id: open.bid_id,
        })
      } else {
        setOpenSession(null)
      }
    }

    if (todayResult.ok) {
      const sessions = todayResult.sessions
      setTodaySessions(sessions)
      setTotalSecondsToday(sessions.length > 0 ? computeTotalSecondsToday(sessions) : 0)
    }
  }, [userId])

  useEffect(() => {
    if (!userId || !userName?.trim()) {
      setSalaryUiActive(false)
      return
    }
    let cancelled = false
    void (async () => {
      const [pay, tmpl] = await Promise.all([
        supabase.from('people_pay_config').select('is_salary').eq('person_name', userName.trim()).maybeSingle(),
        supabase.from('salary_work_schedule_templates').select('user_id').eq('user_id', userId).maybeSingle(),
      ])
      if (cancelled) return
      const sal = !!pay.data?.is_salary
      setSalaryUiActive(sal && !!tmpl.data)
    })()
    return () => {
      cancelled = true
    }
  }, [userId, userName])

  useEffect(() => {
    if (!salaryUiActive || !userId) return
    void syncSalaryClockSessionsForUserDay(userId).then(() => {
      void fetchSessions()
    })
    const t = window.setInterval(() => {
      void syncSalaryClockSessionsForUserDay(userId).then(() => {
        void fetchSessions()
      })
    }, 90_000)
    return () => window.clearInterval(t)
  }, [salaryUiActive, userId, fetchSessions])

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    void fetchSessions().finally(() => setLoading(false))
  }, [userId, fetchSessions])

  useEffect(() => {
    if (!openSession && todaySessions.length === 0) return
    const interval = setInterval(() => {
      setTotalSecondsToday(computeTotalSecondsToday(todaySessions))
    }, 1000)
    return () => clearInterval(interval)
  }, [openSession, todaySessions])

  useEffect(() => {
    if (clockInModalOpen) {
      setClockInNotes('')
      setClockInError(null)
      setUnifiedSearchText('')
      setUnifiedSearchResults([])
      setSelectedAssociation(null)
    }
  }, [clockInModalOpen])

  useEffect(() => {
    if (clockInModalOpen) {
      const id = setTimeout(() => clockInNotesRef.current?.focus(), 0)
      return () => clearTimeout(id)
    }
  }, [clockInModalOpen])

  useEffect(() => {
    if (clockInModalOpen) {
      const scrollY = window.scrollY
      const prevOverflow = document.body.style.overflow
      const prevPosition = document.body.style.position
      const prevTop = document.body.style.top
      const prevLeft = document.body.style.left
      const prevRight = document.body.style.right

      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'

      return () => {
        document.body.style.overflow = prevOverflow
        document.body.style.position = prevPosition
        document.body.style.top = prevTop
        document.body.style.left = prevLeft
        document.body.style.right = prevRight
        window.scrollTo(0, scrollY)
      }
    }
  }, [clockInModalOpen])

  useEffect(() => {
    if (updateFocusModalOpen) {
      setUpdateFocusError(null)
      setUnifiedSearchText('')
      setUnifiedSearchResults([])
      setSelectedAssociation(null)
    }
  }, [updateFocusModalOpen])

  useEffect(() => {
       if (!clockInModalOpen && !updateFocusModalOpen && !clockOutReviewOpen) {
      setAssignedJobsListLoading(false)
      setScheduledDispatchJobs([])
      setWorkingBoardBidPicks([])
      noAssignedJobsInfoToastShownRef.current = false
      return
    }
    const requestId = ++assignedJobsFetchGenRef.current
    assignedJobsShownRef.current = true
    setAssignedJobsListLoading(true)
    setScheduledDispatchJobs([])
    setWorkingBoardBidPicks([])
    const scheduleYmd =
      clockOutReviewOpen && openSession
        ? openSession.work_date.trim() || denverCalendarDayKey(new Date(openSession.clocked_in_at).getTime())
        : denverCalendarDayKey(Date.now())
    void (async () => {
      try {
        const [data, dispatchRes, workingPicks] = await Promise.all([
          withSupabaseRetry(
            async () => await supabase.rpc('list_assigned_jobs_for_dashboard'),
            'ClockInOutButton list_assigned_jobs_for_dashboard'
          ),
          fetchDispatchScheduledJobsForAssigneeDay(userId, scheduleYmd),
          fetchWorkingBoardClockBidPicks(userId),
        ])
        if (requestId !== assignedJobsFetchGenRef.current) return
        if (unifiedSearchTextRef.current.trim() !== '') return
        const dispatchRows = dispatchRes.error ? [] : dispatchRes.data
        setScheduledDispatchJobs(dispatchRows)
        setWorkingBoardBidPicks(workingPicks)
        const onScheduleIds = new Set(dispatchRows.map((d) => d.jobId))
        const jobs = (data ?? []) as Array<{ id: string; hcp_number: string; job_name: string; job_address: string }>
        const mapped: UnifiedSearchResult[] = jobs.map((j) => ({
          source: 'job' as const,
          id: j.id,
          hcp_number: j.hcp_number ?? '',
          job_name: j.job_name ?? '',
          job_address: j.job_address ?? '',
        }))
        const mappedFiltered = mapped.filter((r) => r.source !== 'job' || !onScheduleIds.has(r.id))
        lastDefaultUnifiedResultsRef.current = mappedFiltered
        setUnifiedSearchResults(mappedFiltered)
        assignedJobsShownRef.current =
          mappedFiltered.length > 0 || dispatchRows.length > 0 || workingPicks.length > 0
        if (
          mappedFiltered.length === 0 &&
          dispatchRows.length === 0 &&
          workingPicks.length === 0 &&
          !noAssignedJobsInfoToastShownRef.current
        ) {
          noAssignedJobsInfoToastShownRef.current = true
          showToastRef.current('No quick picks from your job assignments or Dispatch schedule for this day.', 'info')
        }
      } catch {
        if (requestId !== assignedJobsFetchGenRef.current) return
        assignedJobsShownRef.current = false
        lastDefaultUnifiedResultsRef.current = []
        setScheduledDispatchJobs([])
        setWorkingBoardBidPicks([])
        setUnifiedSearchResults([])
        showToastRef.current('Could not load your jobs', 'error')
      } finally {
        if (requestId === assignedJobsFetchGenRef.current) {
          setAssignedJobsListLoading(false)
        }
      }
    })()
    return () => {
      assignedJobsFetchGenRef.current++
    }
    // showToast via ref only — including showToast here caused a loop when any toast updated ToastProvider and gave consumers a new reference chain in some builds.
  }, [
    clockInModalOpen,
    updateFocusModalOpen,
    clockOutReviewOpen,
    userId,
    openSession?.work_date,
    openSession?.clocked_in_at,
    openSession?.id,
  ])

  useEffect(() => {
    const t = setTimeout(() => {
      if (!(clockInModalOpen || updateFocusModalOpen || clockOutReviewOpen)) return
      if (!unifiedSearchText.trim()) {
        if (assignedJobsShownRef.current) {
          assignedJobsShownRef.current = false
          return
        }
        if (lastDefaultUnifiedResultsRef.current.length > 0) {
          setUnifiedSearchResults(lastDefaultUnifiedResultsRef.current)
          assignedJobsShownRef.current = true
          return
        }
        setUnifiedSearchResults([])
        return
      }
      const q = unifiedSearchText.trim()
      const bidsParams = buildClockBidsSearchParams(q, {
        serviceTypes,
        enabledBidServiceTypeIds,
        subcontractorServiceTypeIds,
      })
      Promise.all([
        supabase.rpc('search_jobs_ledger', { search_text: q }),
        supabase.rpc('search_bids_for_clock', bidsParams),
      ]).then(([jobsRes, bidsRes]) => {
        const jobs = (jobsRes.data ?? []) as JobSearchResult[]
        const bids = (bidsRes.data ?? []) as BidSearchResult[]
        const merged: UnifiedSearchResult[] = [
          ...jobs.map((j) => ({ source: 'job' as const, ...j })),
          ...bids.map((b) => ({ source: 'bid' as const, ...b })),
        ]
        setUnifiedSearchResults(merged)
      })
    }, 300)
    return () => clearTimeout(t)
  }, [
    clockInModalOpen,
    updateFocusModalOpen,
    clockOutReviewOpen,
    unifiedSearchText,
    enabledBidServiceTypeIds,
    subcontractorServiceTypeIds,
    serviceTypes,
  ])

  useEffect(() => {
    if (!(clockInModalOpen || updateFocusModalOpen || clockOutReviewOpen)) return
    const load = async () => {
      const { data: stData } = await supabase.from('service_types').select('id, name').order('sequence_order', { ascending: true })
      const types = (stData ?? []) as Array<{ id: string; name: string }>
      if (authUser?.id) {
        const { data: meData } = await supabase.from('users').select('role, estimator_service_type_ids, primary_service_type_ids, subcontractor_service_type_ids').eq('id', authUser.id).single()
        const me = meData as { role?: string; estimator_service_type_ids?: string[] | null; primary_service_type_ids?: string[] | null; subcontractor_service_type_ids?: string[] | null } | null
        const estIds = me?.estimator_service_type_ids
        const primIds = me?.primary_service_type_ids
        const subIds = me?.subcontractor_service_type_ids ?? null
        if (me?.role === 'subcontractor') setSubcontractorServiceTypeIds(subIds && subIds.length > 0 ? subIds : null)
        else setSubcontractorServiceTypeIds(null)
        const filtered = (me?.role === 'estimator' && estIds && estIds.length > 0)
          ? types.filter((t) => estIds.includes(t.id))
          : (me?.role === 'primary' && primIds && primIds.length > 0)
            ? types.filter((t) => primIds.includes(t.id))
            : (me?.role === 'subcontractor' && subIds && subIds.length > 0)
              ? types.filter((t) => subIds.includes(t.id))
              : types
        const filteredIds = filtered.map((t) => t.id)
        if (filtered.length === 1) {
          setEnabledBidServiceTypeIds([filtered[0]!.id])
        } else {
          setEnabledBidServiceTypeIds((prev) => {
            const kept = prev.filter((id) => filteredIds.includes(id))
            if (kept.length === 0) return filteredIds
            const missing = filteredIds.filter((id) => !kept.includes(id))
            return missing.length > 0 ? [...kept, ...missing] : kept
          })
        }
        setServiceTypes(filtered)
      } else {
        setEnabledBidServiceTypeIds(types.map((t) => t.id))
        setServiceTypes(types)
        setSubcontractorServiceTypeIds(null)
      }
    }
    void load()
  }, [clockInModalOpen, updateFocusModalOpen, clockOutReviewOpen, authUser?.id])

  useEffect(() => {
    if (updateFocusModalOpen) {
      const id = setTimeout(() => updateFocusNotesRef.current?.focus(), 0)
      return () => clearTimeout(id)
    }
  }, [updateFocusModalOpen])

  useEffect(() => {
    if (clockOutReviewOpen) {
      const id = setTimeout(() => clockOutNotesRef.current?.focus(), 0)
      return () => clearTimeout(id)
    }
  }, [clockOutReviewOpen])

  useEffect(() => {
    if (!clockOutReviewOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !clockOutSaving) {
        e.preventDefault()
        setClockOutReviewOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [clockOutReviewOpen, clockOutSaving])

  useEffect(() => {
    if (!clockOutReviewOpen || !openSession) return
    let cancelled = false
    if (!openSession.job_ledger_id && !openSession.bid_id) {
      setSelectedAssociation(null)
      return
    }
    void (async () => {
      const jobLedgerId = openSession.job_ledger_id
      const bidId = openSession.bid_id
      try {
        if (jobLedgerId) {
          const row = await withSupabaseRetry(
            async () =>
              supabase
                .from('jobs_ledger')
                .select('id, hcp_number, job_name, job_address')
                .eq('id', jobLedgerId)
                .maybeSingle(),
            'hydrate clock-out job',
          )
          if (cancelled) return
          const job = row as JobSearchResult | null
          if (!job) {
            setSelectedAssociation(null)
            return
          }
          setSelectedAssociation({
            source: 'job',
            id: job.id,
            hcp_number: job.hcp_number ?? '',
            job_name: job.job_name ?? '',
            job_address: job.job_address ?? '',
          })
          return
        }
        if (bidId) {
          type BidHydrate = {
            id: string
            bid_number: string | null
            project_name: string | null
            address: string | null
            customer_id: string | null
            service_type: { name: string } | null
          }
          const bid = await withSupabaseRetry(
            async () =>
              supabase
                .from('bids')
                .select('id, bid_number, project_name, address, customer_id, service_type:service_types(name)')
                .eq('id', bidId)
                .maybeSingle(),
            'hydrate clock-out bid',
          )
          if (cancelled) return
          if (!bid) {
            setSelectedAssociation(null)
            return
          }
          const b = bid as BidHydrate
          let customer_name = ''
          if (b.customer_id) {
            const cid = b.customer_id
            const custRow = await withSupabaseRetry(
              async () => supabase.from('customers').select('name').eq('id', cid).maybeSingle(),
              'hydrate clock-out customer',
            )
            const cname = custRow as { name: string } | null
            customer_name = cname?.name?.trim() ?? ''
          }
          setSelectedAssociation({
            source: 'bid',
            id: b.id,
            bid_number: b.bid_number ?? '',
            project_name: b.project_name ?? '',
            address: b.address ?? '',
            customer_name,
            service_type_name: b.service_type?.name ?? null,
          })
        }
      } catch {
        if (!cancelled) setSelectedAssociation(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clockOutReviewOpen, openSession?.id, openSession?.job_ledger_id, openSession?.bid_id])

  useEffect(() => {
    if (!(updateFocusModalOpen || clockOutReviewOpen)) return
    const scrollY = window.scrollY
    const prevOverflow = document.body.style.overflow
    const prevPosition = document.body.style.position
    const prevTop = document.body.style.top
    const prevLeft = document.body.style.left
    const prevRight = document.body.style.right

    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'

    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.position = prevPosition
      document.body.style.top = prevTop
      document.body.style.left = prevLeft
      document.body.style.right = prevRight
      window.scrollTo(0, scrollY)
    }
  }, [updateFocusModalOpen, clockOutReviewOpen])

  function handleOpenClockInModal() {
    if (!userId || !userName?.trim() || openSession) return
    setClockInModalOpen(true)
  }

  async function handleCompleteClockIn() {
    if (!userId || !userName?.trim() || !clockInNotes.trim()) {
      if (!clockInNotes.trim()) {
        showToast('Please describe what you intend to accomplish today', 'error')
      }
      return
    }
    setActionLoading(true)
    setClockInError(null)
    try {
      const now = new Date()
      const inserted = await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .insert({
              user_id: userId,
              clocked_in_at: now.toISOString(),
              work_date: denverCalendarDayKey(now.getTime()),
              notes: clockInNotes.trim(),
              job_ledger_id: selectedAssociation?.source === 'job' ? selectedAssociation?.id : null,
              bid_id: selectedAssociation?.source === 'bid' ? selectedAssociation?.id : null,
            })
            .select('id')
            .single(),
        'clock in',
      )
      const clockInId = (inserted as { id: string } | null)?.id
      if (!clockInId) throw new Error('Clock in did not return a session id')
      scheduleClockInLocationPatch(supabase, clockInId)
      if (selectedAssociation && userId && typeof localStorage !== 'undefined') {
        localStorage.setItem(`clock_in_last_job_bid_${userId}`, JSON.stringify(selectedAssociation))
        setLastSelectedJobBid(selectedAssociation)
      }
      setClockInModalOpen(false)
      const workDate = denverCalendarDayKey(now.getTime())
      await Promise.all([fetchSessions(), notifyFirstClockInOfDay(workDate, userId)])
      onClockInSuccess?.()
    } catch (e) {
      setClockInError(e instanceof Error ? e.message : 'Failed to clock in')
    } finally {
      setActionLoading(false)
    }
  }

  function handleOpenClockOutReview() {
    if (salaryUiActive) return
    if (!openSession) return
    setSelectedAssociation(null)
    setClockOutReviewNotes(openSession.notes?.trim() ?? '')
    setClockOutReviewError(null)
    setUnifiedSearchText('')
    setUnifiedSearchResults([])
    setClockOutReviewOpen(true)
  }

  async function handleCompleteClockOutReview() {
    if (salaryUiActive) return
    if (!openSession) return
    if (!clockOutReviewNotes.trim()) {
      showToast('Please describe what you intend to accomplish today', 'error')
      return
    }

    setClockOutSaving(true)
    setClockOutReviewError(null)
    setError(null)
    try {
      const notesTrim = clockOutReviewNotes.trim()
      const jobId = selectedAssociation?.source === 'job' ? selectedAssociation.id : null
      const bidId = selectedAssociation?.source === 'bid' ? selectedAssociation.id : null
      await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .update({
              notes: notesTrim,
              job_ledger_id: jobId,
              bid_id: bidId,
              clocked_out_at: new Date().toISOString(),
            })
            .eq('id', openSession.id),
        'clock out',
      )
      scheduleClockOutLocationPatch(supabase, openSession.id)
      if (selectedAssociation && userId && typeof localStorage !== 'undefined') {
        localStorage.setItem(`clock_in_last_job_bid_${userId}`, JSON.stringify(selectedAssociation))
        setLastSelectedJobBid(selectedAssociation)
      }
      setClockOutReviewOpen(false)
      setOpenSession(null)
      const [, elig] = await Promise.all([fetchSessions(), getTeamFeedbackEligibility(userId)])
      if (elig.eligible) setTeamFeedbackOpen(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to clock out'
      setClockOutReviewError(msg)
      setError(msg)
    } finally {
      setClockOutSaving(false)
    }
  }

  function handleOpenUpdateFocusModal() {
    if (!openSession) return
    setUpdateFocusNotes(openSession.notes?.trim() ?? '')
    setUpdateFocusError(null)
    setUpdateFocusModalOpen(true)
  }

  async function handleUpdateFocus() {
    if (!openSession || !userId || !userName?.trim()) return
    if (!salaryUiActive && !updateFocusNotes.trim()) return
    setUpdateFocusLoading(true)
    setUpdateFocusError(null)
    try {
      if (salaryUiActive) {
        const { error } = await supabase
          .from('clock_sessions')
          .update({
            job_ledger_id: selectedAssociation?.source === 'job' ? selectedAssociation.id : null,
            bid_id: selectedAssociation?.source === 'bid' ? selectedAssociation.id : null,
            notes: updateFocusNotes.trim() || openSession.notes || '',
          })
          .eq('id', openSession.id)
        if (error) throw error
        if (selectedAssociation && userId && typeof localStorage !== 'undefined') {
          localStorage.setItem(`clock_in_last_job_bid_${userId}`, JSON.stringify(selectedAssociation))
          setLastSelectedJobBid(selectedAssociation)
        }
        setUpdateFocusModalOpen(false)
        await fetchSessions()
        setUpdateFocusLoading(false)
        return
      }
      const now = new Date()
      const closedId = openSession.id
      await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .update({
              clocked_out_at: now.toISOString(),
            })
            .eq('id', closedId),
        'update focus clock out',
      )
      const inserted = await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .insert({
              user_id: userId,
              clocked_in_at: now.toISOString(),
              work_date: denverCalendarDayKey(now.getTime()),
              notes: updateFocusNotes.trim(),
              job_ledger_id: selectedAssociation?.source === 'job' ? selectedAssociation?.id : null,
              bid_id: selectedAssociation?.source === 'bid' ? selectedAssociation?.id : null,
            })
            .select('id')
            .single(),
        'update focus clock in',
      )
      const newSessionId = (inserted as { id: string } | null)?.id
      if (!newSessionId) throw new Error('Update focus did not return a new session id')
      scheduleUpdateFocusLocationPatches(supabase, closedId, newSessionId)
      if (selectedAssociation && userId && typeof localStorage !== 'undefined') {
        localStorage.setItem(`clock_in_last_job_bid_${userId}`, JSON.stringify(selectedAssociation))
        setLastSelectedJobBid(selectedAssociation)
      }
      setUpdateFocusModalOpen(false)
      const workDate = denverCalendarDayKey(now.getTime())
      await Promise.all([fetchSessions(), notifyFirstClockInOfDay(workDate, userId)])
      onClockInSuccess?.()
    } catch (e) {
      setUpdateFocusError(e instanceof Error ? e.message : 'Failed to switch focus')
    } finally {
      setUpdateFocusLoading(false)
    }
  }

  function renderScheduledDispatchPicks(
    disabled: boolean,
    useLastLike: 'clockIn' | 'updateFocus' | 'clockOutReview',
  ) {
    if (scheduledDispatchJobs.length === 0) return null
    const base =
      useLastLike === 'clockIn'
        ? {
            border: '1px solid #bfdbfe',
            borderRadius: 6,
            background: '#eff6ff',
          }
        : {
            border: '1px solid #d1d5db',
            borderRadius: 4,
            background: 'white',
          }
    const selected =
      useLastLike === 'clockIn'
        ? { border: '1px solid #3b82f6', background: '#dbeafe' }
        : { border: '1px solid #9ca3af', background: '#f3f4f6' }
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          marginBottom: '0.5rem',
        }}
      >
        {scheduledDispatchJobs.map((d) => {
          const u = dispatchScheduledJobToUnified(d)
          const win = d.windowsLabel?.trim()
          const { title, address } = formatUnifiedJobSchedulePrimaryLine(u)
          const isSelected = selectedAssociation?.source === 'job' && selectedAssociation.id === d.jobId
          const line1 = win ? `${win} | ${title}` : title
          const titleAttr = address ? `${line1}\n${address}` : line1
          return (
            <button
              key={d.jobId}
              type="button"
              disabled={disabled}
              title={titleAttr || undefined}
              onClick={() => {
                setSelectedAssociation(u)
                setUnifiedSearchResults([])
                setUnifiedSearchText('')
                assignedJobsShownRef.current = true
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.25rem 0.5rem',
                textAlign: 'left',
                boxSizing: 'border-box',
                fontSize: '0.8125rem',
                cursor: disabled ? 'not-allowed' : 'pointer',
                ...(isSelected ? { ...base, ...selected } : base),
              }}
            >
              <div>{line1}</div>
              {address ? (
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{address}</div>
              ) : null}
            </button>
          )
        })}
      </div>
    )
  }

  function renderWorkingBoardBidPicks(
    disabled: boolean,
    useLastLike: 'clockIn' | 'updateFocus' | 'clockOutReview',
  ) {
    if (workingBoardBidPicks.length === 0) return null
    const base =
      useLastLike === 'clockIn'
        ? {
            border: '1px solid #a7f3d0',
            borderRadius: 6,
            background: '#ecfdf5',
          }
        : {
            border: '1px solid #d1d5db',
            borderRadius: 4,
            background: 'white',
          }
    const selected =
      useLastLike === 'clockIn'
        ? { border: '1px solid #10b981', background: '#d1fae5' }
        : { border: '1px solid #9ca3af', background: '#f3f4f6' }
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          marginBottom: '0.5rem',
        }}
      >
        {workingBoardBidPicks.map((b) => {
          const prefix = `B${(b.bid_number || '').trim() || '—'}`
          const line1 = `${prefix} · ${b.project_name || '—'}`
          const sub = (b.address || '').trim() || (b.customer_name || '').trim()
          const titleAttr = sub ? `${line1}\n${sub}` : line1
          const isSelected = selectedAssociation?.source === 'bid' && selectedAssociation.id === b.id
          const tag = getBidServiceTypeTag(b.service_type_name)
          return (
            <button
              key={`working-board-${b.id}`}
              type="button"
              disabled={disabled}
              title={titleAttr || undefined}
              onClick={() => {
                setSelectedAssociation(b)
                setUnifiedSearchResults([])
                setUnifiedSearchText('')
                assignedJobsShownRef.current = true
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.25rem 0.5rem',
                textAlign: 'left',
                boxSizing: 'border-box',
                fontSize: '0.8125rem',
                cursor: disabled ? 'not-allowed' : 'pointer',
                ...(isSelected ? { ...base, ...selected } : base),
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                {tag ? (
                  <span
                    style={{
                      padding: '0.1rem 0.35rem',
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      background: tag.color,
                      color: '#fff',
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  >
                    [{tag.tag}]
                  </span>
                ) : null}
                <span>{line1}</span>
              </div>
              {sub ? (
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{sub}</div>
              ) : null}
            </button>
          )
        })}
      </div>
    )
  }

  function renderUseLastJobBidShortcut(opts: { disabled: boolean; useLastStyle: 'clockIn' | 'focusOrReview' }) {
    const showUseLast = Boolean(lastSelectedJobBid && !useLastHiddenBySchedule)
    if (!showUseLast || !lastSelectedJobBid) return null
    const useLastBtnStyle: CSSProperties =
      opts.useLastStyle === 'clockIn'
        ? {
            padding: '0.25rem 0.5rem',
            fontSize: '0.8125rem',
            border: '1px solid #bfdbfe',
            borderRadius: 6,
            background: '#eff6ff',
            cursor: opts.disabled ? 'not-allowed' : 'pointer',
          }
        : {
            padding: '0.25rem 0.5rem',
            fontSize: '0.8125rem',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            background: 'white',
            cursor: opts.disabled ? 'not-allowed' : 'pointer',
          }
    return (
      <div style={{ marginTop: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setSelectedAssociation(lastSelectedJobBid)}
          disabled={opts.disabled}
          style={{ ...useLastBtnStyle, alignSelf: 'flex-start' }}
        >
          Use last: {formatUnifiedResult(lastSelectedJobBid)}
        </button>
      </div>
    )
  }

  function renderUnifiedJobBidSearchRow(disabled: boolean) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.35rem',
          width: '100%',
        }}
      >
        <BidServiceTypeSearchToggles
          serviceTypes={serviceTypes}
          enabledBidServiceTypeIds={enabledBidServiceTypeIds}
          disabled={disabled}
          onEnabledChange={setEnabledBidServiceTypeIds}
          onAfterToggle={() => setUnifiedSearchResults([])}
        />
        <input
          type="text"
          value={unifiedSearchText}
          onChange={(e) => {
            setUnifiedSearchText(e.target.value)
            setSelectedAssociation(null)
            assignedJobsShownRef.current = false
          }}
          placeholder="Search to choose other job or bid"
          disabled={disabled}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '0.25rem 0.4rem',
            boxSizing: 'border-box',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            background: '#fff',
            fontSize: '0.75rem',
            lineHeight: 1.3,
          }}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: '0.5rem 1rem', color: '#6b7280', fontSize: '0.875rem' }}>
        Loading…
      </div>
    )
  }

  const canClockIn = userName?.trim() && !openSession && !salaryUiActive
  const hasOpenSession = !!openSession
  const showMyTimeDayPreview =
    Boolean(onOpenMyTimeDayEditor) && !loading && !hasOpenSession && todaySessions.length > 0

  const myTimePreviewButton = showMyTimeDayPreview ? (
    <button
      type="button"
      onClick={() => onOpenMyTimeDayEditor?.()}
      title="View today’s time"
      aria-label="View today’s time"
      style={{
        flexShrink: 0,
        width: 48,
        height: 48,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 640 640"
        width={26}
        height={26}
        fill="currentColor"
        style={{ display: 'block' }}
        aria-hidden
      >
        <path d="M320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64zM296 184L296 320C296 328 300 335.5 306.7 340L402.7 404C413.7 411.4 428.6 408.4 436 397.3C443.4 386.2 440.4 371.4 429.3 364L344 307.2L344 184C344 170.7 333.3 160 320 160C306.7 160 296 170.7 296 184z" />
      </svg>
    </button>
  ) : null

  return (
    <>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', width: '100%' }}>
      {hasOpenSession ? (
        <>
          {salaryUiActive ? (
            <div
              style={{
                padding: '0.5rem 1rem',
                fontSize: '1rem',
                fontWeight: 600,
                border: '2px solid #15803d',
                borderRadius: 8,
                background: '#dcfce7',
                color: '#14532d',
                fontVariantNumeric: 'tabular-nums',
              }}
              title="Salaried shift from your Settings workday"
            >
              On shift — {formatElapsed(totalSecondsToday)}
            </div>
          ) : (
          <button
            type="button"
            onClick={handleOpenClockOutReview}
            disabled={actionLoading || updateFocusLoading || clockOutSaving}
            title="Clock out"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '1rem',
              fontWeight: 600,
              border: '2px solid #dc2626',
              borderRadius: 8,
              background: '#dc2626',
              color: 'white',
              cursor: (actionLoading || updateFocusLoading || clockOutSaving) ? 'not-allowed' : 'pointer',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatElapsed(totalSecondsToday)} — Clock Out
          </button>
          )}
          <button
            type="button"
            onClick={handleOpenUpdateFocusModal}
            disabled={actionLoading || updateFocusLoading || clockOutSaving}
            title={
              salaryUiActive
                ? 'Change job or bid focus for this shift'
                : 'Switch to a new focus (clocks out and starts new session)'
            }
            style={{
              flex: 1,
              minWidth: 0,
              padding: '0.5rem 1rem',
              fontSize: '1rem',
              fontWeight: 600,
              border: '2px solid #3b82f6',
              borderRadius: 8,
              background: '#3b82f6',
              color: 'white',
              cursor: (actionLoading || updateFocusLoading || clockOutSaving) ? 'not-allowed' : 'pointer',
            }}
          >
            Update Focus
          </button>
        </>
      ) : salaryUiActive ? (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '0.5rem', width: '100%' }}>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              padding: '0 1.5rem',
              minHeight: 48,
              height: 48,
              boxSizing: 'border-box',
              fontSize: '1rem',
              fontWeight: 600,
              border: '2px solid #d1d5db',
              borderRadius: 8,
              background: '#f9fafb',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Outside your scheduled shift windows (see Settings → Salaried workday)"
          >
            Off shift
          </div>
          {myTimePreviewButton}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '0.5rem', width: '100%' }}>
          <button
            type="button"
            onClick={handleOpenClockInModal}
            disabled={!canClockIn || actionLoading}
            title={!userName?.trim() ? 'Set your name in Settings to clock in' : 'Clock in'}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '0 1.5rem',
              minHeight: 48,
              height: 48,
              boxSizing: 'border-box',
              fontSize: '1.125rem',
              fontWeight: 600,
              border: '2px solid #ff6600',
              borderRadius: 8,
              background: canClockIn ? '#ff6600' : '#f3f4f6',
              color: canClockIn ? 'white' : '#9ca3af',
              cursor: canClockIn && !actionLoading ? 'pointer' : 'not-allowed',
            }}
          >
            Clock In
          </button>
          {myTimePreviewButton}
        </div>
      )}
      {error && (
        <span style={{ color: '#dc2626', fontSize: '0.875rem' }}>{error}</span>
      )}
      {clockInModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clock-in-modal-title"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => !actionLoading && setClockInModalOpen(false)}
        >
          <div
            id="clock-in-modal"
            style={{
              background: '#fefcfb',
              padding: '1.5rem',
              borderRadius: 12,
              maxWidth: 480,
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              borderTop: '4px solid #ff6600',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <style>{`#clock-in-modal textarea:focus,#clock-in-modal textarea:focus-visible,#clock-in-modal input[type=text]:focus,#clock-in-modal input[type=text]:focus-visible,#clock-in-modal button:focus-visible{outline:2px solid #ff6600;outline-offset:2px}`}</style>
            <h3 id="clock-in-modal-title" style={{ marginTop: 0, marginBottom: '1rem', textAlign: 'center' }}>Ready to clock in?</h3>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>What do you plan to accomplish?</span>
              <textarea
                ref={clockInNotesRef}
                value={clockInNotes}
                onChange={(e) => setClockInNotes(e.target.value)}
                placeholder="e.g. Rough-in, Bid for Kiki, Hydrostatic test"
                rows={3}
                disabled={actionLoading}
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', border: '2px solid #64748b', borderRadius: 6, background: '#fff' }}
              />
            </label>
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 500 }}>What job or bid should we change for your time?</span>
              </div>
              {selectedAssociation && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ flex: 1, padding: '0.5rem', background: '#f3f4f6', borderRadius: 4, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {selectedAssociation.source === 'bid' && (() => {
                      const t = getBidServiceTypeTag(selectedAssociation.service_type_name)
                      return t ? (
                        <span style={{ padding: '0.1rem 0.35rem', fontSize: '0.6875rem', fontWeight: 500, background: t.color, color: '#fff', borderRadius: 4 }}>
                          [{t.tag}]
                        </span>
                      ) : null
                    })()}
                    {formatUnifiedResult(selectedAssociation)}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setSelectedAssociation(null); setUnifiedSearchResults([]) }}
                    disabled={actionLoading}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: actionLoading ? 'not-allowed' : 'pointer' }}
                  >
                    Clear
                  </button>
                </div>
              )}
              {renderScheduledDispatchPicks(actionLoading, 'clockIn')}
              {renderWorkingBoardBidPicks(actionLoading, 'clockIn')}
              {renderUnifiedJobBidSearchRow(actionLoading)}
              {(unifiedSearchResults.length > 0 || (assignedJobsListLoading && !unifiedSearchText.trim())) && (
                <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 4, marginTop: '0.25rem' }}>
                  {assignedJobsListLoading && unifiedSearchResults.length === 0 && !unifiedSearchText.trim() ? (
                    <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>Loading…</div>
                  ) : (
                    unifiedSearchResults.map((r) => (
                      <button
                        key={`${r.source}-${r.id}`}
                        type="button"
                        onClick={() => { setSelectedAssociation(r); setUnifiedSearchResults([]); setUnifiedSearchText('') }}
                        style={{ display: 'block', width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', border: 'none', background: selectedAssociation && selectedAssociation.source === r.source && selectedAssociation.id === r.id ? '#eff6ff' : 'white', cursor: 'pointer', borderBottom: '1px solid #e5e7eb', fontSize: '0.875rem' }}
                      >
                        {r.source === 'bid' && (() => {
                          const t = getBidServiceTypeTag(r.service_type_name)
                          return t ? (
                            <span style={{ marginRight: '0.35rem', padding: '0.1rem 0.35rem', fontSize: '0.6875rem', fontWeight: 500, background: t.color, color: '#fff', borderRadius: 4 }}>
                              [{t.tag}]
                            </span>
                          ) : null
                        })()}
                        {formatUnifiedResult(r)}
                      </button>
                    ))
                  )}
                </div>
              )}
              {renderUseLastJobBidShortcut({ disabled: actionLoading, useLastStyle: 'clockIn' })}
            </div>
            {clockInError && (
              <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: '0 0 0.75rem 0' }}>
                {clockInError.toLowerCase().includes('network') || clockInError.toLowerCase().includes('fetch')
                  ? "Something went wrong. Please check your connection and try again."
                  : clockInError}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => !actionLoading && setClockInModalOpen(false)}
                disabled={actionLoading}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: actionLoading ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCompleteClockIn}
                disabled={actionLoading}
                style={{ padding: '0.5rem 1rem', border: '1px solid #ff6600', borderRadius: 6, background: '#ff6600', color: 'white', cursor: actionLoading ? 'not-allowed' : 'pointer' }}
              >
                {actionLoading ? 'Clocking in…' : 'Complete Clock In'}
              </button>
            </div>
          </div>
        </div>
      )}
      {updateFocusModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="update-focus-modal-title"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => !updateFocusLoading && setUpdateFocusModalOpen(false)}
        >
          <div
            id="update-focus-modal"
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: 8,
              maxWidth: 480,
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <style>{`#update-focus-modal textarea:focus,#update-focus-modal input[type=text]:focus,#update-focus-modal input[type=text]:focus-visible{outline:2px solid #3b82f6;outline-offset:2px}`}</style>
            <h3 id="update-focus-modal-title" style={{ marginTop: 0, marginBottom: '0.5rem', textAlign: 'center' }}>Update Focus</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {salaryUiActive
                ? 'Link this shift to a different job or bid. Your session times stay the same.'
                : 'This will clock out your current session and start a new one with the focus below.'}
            </p>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>What are you working on?</span>
              <textarea
                ref={updateFocusNotesRef}
                value={updateFocusNotes}
                onChange={(e) => setUpdateFocusNotes(e.target.value)}
                placeholder="e.g. Trim set at 456 Oak Ave"
                rows={3}
                disabled={updateFocusLoading}
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', border: '2px solid #64748b', borderRadius: 6, background: '#fff' }}
              />
            </label>
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 500 }}>What Job or Bid are you going to work on?</span>
              </div>
              {selectedAssociation && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ flex: 1, padding: '0.5rem', background: '#f3f4f6', borderRadius: 4, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {selectedAssociation.source === 'bid' && (() => {
                      const t = getBidServiceTypeTag(selectedAssociation.service_type_name)
                      return t ? (
                        <span style={{ padding: '0.1rem 0.35rem', fontSize: '0.6875rem', fontWeight: 500, background: t.color, color: '#fff', borderRadius: 4 }}>
                          [{t.tag}]
                        </span>
                      ) : null
                    })()}
                    {formatUnifiedResult(selectedAssociation)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedAssociation(null)}
                    disabled={updateFocusLoading}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: updateFocusLoading ? 'not-allowed' : 'pointer' }}
                  >
                    Clear
                  </button>
                </div>
              )}
              {renderScheduledDispatchPicks(updateFocusLoading, 'updateFocus')}
              {renderWorkingBoardBidPicks(updateFocusLoading, 'updateFocus')}
              {renderUnifiedJobBidSearchRow(updateFocusLoading)}
              {(unifiedSearchResults.length > 0 || (assignedJobsListLoading && !unifiedSearchText.trim())) && (
                <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 4, marginTop: '0.25rem' }}>
                  {assignedJobsListLoading && unifiedSearchResults.length === 0 && !unifiedSearchText.trim() ? (
                    <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>Loading…</div>
                  ) : (
                    unifiedSearchResults.map((r) => (
                      <button
                        key={`${r.source}-${r.id}`}
                        type="button"
                        onClick={() => { setSelectedAssociation(r); setUnifiedSearchResults([]); setUnifiedSearchText('') }}
                        style={{ display: 'block', width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', border: 'none', background: selectedAssociation && selectedAssociation.source === r.source && selectedAssociation.id === r.id ? '#eff6ff' : 'white', cursor: 'pointer', borderBottom: '1px solid #e5e7eb', fontSize: '0.875rem' }}
                      >
                        {r.source === 'bid' && (() => {
                          const t = getBidServiceTypeTag(r.service_type_name)
                          return t ? (
                            <span style={{ marginRight: '0.35rem', padding: '0.1rem 0.35rem', fontSize: '0.6875rem', fontWeight: 500, background: t.color, color: '#fff', borderRadius: 4 }}>
                              [{t.tag}]
                            </span>
                          ) : null
                        })()}
                        {formatUnifiedResult(r)}
                      </button>
                    ))
                  )}
                </div>
              )}
              {renderUseLastJobBidShortcut({ disabled: updateFocusLoading, useLastStyle: 'focusOrReview' })}
            </div>
            {updateFocusError && (
              <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: '0 0 0.75rem 0' }}>{updateFocusError}</p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => !updateFocusLoading && setUpdateFocusModalOpen(false)}
                disabled={updateFocusLoading}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: updateFocusLoading ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateFocus}
                disabled={(!salaryUiActive && !updateFocusNotes.trim()) || updateFocusLoading}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #3b82f6',
                  borderRadius: 4,
                  background: '#3b82f6',
                  color: 'white',
                  cursor: (salaryUiActive || updateFocusNotes.trim()) && !updateFocusLoading ? 'pointer' : 'not-allowed',
                }}
              >
                {updateFocusLoading ? (salaryUiActive ? 'Saving…' : 'Switching…') : salaryUiActive ? 'Save focus' : 'Switch Focus'}
              </button>
            </div>
          </div>
        </div>
      )}
      {clockOutReviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clock-out-review-modal-title"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => !clockOutSaving && setClockOutReviewOpen(false)}
        >
          <div
            id="clock-out-review-modal"
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: 8,
              maxWidth: 480,
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <style>{`#clock-out-review-modal textarea:focus,#clock-out-review-modal input[type=text]:focus,#clock-out-review-modal input[type=text]:focus-visible{outline:2px solid #dc2626;outline-offset:2px}`}</style>
            <h3 id="clock-out-review-modal-title" style={{ marginTop: 0, marginBottom: '0.5rem', textAlign: 'center' }}>Review before clock out</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              Confirm or update what you worked on for this session. This is saved on the same time entry when you clock out.
            </p>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>What did you work on?</span>
              <textarea
                ref={clockOutNotesRef}
                value={clockOutReviewNotes}
                onChange={(e) => setClockOutReviewNotes(e.target.value)}
                placeholder="e.g. Trim set at 456 Oak Ave"
                rows={3}
                disabled={clockOutSaving}
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', border: '2px solid #64748b', borderRadius: 6, background: '#fff' }}
              />
            </label>
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 500 }}>What Job or Bid were you working on?</span>
              </div>
              {selectedAssociation && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ flex: 1, padding: '0.5rem', background: '#f3f4f6', borderRadius: 4, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {selectedAssociation.source === 'bid' && (() => {
                      const t = getBidServiceTypeTag(selectedAssociation.service_type_name)
                      return t ? (
                        <span style={{ padding: '0.1rem 0.35rem', fontSize: '0.6875rem', fontWeight: 500, background: t.color, color: '#fff', borderRadius: 4 }}>
                          [{t.tag}]
                        </span>
                      ) : null
                    })()}
                    {formatUnifiedResult(selectedAssociation)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedAssociation(null)}
                    disabled={clockOutSaving}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: clockOutSaving ? 'not-allowed' : 'pointer' }}
                  >
                    Clear
                  </button>
                </div>
              )}
              {renderScheduledDispatchPicks(clockOutSaving, 'clockOutReview')}
              {renderWorkingBoardBidPicks(clockOutSaving, 'clockOutReview')}
              {renderUnifiedJobBidSearchRow(clockOutSaving)}
              {(unifiedSearchResults.length > 0 || (assignedJobsListLoading && !unifiedSearchText.trim())) && (
                <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 4, marginTop: '0.25rem' }}>
                  {assignedJobsListLoading && unifiedSearchResults.length === 0 && !unifiedSearchText.trim() ? (
                    <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>Loading…</div>
                  ) : (
                    unifiedSearchResults.map((r) => (
                      <button
                        key={`${r.source}-${r.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedAssociation(r)
                          setUnifiedSearchResults([])
                          setUnifiedSearchText('')
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          textAlign: 'left',
                          border: 'none',
                          background: selectedAssociation && selectedAssociation.source === r.source && selectedAssociation.id === r.id ? '#eff6ff' : 'white',
                          cursor: 'pointer',
                          borderBottom: '1px solid #e5e7eb',
                          fontSize: '0.875rem',
                        }}
                      >
                        {r.source === 'bid' && (() => {
                          const t = getBidServiceTypeTag(r.service_type_name)
                          return t ? (
                            <span style={{ marginRight: '0.35rem', padding: '0.1rem 0.35rem', fontSize: '0.6875rem', fontWeight: 500, background: t.color, color: '#fff', borderRadius: 4 }}>
                              [{t.tag}]
                            </span>
                          ) : null
                        })()}
                        {formatUnifiedResult(r)}
                      </button>
                    ))
                  )}
                </div>
              )}
              {renderUseLastJobBidShortcut({ disabled: clockOutSaving, useLastStyle: 'focusOrReview' })}
            </div>
            {clockOutReviewError && (
              <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: '0 0 0.75rem 0' }}>{clockOutReviewError}</p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => !clockOutSaving && setClockOutReviewOpen(false)}
                disabled={clockOutSaving}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: clockOutSaving ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleCompleteClockOutReview()
                }}
                disabled={!clockOutReviewNotes.trim() || clockOutSaving}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #dc2626',
                  borderRadius: 4,
                  background: '#dc2626',
                  color: 'white',
                  cursor: clockOutReviewNotes.trim() && !clockOutSaving ? 'pointer' : 'not-allowed',
                }}
              >
                {clockOutSaving ? 'Clocking out…' : 'Complete clock out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    <TeamFeedbackWizard
      open={teamFeedbackOpen}
      onClose={() => setTeamFeedbackOpen(false)}
      userId={userId}
      source="clock_out_prompt"
    />
    </>
  )
}
