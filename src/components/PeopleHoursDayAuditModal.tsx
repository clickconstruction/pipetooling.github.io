import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import {
  type MergedCrewMapRow,
  type UnifiedAssignment,
  formatAssignmentLabel,
  splitFromUnified,
  type JobDetails,
  type BidDetails,
} from '../utils/crewAssignments'
import { getBidServiceTypeTag } from '../utils/unifiedJobBidSearch'
import { ClockSessionEditSplitModal } from './ClockSessionEditSplitModal'
import { AssignSessionJobPopover } from './clock-sessions/AssignSessionJobPopover'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerShortLine, formatJobLedgerShortLine } from '../lib/ledgerDisplayPrefixes'
import { approveClockSessions } from '../lib/approveClockSessions'
import { useIntervalNowMs } from '../hooks/useIntervalNowMs'
import { usePersonDayScheduleData } from '../hooks/usePersonDayScheduleData'
import { blocksToSegments } from '../lib/quickfillScheduleSegments'
import { clockSessionsToDispatchSecondaryBands } from '../lib/clockSessionsToDispatchSecondaryBands'
import { QuickfillScheduleUserRow } from './schedule/QuickfillScheduleUserRow'
import { scheduleFormatWindow } from '../lib/jobScheduleChicago'
import { formatScheduleDispatchHubJobTitle } from '../lib/scheduleDispatchHub'
import { companyWeekStartSundayContaining, getDefaultWeekRange } from '../utils/dateUtils'

type CrewRow = MergedCrewMapRow

type ClockSessionRow = {
  id: string
  user_id: string
  clocked_in_at: string
  clocked_out_at: string | null
  work_date: string
  notes: string | null
  job_ledger_id: string | null
  bid_id: string | null
  approved_at: string | null
}

function clockSessionDurationSeconds(s: { clocked_in_at: string; clocked_out_at: string | null }, nowMs: number): number {
  const inMs = new Date(s.clocked_in_at).getTime()
  const outMs = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : nowMs
  return Math.max(0, Math.floor((outMs - inMs) / 1000))
}

function formatHmsTotal(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const sec = Math.floor(seconds % 60)
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':')
}

function getAssignmentKey(a: UnifiedAssignment): string {
  return `${a.type}:${a.id}`
}

type Props = {
  personName: string
  workDate: string
  onClose: () => void
  initialCrewRow: MergedCrewMapRow | null
  canEditCrewJobs?: boolean
  /** Full map `${work_date}:${person_name}` → row; used for crew-lead edit predicates. */
  crewJobsByDatePerson?: Record<string, MergedCrewMapRow>
  /** Reserved for future (e.g. recent/common jobs); passed through from parent for consistency. */
  hoursDateStart?: string
  hoursDateEnd?: string
  onCrewSaved?: () => void
  showToast?: (message: string, variant?: 'success' | 'error' | 'warning' | 'info') => void
}

export function PeopleHoursDayAuditModal({
  personName,
  workDate,
  onClose,
  initialCrewRow,
  canEditCrewJobs = false,
  crewJobsByDatePerson = {},
  onCrewSaved,
  showToast,
}: Props) {
  const prefixMap = useLedgerPrefixMap()
  const [sessions, setSessions] = useState<ClockSessionRow[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionsFetchError, setSessionsFetchError] = useState<string | null>(null)
  const [sessionsUserMissing, setSessionsUserMissing] = useState(false)
  const [resolvedClockUserId, setResolvedClockUserId] = useState<string | null>(null)
  const [jobDetailsMap, setJobDetailsMap] = useState<Record<string, JobDetails>>({})
  const [bidDetailsMap, setBidDetailsMap] = useState<Record<string, BidDetails>>({})

  const [isEditMode, setIsEditMode] = useState(false)
  const [draft, setDraft] = useState<CrewRow | null>(null)
  const [crewDirty, setCrewDirty] = useState(false)
  const [crewSaveError, setCrewSaveError] = useState<string | null>(null)
  const [crewSaving, setCrewSaving] = useState(false)

  const [jobSearchOpen, setJobSearchOpen] = useState(false)
  const [jobSearchText, setJobSearchText] = useState('')
  const [jobSearchResults, setJobSearchResults] = useState<
    Array<
      | {
          type: 'job'
          id: string
          hcp_number: string
          job_name: string
          job_address: string
          service_type_id?: string | null
          service_type_name?: string | null
        }
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

  const [clockEditSession, setClockEditSession] = useState<ClockSessionRow | null>(null)
  const [clockCreateOpen, setClockCreateOpen] = useState(false)
  /** Per-session approving state — keyed by clock_sessions.id (also used for bulk approve when not single-row). */
  const [approvingSessionIds, setApprovingSessionIds] = useState<Set<string>>(() => new Set())

  const fetchGenRef = useRef(0)

  const crewKey = `${workDate}:${personName}`
  const rowFromMap = useMemo(
    () =>
      crewJobsByDatePerson[crewKey] ??
      initialCrewRow ?? { unifiedAssignments: [] },
    [crewJobsByDatePerson, crewKey, initialCrewRow]
  )

  const draftRow = draft ?? rowFromMap

  const refreshSessions = useCallback(() => {
    const gen = ++fetchGenRef.current
    setSessionsLoading(true)
    setSessionsFetchError(null)
    setSessionsUserMissing(false)
    setResolvedClockUserId(null)

    void (async () => {
      try {
        const userRes = await supabase.from('users').select('id').eq('name', personName).maybeSingle()
        if (gen !== fetchGenRef.current) return
        const userId = (userRes.data as { id: string } | null)?.id ?? null

        let rows: ClockSessionRow[] = []
        let clockErr: string | null = null
        if (!userId) {
          setSessionsUserMissing(true)
        } else {
          if (gen === fetchGenRef.current) {
            setResolvedClockUserId(userId)
          }
          try {
            const data = await withSupabaseRetry(
              async () =>
                supabase
                  .from('clock_sessions')
                  .select('id, user_id, clocked_in_at, clocked_out_at, work_date, notes, job_ledger_id, bid_id, approved_at')
                  .eq('user_id', userId)
                  .eq('work_date', workDate)
                  .is('rejected_at', null)
                  .is('revoked_at', null)
                  .order('clocked_in_at', { ascending: true }),
              'PeopleHoursDayAuditModal clock_sessions'
            )
            if (gen !== fetchGenRef.current) return
            rows = (data ?? []) as ClockSessionRow[]
          } catch (e: unknown) {
            if (gen !== fetchGenRef.current) return
            clockErr = formatErrorMessage(e)
            rows = []
          }
        }

        const jobIds = new Set<string>()
        const bidIds = new Set<string>()
        for (const r of rows) {
          if (r.job_ledger_id) jobIds.add(r.job_ledger_id)
          if (r.bid_id) bidIds.add(r.bid_id)
        }
        const unified = initialCrewRow?.unifiedAssignments ?? []
        for (const a of unified) {
          if (a.type === 'job') jobIds.add(a.id)
          else bidIds.add(a.id)
        }

        const jobMap: Record<string, JobDetails> = {}
        const bidMap: Record<string, BidDetails> = {}

        if (jobIds.size > 0) {
          try {
            const list = await withSupabaseRetry(
              async () => {
                const r = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: [...jobIds] })
                return r as {
                  data: Array<{
                    id: string
                    hcp_number: string
                    job_name: string
                    job_address: string
                    service_type_id: string | null
                  }> | null
                  error: { message: string } | null
                }
              },
              'PeopleHoursDayAuditModal job labels'
            )
            if (gen !== fetchGenRef.current) return
            for (const j of list ?? []) {
              jobMap[j.id] = {
                hcp_number: j.hcp_number ?? '',
                job_name: j.job_name ?? '',
                job_address: j.job_address ?? '',
                service_type_id: j.service_type_id,
              }
            }
          } catch {
            if (gen !== fetchGenRef.current) return
          }
        }

        if (bidIds.size > 0) {
          try {
            const list = await withSupabaseRetry(
              async () => {
                const r = await supabase.rpc('get_bids_by_ids', { p_bid_ids: [...bidIds] })
                return r as {
                  data: Array<{
                    id: string
                    bid_number: string
                    project_name: string
                    address: string
                    service_type_id: string | null
                  }> | null
                  error: { message: string } | null
                }
              },
              'PeopleHoursDayAuditModal bid labels'
            )
            if (gen !== fetchGenRef.current) return
            for (const b of list ?? []) {
              bidMap[b.id] = {
                bid_number: b.bid_number ?? '',
                project_name: b.project_name ?? '',
                address: b.address ?? '',
                service_type_id: b.service_type_id,
              }
            }
          } catch {
            if (gen !== fetchGenRef.current) return
          }
        }

        if (gen !== fetchGenRef.current) return
        setSessions(rows)
        setSessionsFetchError(clockErr)
        setJobDetailsMap(jobMap)
        setBidDetailsMap(bidMap)
        setSessionsLoading(false)
      } catch (e: unknown) {
        if (gen !== fetchGenRef.current) return
        setSessionsFetchError(formatErrorMessage(e))
        setSessions([])
        setResolvedClockUserId(null)
        setSessionsLoading(false)
      }
    })()
  }, [personName, workDate, initialCrewRow])

  useEffect(() => {
    refreshSessions()
  }, [refreshSessions])

  useEffect(() => {
    if (!crewDirty) {
      setDraft(null)
    }
  }, [personName, workDate, initialCrewRow, crewDirty])

  useEffect(() => {
    const t = setTimeout(() => {
      if (jobSearchOpen && jobSearchText !== undefined) {
        const q = jobSearchText.trim()
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
          }>
          const bidsRaw = (bidsRes.data ?? []) as Array<{
            id: string
            bid_number?: string
            project_name: string
            address: string
            service_type_name?: string
            service_type_id: string | null
          }>
          const bids = bidsRaw.map((b) => ({ type: 'bid' as const, ...b, bid_number: b.bid_number ?? '' }))
          const merged = [...jobs.map((j) => ({ type: 'job' as const, ...j })), ...bids]
          setJobSearchResults(merged)
        })
      }
    }, 300)
    return () => clearTimeout(t)
  }, [jobSearchOpen, jobSearchText])

  function exitEditMode() {
    setIsEditMode(false)
    setDraft(null)
    setCrewDirty(false)
    setCrewSaveError(null)
    setJobSearchOpen(false)
    setJobSearchText('')
    setJobSearchResults([])
    setClockEditSession(null)
    setClockCreateOpen(false)
  }

  function handleHeaderEditToggle() {
    if (isEditMode) {
      exitEditMode()
      return
    }
    setIsEditMode(true)
  }

  function addAssignmentToDraft(
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
    const current = draft ?? rowFromMap
    if (current.unifiedAssignments.some((a) => a.type === item.type && a.id === item.id)) return
    const n = current.unifiedAssignments.length + 1
    const pct = Math.round((100 / n) * 10) / 10
    const newAssignments = current.unifiedAssignments.map((a) => ({ ...a, pct }))
    newAssignments.push({
      type: item.type,
      id: item.id,
      pct: Math.round((100 - newAssignments.reduce((s, a) => s + a.pct, 0)) * 10) / 10,
    })
    if (item.type === 'job') {
      setJobDetailsMap((prev) => ({
        ...prev,
        [item.id]: {
          hcp_number: item.hcp_number,
          job_name: item.job_name,
          job_address: item.job_address,
          service_type_id: item.service_type_id ?? null,
        },
      }))
    } else {
      setBidDetailsMap((prev) => ({
        ...prev,
        [item.id]: {
          bid_number: item.bid_number,
          project_name: item.project_name,
          address: item.address,
          service_type_id: item.service_type_id ?? null,
        },
      }))
    }
    setDraft({ ...current, unifiedAssignments: newAssignments })
    setCrewDirty(true)
  }

  /**
   * Approve one or more pending clock sessions and refresh the modal.
   *
   * The server-side `approve_clock_sessions` RPC also runs `sync_crew_jobs_from_clock(person, date)`
   * for any session that had a `job_ledger_id`, so after this call returns the audit modal's
   * "Job / bid assignments" panel and the parent Quickfill list will both show the new attribution
   * (parent picks it up via `onCrewSaved`, which re-runs `loadAll` and the unallocated-rows compute).
   */
  async function handleApproveSessions(sessionIds: string[]): Promise<void> {
    if (!canEditCrewJobs) return
    if (sessionIds.length === 0) return
    setApprovingSessionIds((prev) => {
      const next = new Set(prev)
      for (const id of sessionIds) next.add(id)
      return next
    })
    const { data, error } = await approveClockSessions(sessionIds)
    setApprovingSessionIds((prev) => {
      const next = new Set(prev)
      for (const id of sessionIds) next.delete(id)
      return next
    })
    if (error) {
      showToast?.(error.message, 'error')
      return
    }
    const result = (data ?? []) as Array<{ approved_count: number; error_message: string | null }>
    const row = result[0]
    if (row?.error_message) {
      showToast?.(row.error_message, 'error')
      return
    }
    showToast?.(
      `Approved ${row?.approved_count ?? sessionIds.length} session${
        (row?.approved_count ?? sessionIds.length) === 1 ? '' : 's'
      }.`,
      'success',
    )
    refreshSessions()
    onCrewSaved?.()
  }

  async function handleSaveCrew() {
    if (!canEditCrewJobs) return
    const toSave = draft ?? rowFromMap
    const { jobAssignments, bidAssignments } = splitFromUnified(toSave.unifiedAssignments)
    setCrewSaveError(null)
    setCrewSaving(true)
    try {
      await withSupabaseRetry(
        async () => {
          const r = await supabase.from('people_crew_jobs').upsert(
            {
              work_date: workDate,
              person_name: personName,
              job_assignments: jobAssignments,
            },
            { onConflict: 'work_date,person_name' }
          )
          return r as { data: unknown; error: { message: string } | null }
        },
        'PeopleHoursDayAuditModal save people_crew_jobs'
      )
      await withSupabaseRetry(
        async () => {
          const r = await supabase.from('people_crew_bids').upsert(
            {
              work_date: workDate,
              person_name: personName,
              bid_assignments: bidAssignments,
            },
            { onConflict: 'work_date,person_name' }
          )
          return r as { data: unknown; error: { message: string } | null }
        },
        'PeopleHoursDayAuditModal save people_crew_bids'
      )
    } catch (e: unknown) {
      setCrewSaveError(formatErrorMessage(e))
      showToast?.(formatErrorMessage(e), 'error')
      setCrewSaving(false)
      return
    }
    setCrewSaving(false)
    setCrewDirty(false)
    setDraft(null)
    onCrewSaved?.()
    showToast?.('Crew assignments saved.', 'success')
  }

  const dateLabel = useMemo(() => {
    try {
      return new Date(workDate + 'T12:00:00').toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return workDate
    }
  }, [workDate])

  const onDispatchDataError = useCallback(
    (message: string, variant: 'error' | 'warning') => {
      showToast?.(message, variant)
    },
    [showToast],
  )

  /** Closed, unapproved sessions that already link to a job or bid — the audit-relevant set: approving any of these auto-creates the people_crew_jobs / people_crew_bids row that drives "Job / bid assignments" and Quickfill's Unassigned-field-time list. */
  const pendingLinkedSessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          s.clocked_out_at != null && !s.approved_at && (!!s.job_ledger_id || !!s.bid_id),
      ),
    [sessions],
  )

  /** Up to 2 distinct linked job/bid labels for the pending-approval banner; "+N more" suffix when more. */
  const pendingLinkedLabelSummary = useMemo(() => {
    if (pendingLinkedSessions.length === 0) return ''
    const labels: string[] = []
    const seen = new Set<string>()
    for (const s of pendingLinkedSessions) {
      let label: string | null = null
      if (s.job_ledger_id) {
        const j = jobDetailsMap[s.job_ledger_id]
        label = j
          ? formatJobLedgerShortLine(prefixMap, j.service_type_id ?? null, j.hcp_number, j.job_name)
          : 'a job'
      } else if (s.bid_id) {
        const b = bidDetailsMap[s.bid_id]
        label = b
          ? formatBidLedgerShortLine(prefixMap, b.service_type_id ?? null, b.bid_number, b.project_name)
          : 'a bid'
      }
      if (!label) continue
      if (seen.has(label)) continue
      seen.add(label)
      labels.push(label)
    }
    if (labels.length === 0) return ''
    if (labels.length === 1) return labels[0]
    if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
    return `${labels[0]}, ${labels[1]} and ${labels.length - 2} more`
  }, [pendingLinkedSessions, jobDetailsMap, bidDetailsMap, prefixMap])

  /** Empty state of the live (draft or persisted) crew assignment list — drives whether the pending-banner shows up under "Job / bid assignments". */
  const crewAssignmentsEmpty = (draftRow.unifiedAssignments?.length ?? 0) === 0

  const pendingApproveBanner =
    !sessionsUserMissing && crewAssignmentsEmpty && pendingLinkedSessions.length > 0 ? (
      <div
        style={{
          padding: '0.5rem 0.65rem',
          border: '1px solid #fde68a',
          background: '#fffbeb',
          borderRadius: 6,
          fontSize: '0.8125rem',
          color: '#92400e',
          marginBottom: '0.75rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.4rem',
          alignItems: 'center',
        }}
      >
        <span>
          <strong>{pendingLinkedSessions.length}</strong> pending{' '}
          {pendingLinkedSessions.length === 1 ? 'session links' : 'sessions link'} to{' '}
          <strong>{pendingLinkedLabelSummary}</strong>. Approve{' '}
          {pendingLinkedSessions.length === 1 ? 'it' : 'them'} above to auto-assign these hours.
        </span>
        {canEditCrewJobs && pendingLinkedSessions.length > 1 ? (
          <button
            type="button"
            disabled={pendingLinkedSessions.every((s) => approvingSessionIds.has(s.id))}
            onClick={() => void handleApproveSessions(pendingLinkedSessions.map((s) => s.id))}
            style={{
              marginLeft: 'auto',
              padding: '0.2rem 0.5rem',
              fontSize: '0.75rem',
              border: '1px solid #16a34a',
              borderRadius: 4,
              background: '#f0fdf4',
              color: '#15803d',
              cursor: 'pointer',
            }}
          >
            Approve all ({pendingLinkedSessions.length})
          </button>
        ) : null}
      </div>
    ) : null

  const dispatchData = usePersonDayScheduleData(
    resolvedClockUserId,
    resolvedClockUserId ? workDate : null,
    onDispatchDataError,
  )
  const dispatchNowMs = useIntervalNowMs(45_000)
  const dispatchSegments = useMemo(
    () => blocksToSegments(dispatchData.blocks, new Map(dispatchData.jobTitleById)),
    [dispatchData.blocks, dispatchData.jobTitleById],
  )
  const dispatchSecondaryBands = useMemo(
    () =>
      clockSessionsToDispatchSecondaryBands(
        dispatchData.sessions,
        workDate,
        dispatchNowMs,
        new Map(dispatchData.jobTitleById),
        new Map(dispatchData.bidTitleById),
      ),
    [
      dispatchData.sessions,
      workDate,
      dispatchNowMs,
      dispatchData.jobTitleById,
      dispatchData.bidTitleById,
    ],
  )
  const scheduleDispatchHref = useMemo(() => {
    const weekStart = companyWeekStartSundayContaining(workDate) ?? getDefaultWeekRange().start
    return `/schedule-dispatch?week=${encodeURIComponent(weekStart)}&day=${encodeURIComponent(workDate)}`
  }, [workDate])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002 }}>
      {clockEditSession && (
        <ClockSessionEditSplitModal
          session={{
            id: clockEditSession.id,
            user_id: clockEditSession.user_id,
            clocked_in_at: clockEditSession.clocked_in_at,
            clocked_out_at: clockEditSession.clocked_out_at,
            work_date: clockEditSession.work_date,
            notes: clockEditSession.notes,
            job_ledger_id: clockEditSession.job_ledger_id,
            bid_id: clockEditSession.bid_id,
            approved_at: clockEditSession.approved_at,
          }}
          onClose={() => setClockEditSession(null)}
          onSaved={() => {
            setClockEditSession(null)
            refreshSessions()
          }}
          showToast={showToast}
          zIndex={1110}
        />
      )}
      {clockCreateOpen && resolvedClockUserId && (
        <ClockSessionEditSplitModal
          createFor={{ userId: resolvedClockUserId, workDate }}
          onClose={() => setClockCreateOpen(false)}
          onSaved={() => {
            setClockCreateOpen(false)
            refreshSessions()
          }}
          showToast={showToast}
          zIndex={1110}
        />
      )}
      <div
        style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: '90%', maxHeight: '90vh', overflow: 'auto' }}
        role="dialog"
        aria-labelledby="hours-day-audit-title"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.35rem' }}>
          <h3 id="hours-day-audit-title" style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>
            {personName} — {dateLabel}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
            {canEditCrewJobs ? (
              <button
                type="button"
                onClick={handleHeaderEditToggle}
                style={{ padding: '0.35rem 0.65rem', border: '1px solid #2563eb', borderRadius: 4, background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontSize: '0.8125rem' }}
              >
                {isEditMode ? 'Done' : 'Edit'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                exitEditMode()
                onClose()
              }}
              style={{ padding: '0.35rem 0.65rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.8125rem' }}
              aria-label="Close day audit"
            >
              Close
            </button>
          </div>
        </div>
        <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0 0 1rem 0' }}>
          {isEditMode && canEditCrewJobs
            ? 'Editing — save crew assignments with Save; clock changes apply when you confirm in the clock dialog.'
            : canEditCrewJobs
              ? 'Click Edit to change assignments or sessions.'
              : 'View only — you don\u2019t have permission to edit this day.'}
        </p>

        <div
          style={{
            marginBottom: '1rem',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '0.75rem',
            background: '#f9fafb',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>Dispatch</span>
            <Link
              to={scheduleDispatchHref}
              onClick={() => {
                exitEditMode()
                onClose()
              }}
              style={{
                padding: '0.2rem 0.45rem',
                fontSize: '0.75rem',
                border: '1px solid #2563eb',
                borderRadius: 4,
                background: '#eff6ff',
                color: '#1d4ed8',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
              title={`Open Schedule Dispatch for the week of ${dateLabel}`}
              aria-label={`Open Schedule Dispatch for ${personName} on ${dateLabel}`}
            >
              Open in Schedule Dispatch
            </Link>
          </div>
          {sessionsUserMissing ? (
            <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>
              No login account linked to this name in Users — dispatch cannot be shown.
            </p>
          ) : !resolvedClockUserId || dispatchData.loading ? (
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>Loading…</p>
          ) : (
            <>
              <div style={{ background: 'white', borderRadius: 6, border: '1px solid #e5e7eb', padding: '0.25rem 0.5rem', marginBottom: dispatchData.blocks.length > 0 ? '0.5rem' : 0 }}>
                <QuickfillScheduleUserRow
                  userId={resolvedClockUserId}
                  displayName={personName}
                  scheduleDayYmd={workDate}
                  segments={dispatchSegments}
                  secondaryBands={dispatchSecondaryBands}
                  showNameColumn={false}
                />
              </div>
              {dispatchData.blocks.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>
                  No dispatch blocks for this day.
                </p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8125rem', color: '#374151', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {dispatchData.blocks.map((b) => {
                    const jobLabel =
                      dispatchData.jobTitleById.get(b.job_id) ??
                      formatScheduleDispatchHubJobTitle(null, null)
                    const note = (b.note ?? '').trim()
                    return (
                      <li key={b.id} style={{ lineHeight: 1.35 }}>
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: '#111827', fontWeight: 500 }}>
                          {scheduleFormatWindow(b.time_start, b.time_end)}
                        </span>
                        <span style={{ color: '#1d4ed8', marginLeft: '0.4rem' }} title={jobLabel}>
                          {jobLabel}
                        </span>
                        {note ? (
                          <span style={{ color: '#4b5563', marginLeft: '0.4rem' }} title={note}>
                            — {note}
                          </span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        <div
          style={{
            marginBottom: '1rem',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '0.75rem',
            background: '#f9fafb',
          }}
        >
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#111827' }}>Clock sessions</div>
          {sessionsUserMissing && (
            <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>
              No login account linked to this name in Users — clock sessions cannot be shown.
              {isEditMode ? ' Clock editing is unavailable.' : ''}
            </p>
          )}
          {sessionsFetchError && <p style={{ fontSize: '0.8125rem', color: '#b91c1c', margin: 0 }}>{sessionsFetchError}</p>}
          {sessionsLoading && <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>Loading…</p>}
          {!sessionsLoading && !sessionsUserMissing && !sessionsFetchError && sessions.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>No clock sessions for this day.</p>
              {isEditMode && canEditCrewJobs && resolvedClockUserId ? (
                <button
                  type="button"
                  onClick={() => {
                    setClockEditSession(null)
                    setClockCreateOpen(true)
                  }}
                  style={{
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.8125rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Add session
                </button>
              ) : null}
            </div>
          )}
          {!sessionsLoading && sessions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {sessions.map((s) => {
                const tIn = new Date(s.clocked_in_at)
                const tOut = s.clocked_out_at ? new Date(s.clocked_out_at) : null
                const nowMs = Date.now()
                const durSec = clockSessionDurationSeconds(s, nowMs)
                const notesRaw = (s.notes ?? '').trim()
                const notesDisplay = notesRaw.length > 80 ? `${notesRaw.slice(0, 77)}…` : notesRaw
                const job = s.job_ledger_id ? jobDetailsMap[s.job_ledger_id] : undefined
                const bid = s.bid_id ? bidDetailsMap[s.bid_id] : undefined
                let linkLabel: string | null = null
                if (s.job_ledger_id) {
                  linkLabel = job
                    ? formatJobLedgerShortLine(prefixMap, job.service_type_id ?? null, job.hcp_number, job.job_name)
                    : 'Job'
                } else if (s.bid_id) {
                  linkLabel = bid
                    ? formatBidLedgerShortLine(prefixMap, bid.service_type_id ?? null, bid.bid_number, bid.project_name)
                    : 'Bid'
                }
                const showClockEdit = isEditMode && canEditCrewJobs && !sessionsUserMissing && !!s.user_id
                const isApproved = !!s.approved_at
                const isClosed = s.clocked_out_at != null
                /** Only closed pending sessions can be approved (open sessions need clock-out first; matches approve_clock_sessions guard). */
                const canApprove =
                  canEditCrewJobs && !sessionsUserMissing && !isApproved && isClosed && !!s.user_id
                const isApproving = approvingSessionIds.has(s.id)
                /**
                 * Per-row job/bid assignment is the canonical fix for "unallocated field time" when the
                 * session was clocked without selecting a job. Setting `clock_sessions.job_ledger_id`
                 * fires the `clock_sessions_sync_crew_assignments_after_job_bid` trigger (migration
                 * 20260402120000), which re-runs `sync_crew_jobs_from_clock` for this (person, date)
                 * — so for already-approved sessions the crew row updates immediately and the
                 * Quickfill Unassigned section drops the row on the next `onCrewSaved` refresh.
                 */
                const canAssignSessionJob =
                  canEditCrewJobs &&
                  !sessionsUserMissing &&
                  !!s.user_id &&
                  !s.job_ledger_id &&
                  !s.bid_id
                return (
                  <div
                    key={s.id}
                    style={{
                      fontSize: '0.8125rem',
                      padding: '0.45rem 0.5rem',
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', marginBottom: notesRaw ? '0.25rem' : 0 }}>
                      <span style={{ color: '#374151' }}>
                        {tIn.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                        {' → '}
                        {tOut ? tOut.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'Open'}
                      </span>
                      <span style={{ color: '#6b7280' }}>({formatHmsTotal(durSec)})</span>
                      {linkLabel && (
                        <span style={{ color: '#1d4ed8', fontWeight: 500 }} title={linkLabel}>
                          {linkLabel}
                        </span>
                      )}
                      <span
                        title={
                          isApproved
                            ? 'Approved — counts in payroll and crew assignments.'
                            : isClosed
                              ? 'Pending approval — does not count in payroll or crew assignments yet.'
                              : 'Open session (still clocked in).'
                        }
                        style={{
                          padding: '0.05rem 0.35rem',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          letterSpacing: '0.02em',
                          textTransform: 'uppercase',
                          borderRadius: 4,
                          border: `1px solid ${isApproved ? '#16a34a' : isClosed ? '#d97706' : '#6b7280'}`,
                          background: isApproved ? '#f0fdf4' : isClosed ? '#fffbeb' : '#f3f4f6',
                          color: isApproved ? '#166534' : isClosed ? '#b45309' : '#374151',
                        }}
                      >
                        {isApproved ? 'Approved' : isClosed ? 'Pending' : 'Open'}
                      </span>
                      {(showClockEdit || canApprove || canAssignSessionJob) ? (
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                          {canAssignSessionJob ? (
                            <AssignSessionJobPopover
                              session={{ id: s.id, job_ledger_id: s.job_ledger_id, bid_id: s.bid_id }}
                              popoverZIndex={1110}
                              dispatchScheduleAssigneeUserId={s.user_id}
                              dispatchScheduleWorkDateYmd={workDate}
                              onSaved={() => {
                                refreshSessions()
                                onCrewSaved?.()
                                showToast?.('Job assigned to clock session.', 'success')
                              }}
                              onError={(msg) => showToast?.(msg, 'error')}
                            />
                          ) : null}
                          {canApprove ? (
                            <button
                              type="button"
                              disabled={isApproving}
                              onClick={() => void handleApproveSessions([s.id])}
                              title={
                                s.job_ledger_id || s.bid_id
                                  ? 'Approve this session — will auto-assign these hours to the linked job/bid.'
                                  : 'Approve this session.'
                              }
                              style={{
                                padding: '0.15rem 0.45rem',
                                fontSize: '0.75rem',
                                border: `1px solid ${isApproving ? '#9ca3af' : '#16a34a'}`,
                                borderRadius: 4,
                                background: isApproving ? '#f3f4f6' : '#f0fdf4',
                                color: isApproving ? '#6b7280' : '#15803d',
                                cursor: isApproving ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {isApproving ? 'Approving…' : 'Approve'}
                            </button>
                          ) : null}
                          {showClockEdit ? (
                            <button
                              type="button"
                              onClick={() => setClockEditSession(s)}
                              style={{ padding: '0.15rem 0.45rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {notesRaw ? (
                      <div style={{ color: '#4b5563' }} title={notesRaw}>
                        {notesDisplay || '—'}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div
          style={{
            marginBottom: '1rem',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '0.75rem',
            background: '#f9fafb',
          }}
        >
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#111827' }}>Job / bid assignments</div>

          {pendingApproveBanner}

          {isEditMode && canEditCrewJobs ? (
            <>
              {crewSaveError ? <p style={{ fontSize: '0.8125rem', color: '#b91c1c', margin: '0 0 0.5rem 0' }}>{crewSaveError}</p> : null}
              <div style={{ marginBottom: '1rem' }}>
                    <div style={{ marginBottom: '0.35rem' }}>
                      <label style={{ fontSize: '0.875rem' }}>Assignments</label>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                      {draftRow.unifiedAssignments.map((a, idx) => {
                        const details = a.type === 'job' ? jobDetailsMap[a.id] : bidDetailsMap[a.id]
                        const label = formatAssignmentLabel(a.type, details, prefixMap) || a.id.slice(0, 8)
                        return (
                          <span
                            key={getAssignmentKey(a)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.4rem', background: '#f3f4f6', borderRadius: 4, fontSize: '0.8125rem' }}
                          >
                            <span>{label}</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={a.pct}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0
                                const rest = draftRow.unifiedAssignments.filter((_, i) => i !== idx)
                                const restSum = rest.reduce((s, x) => s + x.pct, 0)
                                const scale = restSum > 0 ? (100 - v) / restSum : 1
                                let newAssignments = draftRow.unifiedAssignments.map((x, i) =>
                                  i === idx ? { ...x, pct: v } : { ...x, pct: Math.round(x.pct * scale * 10) / 10 }
                                )
                                const sum = newAssignments.reduce((s, x) => s + x.pct, 0)
                                if (Math.abs(sum - 100) > 0.01 && newAssignments.length > 0) {
                                  const lastIdx = newAssignments.length - 1
                                  newAssignments = newAssignments.map((x, i) =>
                                    i === lastIdx ? { ...x, pct: Math.round((x.pct + (100 - sum)) * 10) / 10 } : x
                                  )
                                }
                                setDraft({ ...draftRow, unifiedAssignments: newAssignments })
                                setCrewDirty(true)
                              }}
                              style={{ width: 44, padding: '0.15rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                            />
                            %
                            <button
                              type="button"
                              onClick={() => {
                                const rest = draftRow.unifiedAssignments.filter((_, i) => i !== idx)
                                if (rest.length === 0) {
                                  setDraft({ ...draftRow, unifiedAssignments: [] })
                                  setCrewDirty(true)
                                  return
                                }
                                const n = rest.length
                                const pctEach = Math.round((100 / n) * 10) / 10
                                const newAssignments = rest.map((x, i) => ({
                                  ...x,
                                  pct: i === n - 1 ? Math.round((100 - (n - 1) * pctEach) * 10) / 10 : pctEach,
                                }))
                                setDraft({ ...draftRow, unifiedAssignments: newAssignments })
                                setCrewDirty(true)
                              }}
                              style={{ padding: '0.1rem 0.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.875rem', lineHeight: 1 }}
                              title="Remove"
                            >
                              ×
                            </button>
                          </span>
                        )
                      })}
                      {!jobSearchOpen ? (
                        <button
                          type="button"
                          onClick={() => {
                            setJobSearchOpen(true)
                            setJobSearchText('')
                            setJobSearchResults([])
                          }}
                          style={{ padding: '0.2rem 0.5rem', border: '1px dashed #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: '0.8125rem' }}
                        >
                          +
                        </button>
                      ) : (
                        <div style={{ width: '100%', marginTop: '0.5rem' }}>
                          <input
                            type="search"
                            placeholder="Search HCP, bid #, job name, project, address…"
                            value={jobSearchText}
                            onChange={(e) => setJobSearchText(e.target.value)}
                            autoFocus
                            style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                          />
                          <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: '0.5rem' }}>
                            {jobSearchResults.map((item) => (
                              <button
                                key={`${item.type}:${item.id}`}
                                type="button"
                                onClick={() => {
                                  addAssignmentToDraft(
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
                                        },
                                  )
                                  setJobSearchOpen(false)
                                  setJobSearchText('')
                                  setJobSearchResults([])
                                }}
                                style={{ display: 'block', width: '100%', padding: '0.5rem', textAlign: 'left', border: 'none', borderBottom: '1px solid #e5e7eb', background: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                              >
                                <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  {(() => {
                                    const t = getBidServiceTypeTag(item.service_type_name)
                                    return t ? (
                                      <span style={{ padding: '0.1rem 0.35rem', fontSize: '0.6875rem', fontWeight: 500, background: t.color, color: '#fff', borderRadius: 4 }}>
                                        [{t.tag}]
                                      </span>
                                    ) : null
                                  })()}
                                  {item.type === 'job'
                                    ? formatJobLedgerShortLine(prefixMap, item.service_type_id ?? null, item.hcp_number, item.job_name)
                                    : formatBidLedgerShortLine(prefixMap, item.service_type_id ?? null, item.bid_number, item.project_name)}
                                </div>
                                {(item.type === 'job' ? item.job_address : item.address) ? (
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{item.type === 'job' ? item.job_address : item.address}</div>
                                ) : null}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setJobSearchOpen(false)
                              setJobSearchText('')
                              setJobSearchResults([])
                            }}
                            style={{ fontSize: '0.8125rem' }}
                          >
                            Cancel search
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
              <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  disabled={crewSaving || !crewDirty}
                  onClick={() => void handleSaveCrew()}
                  style={{
                    padding: '0.5rem 1rem',
                    background: crewSaving || !crewDirty ? '#9ca3af' : '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: crewSaving || !crewDirty ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  {crewSaving ? 'Saving…' : 'Save crew'}
                </button>
              </div>
            </>
          ) : (
            <>
              {!initialCrewRow || (initialCrewRow.unifiedAssignments?.length ?? 0) === 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>No job or bid assignments for this day.</p>
                  {canEditCrewJobs ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditMode(true)
                        setJobSearchOpen(true)
                        setJobSearchText('')
                        setJobSearchResults([])
                      }}
                      style={{
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.8125rem',
                        border: '1px solid #2563eb',
                        borderRadius: 4,
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        cursor: 'pointer',
                      }}
                      title="Open the search and add a job or bid for this day."
                    >
                      Assign a job or bid
                    </button>
                  ) : null}
                </div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8125rem', color: '#374151' }}>
                  {initialCrewRow.unifiedAssignments.map((a) => {
                    const details = a.type === 'job' ? jobDetailsMap[a.id] : bidDetailsMap[a.id]
                    const label = formatAssignmentLabel(a.type, details, prefixMap)
                    return (
                      <li key={`${a.type}:${a.id}`} style={{ marginBottom: '0.35rem' }}>
                        {label} — {a.pct}%
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  )
}
