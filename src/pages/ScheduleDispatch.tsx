import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useAuth } from '../hooks/useAuth'
import { useToastContext } from '../contexts/ToastContext'
import { useJobFormModal } from '../contexts/JobFormModalContext'
import {
  deleteJobScheduleBlock,
  fetchJobScheduleBlocksForHubDateRange,
  fetchJobScheduleBlocksForJobDateRange,
  fetchScheduleBlocksForAssigneesOnDay,
  fetchScheduleJobContext,
  insertJobScheduleBlock,
  newJobScheduleSharedBlockGroupId,
  updateJobScheduleBlock,
  updateJobScheduleBlockGroup,
  type JobScheduleBlockRow,
  type ScheduleTeamMember,
} from '../lib/jobScheduleBlocks'
import { buildLinkedGroupAccentMap } from '../lib/scheduleDispatchLinkedGroupPalette'
import {
  DISPATCH_ADD_BLOCK_SLOT_COUNT,
  MIN_MIN,
  MAX_MIN,
  clampDispatchEndStartForMinDuration,
  clampDispatchStartEndForMinDuration,
  dispatchMinutesToHHmm,
  dispatchMinutesToSlotIndex,
  dispatchSlotIndexToMinutes,
  formatBlockDurationAriaLabel,
  formatBlockDurationMinutes,
  formatDispatchQuickTimeLabel,
  timeInputToMinutesSafe,
  timeInputToPg,
} from '../lib/dispatchAddBlockTime'
import {
  scheduleBlockToRange,
  scheduleOverlapsAny,
  scheduleTimeToMinutesFromMidnight,
  validateJobScheduleBlockMinuteRange,
} from '../lib/jobScheduleOverlap'
import { scheduleFormatWeekdayLong, scheduleFormatWindow } from '../lib/jobScheduleChicago'
import { executeScheduleDispatchBlockReassign } from '../lib/scheduleDispatchDragEnd'
import { insertScheduleDispatchCopiedLeg } from '../lib/scheduleDispatchMirrorInsert'
import { fetchSalariedUserIdSetFromUserIds } from '../lib/salaryPayConfigGate'
import { DispatchAddBlockTimeRange } from '../components/schedule/DispatchAddBlockTimeRange'
import DetailJobModal, { type DetailJobScheduleContext } from '../components/jobs/DetailJobModal'
import { PreviewJobModal } from '../components/calendar/PreviewJobModal'
import { LinkedScheduleGroupModal } from '../components/schedule/LinkedScheduleGroupModal'
import { ScheduleDispatchHub } from '../components/schedule/ScheduleDispatchHub'
import {
  cellKey,
  ScheduleDispatchGrid,
  type ScheduleDispatchCardPlacementMode,
} from '../components/schedule/ScheduleDispatchGrid'
import {
  aggregateWeekSummariesByJob,
  blocksToJobWeekSummaries,
  buildPersonDayBlockMap,
  fetchJobsLedgerForScheduleDispatchHub,
  fetchTeamMemberUserIdsForJobIds,
  fetchUserNamesForIds,
  fetchUsersTabUserIdsForScheduleDispatchHub,
  formatScheduleDispatchHubJobTitle,
  type ScheduleDispatchHubJobRow,
} from '../lib/scheduleDispatchHub'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import {
  companyWeekStartSundayContaining,
  denverCalendarDayKey,
  formatScheduleDispatchVisibleDateRange,
  getDefaultWeekRange,
  getScheduleDispatchVisibleDayKeys,
  ymdAddDays,
} from '../utils/dateUtils'

const SCHEDULE_DISPATCH_HIDE_WEEKEND_STORAGE_KEY = 'scheduleDispatchHideWeekend'
const SCHEDULE_DISPATCH_HIGHLIGHT_LINKED_GROUPS_KEY = 'scheduleDispatchHighlightLinkedGroups'

function readScheduleDispatchHideWeekend(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const v = window.localStorage.getItem(SCHEDULE_DISPATCH_HIDE_WEEKEND_STORAGE_KEY)
    if (v === '0') return false
    if (v === '1') return true
    return true
  } catch {
    return true
  }
}

function readScheduleDispatchHighlightLinkedGroups(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SCHEDULE_DISPATCH_HIGHLIGHT_LINKED_GROUPS_KEY) === '1'
  } catch {
    return false
  }
}

const CAN_USE_SCHEDULE_DISPATCH = new Set([
  'dev',
  'master_technician',
  'assistant',
  'superintendent',
])

/** Matches RLS on jobs_ledger_team_members INSERT (no superintendent). */
const CAN_ADD_TO_JOB_ROSTER = new Set(['dev', 'master_technician', 'assistant'])

type ScheduleDispatchBlockModalState =
  | { kind: 'add'; assigneeUserId: string; workDate: string; jobId: string }
  | { kind: 'edit'; blockId: string }

type HubAssignJobPlacementState = { jobId: string }

function validateRange(timeStart: string, timeEnd: string): string | null {
  const ts = timeInputToPg(timeStart)
  const te = timeInputToPg(timeEnd)
  const sm = scheduleTimeToMinutesFromMidnight(ts)
  const em = scheduleTimeToMinutesFromMidnight(te)
  return validateJobScheduleBlockMinuteRange({
    startMin: sm,
    endMin: em,
    minWallMin: MIN_MIN,
    maxWallMin: MAX_MIN,
  })
}

function AddBlockModal({
  open,
  mode,
  jobTitle,
  personLabel,
  workDate,
  timeStart,
  timeEnd,
  note,
  saving,
  error,
  onClose,
  onChangeStart,
  onChangeEnd,
  onChangeNote,
  onSave,
}: {
  open: boolean
  mode: 'add' | 'edit'
  jobTitle: string
  personLabel: string
  workDate: string
  timeStart: string
  timeEnd: string
  note: string
  saving: boolean
  error: string | null
  onClose: () => void
  onChangeStart: (v: string) => void
  onChangeEnd: (v: string) => void
  onChangeNote: (v: string) => void
  onSave: () => void
}) {
  const startMin = useMemo(() => timeInputToMinutesSafe(timeStart), [timeStart])
  const endMin = useMemo(() => timeInputToMinutesSafe(timeEnd), [timeEnd])
  const startSlotIndex = useMemo(() => dispatchMinutesToSlotIndex(startMin), [startMin])
  const endSlotIndex = useMemo(() => dispatchMinutesToSlotIndex(endMin), [endMin])

  const { durationDisplay, durationAriaLabel } = useMemo(() => {
    const dm = endMin > startMin ? endMin - startMin : Number.NaN
    return {
      durationDisplay: formatBlockDurationMinutes(dm),
      durationAriaLabel: formatBlockDurationAriaLabel(dm),
    }
  }, [startMin, endMin])

  const onStartSliderChange = useCallback(
    (slotIndex: number) => {
      const sMin = dispatchSlotIndexToMinutes(slotIndex)
      const eMinCur = timeInputToMinutesSafe(timeEnd)
      const { s, e } = clampDispatchStartEndForMinDuration(sMin, eMinCur)
      onChangeStart(dispatchMinutesToHHmm(s))
      onChangeEnd(dispatchMinutesToHHmm(e))
    },
    [timeEnd, onChangeStart, onChangeEnd],
  )

  const onEndSliderChange = useCallback(
    (slotIndex: number) => {
      const eMin = dispatchSlotIndexToMinutes(slotIndex)
      const sMinCur = timeInputToMinutesSafe(timeStart)
      const { s, e } = clampDispatchEndStartForMinDuration(eMin, sMinCur)
      onChangeStart(dispatchMinutesToHHmm(s))
      onChangeEnd(dispatchMinutesToHHmm(e))
    },
    [timeStart, onChangeStart, onChangeEnd],
  )

  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1002,
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-labelledby="schedule-dispatch-add-title"
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 420,
          width: '92%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="schedule-dispatch-add-title"
          style={{
            margin: '0 0 0.75rem',
            fontSize: '1.05rem',
            lineHeight: 1.35,
            wordBreak: 'break-word',
          }}
        >
          {mode === 'edit' ? 'Edit schedule block' : 'Add schedule block'}
          {jobTitle.trim() ? (
            <>
              {' '}
              <span aria-hidden>·</span>{' '}
              <span title={jobTitle} style={{ fontSize: '0.9rem', color: '#374151', fontWeight: 600 }}>
                {jobTitle}
              </span>
            </>
          ) : null}
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.35, wordBreak: 'break-word' }}>
          <strong>{personLabel}</strong>
          {workDate.trim() ? (
            <>
              {' '}
              <span aria-hidden>·</span>{' '}
              <span title={workDate}>{scheduleFormatWeekdayLong(workDate)}</span>
            </>
          ) : null}
        </p>
        {error ? (
          <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: '0 0 0.75rem', whiteSpace: 'pre-wrap' }}>{error}</p>
        ) : null}
        <div style={{ marginBottom: '0.75rem' }}>
          <DispatchAddBlockTimeRange
            slotCount={DISPATCH_ADD_BLOCK_SLOT_COUNT}
            startSlotIndex={startSlotIndex}
            endSlotIndex={endSlotIndex}
            onStartChange={onStartSliderChange}
            onEndChange={onEndSliderChange}
            formatAriaValue={(i) =>
              formatDispatchQuickTimeLabel(dispatchMinutesToHHmm(dispatchSlotIndexToMinutes(i)))
            }
            disabled={saving}
            groupAriaLabel="Scheduled block time, 30-minute steps from 4:00 AM to 8:00 PM Central"
          />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'flex-end' }}>
          <label style={{ fontSize: '0.75rem', color: '#6b7280', flex: '1 1 120px' }}>
            Start
            <input
              type="time"
              value={timeStart}
              onChange={(e) => onChangeStart(e.target.value)}
              style={{ display: 'block', marginTop: 4, width: '100%', padding: '0.35rem' }}
            />
          </label>
          <div
            role="status"
            aria-live="polite"
            aria-label={durationAriaLabel}
            style={{
              flex: '0 0 auto',
              textAlign: 'center',
              minWidth: 72,
              paddingBottom: 2,
            }}
          >
            <div style={{ fontSize: '0.65rem', color: '#6b7280', marginBottom: 2 }}>Duration</div>
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: '#374151',
              }}
            >
              {durationDisplay}
            </div>
          </div>
          <label style={{ fontSize: '0.75rem', color: '#6b7280', flex: '1 1 120px' }}>
            End
            <input
              type="time"
              value={timeEnd}
              onChange={(e) => onChangeEnd(e.target.value)}
              style={{ display: 'block', marginTop: 4, width: '100%', padding: '0.35rem' }}
            />
          </label>
        </div>
        <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.75rem' }}>
          Note (optional)
          <input
            type="text"
            value={note}
            onChange={(e) => onChangeNote(e.target.value)}
            maxLength={500}
            style={{ display: 'block', marginTop: 4, width: '100%', padding: '0.4rem', fontSize: '0.875rem' }}
          />
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.45rem 1rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave()}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.875rem',
              background: saving ? '#e5e7eb' : '#2563eb',
              color: saving ? '#6b7280' : '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ScheduleDispatch() {
  const { user: authUser, role, loading: authLoading } = useAuth()
  const { showToast } = useToastContext()
  const jobFormModal = useJobFormModal()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const jobId = searchParams.get('jobId')?.trim() ?? ''
  const weekRaw = searchParams.get('week')?.trim() ?? ''
  const hubTabIsJobs = searchParams.get('hubTab') === 'jobs'

  const defaultWeekStart = useMemo(() => getDefaultWeekRange().start, [])
  const weekStart = useMemo(() => {
    if (!weekRaw) return defaultWeekStart
    const n = companyWeekStartSundayContaining(weekRaw)
    return n ?? defaultWeekStart
  }, [weekRaw, defaultWeekStart])

  useEffect(() => {
    if (!weekRaw) return
    const n = companyWeekStartSundayContaining(weekRaw)
    if (n && n !== weekRaw) {
      if (jobId) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          next.set('jobId', jobId)
          next.set('week', n)
          return next
        }, { replace: true })
      } else {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          next.set('week', n)
          if (hubTabIsJobs) next.set('hubTab', 'jobs')
          else next.delete('hubTab')
          return next
        }, { replace: true })
      }
    }
  }, [jobId, weekRaw, setSearchParams, hubTabIsJobs])

  const weekEnd = useMemo(() => ymdAddDays(weekStart, 6), [weekStart])

  const [hideWeekend, setHideWeekend] = useState(readScheduleDispatchHideWeekend)
  useEffect(() => {
    try {
      window.localStorage.setItem(SCHEDULE_DISPATCH_HIDE_WEEKEND_STORAGE_KEY, hideWeekend ? '1' : '0')
    } catch {
      /* ignore quota / private mode */
    }
  }, [hideWeekend])

  const [highlightLinkedGroups, setHighlightLinkedGroups] = useState(readScheduleDispatchHighlightLinkedGroups)
  useEffect(() => {
    try {
      window.localStorage.setItem(
        SCHEDULE_DISPATCH_HIGHLIGHT_LINKED_GROUPS_KEY,
        highlightLinkedGroups ? '1' : '0',
      )
    } catch {
      /* ignore quota / private mode */
    }
  }, [highlightLinkedGroups])

  const [linkedGroupModalId, setLinkedGroupModalId] = useState<string | null>(null)

  const visibleDayKeys = useMemo(
    () => getScheduleDispatchVisibleDayKeys(weekStart, hideWeekend),
    [weekStart, hideWeekend],
  )
  const scheduleTodayYmd = denverCalendarDayKey(Date.now())
  const dispatchWeekNavDateRangeOverride = useMemo(
    () => (hideWeekend ? formatScheduleDispatchVisibleDateRange(visibleDayKeys) : undefined),
    [hideWeekend, visibleDayKeys],
  )

  const [hubExpectedManpowerDayKey, setHubExpectedManpowerDayKey] = useState<string | null>(null)
  useEffect(() => {
    setHubExpectedManpowerDayKey((prev) => {
      if (visibleDayKeys.length === 0) return null
      if (prev != null && visibleDayKeys.includes(prev)) return prev
      if (visibleDayKeys.includes(scheduleTodayYmd)) return scheduleTodayYmd
      return visibleDayKeys[0] ?? null
    })
  }, [visibleDayKeys, scheduleTodayYmd])

  const [jobTitle, setJobTitle] = useState('')
  const [teamMembers, setTeamMembers] = useState<ScheduleTeamMember[]>([])
  const [blocks, setBlocks] = useState<JobScheduleBlockRow[]>([])
  const [jobScheduleSalariedUserIds, setJobScheduleSalariedUserIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [hubLoading, setHubLoading] = useState(false)
  /** Monotonic id so only the latest `loadHub` run clears `hubLoading` (overlapping week/job navigations). */
  const hubLoadSeqRef = useRef(0)
  const [hubJobsError, setHubJobsError] = useState<string | null>(null)
  const [hubSummariesError, setHubSummariesError] = useState<string | null>(null)
  const [hubJobs, setHubJobs] = useState<ScheduleDispatchHubJobRow[]>([])
  const [hubWeekBlocks, setHubWeekBlocks] = useState<JobScheduleBlockRow[]>([])
  const [hubTeamMemberUserIds, setHubTeamMemberUserIds] = useState<string[]>([])
  const [hubPeopleNameById, setHubPeopleNameById] = useState<Map<string, string>>(() => new Map())
  const [hubHourlyWageByUserId, setHubHourlyWageByUserId] = useState<Map<string, number>>(() => new Map())
  const [hubPayApprovedMasterIds, setHubPayApprovedMasterIds] = useState<Set<string>>(() => new Set())
  const [hubSalariedUserIds, setHubSalariedUserIds] = useState<Set<string>>(() => new Set())
  const [jobPreview, setJobPreview] = useState<{ projectId: string; dateKey: string | null } | null>(null)
  const [hubDetailJobModal, setHubDetailJobModal] = useState<{
    jobId: string
    scheduleContext: DetailJobScheduleContext
    prefillRowLabel: string | null
    prefillAddress: string | null
  } | null>(null)
  const [scheduleJobProjectId, setScheduleJobProjectId] = useState<string | null>(null)
  /** `null` until job-week `load()` succeeds; then whoever is not in this set is schedule-only. */
  const [officialJobTeamUserIds, setOfficialJobTeamUserIds] = useState<ReadonlySet<string> | null>(null)
  const [addToJobBusyUserId, setAddToJobBusyUserId] = useState<string | null>(null)

  const canEdit = role != null && CAN_USE_SCHEDULE_DISPATCH.has(role)
  const canAddToJobRoster = role != null && CAN_ADD_TO_JOB_ROSTER.has(role)

  useEffect(() => {
    if (!authUser?.id) {
      setHubPayApprovedMasterIds(new Set())
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () => supabase.from('pay_approved_masters').select('master_id'),
          'scheduleDispatchPayApprovedMasters',
        )
        if (cancelled) return
        const rows = (data ?? []) as Array<{ master_id: string }>
        setHubPayApprovedMasterIds(new Set(rows.map((r) => r.master_id)))
      } catch {
        if (!cancelled) setHubPayApprovedMasterIds(new Set())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id])

  const canShowHubExpectedManpowerPayroll = useMemo(
    () =>
      role === 'dev' ||
      (role === 'master_technician' &&
        authUser?.id != null &&
        hubPayApprovedMasterIds.has(authUser.id)),
    [role, authUser?.id, hubPayApprovedMasterIds],
  )

  const hubSummaryRows = useMemo(() => blocksToJobWeekSummaries(hubWeekBlocks), [hubWeekBlocks])

  const hubPersonDayBlocks = useMemo(() => buildPersonDayBlockMap(hubWeekBlocks), [hubWeekBlocks])

  const hubJobTitleById = useMemo(() => {
    const m = new Map<string, string>()
    for (const j of hubJobs) {
      m.set(j.id, formatScheduleDispatchHubJobTitle(j.hcp_number, j.job_name))
    }
    return m
  }, [hubJobs])

  const hubAllPeopleRows = useMemo(() => {
    const idSet = new Set<string>([...hubTeamMemberUserIds, ...hubWeekBlocks.map((b) => b.assignee_user_id)])
    return [...idSet]
      .map((userId) => ({ userId, displayName: hubPeopleNameById.get(userId) ?? 'Unknown' }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }))
  }, [hubTeamMemberUserIds, hubWeekBlocks, hubPeopleNameById])

  const hubUserIdsWithBlocksThisWeek = useMemo(
    () => new Set(hubWeekBlocks.map((b) => b.assignee_user_id)),
    [hubWeekBlocks],
  )

  const hubBlockById = useMemo(() => {
    const m = new Map<string, JobScheduleBlockRow>()
    for (const b of hubWeekBlocks) m.set(b.id, b)
    return m
  }, [hubWeekBlocks])

  const hubGroupMemberCountByGroupId = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of hubWeekBlocks) {
      const g = b.shared_block_group_id
      if (!g) continue
      m.set(g, (m.get(g) ?? 0) + 1)
    }
    return m
  }, [hubWeekBlocks])

  const hubLinkedGroupAccentMap = useMemo(() => {
    const ids = new Set<string>()
    for (const b of hubWeekBlocks) {
      const g = b.shared_block_group_id
      if (g) ids.add(g)
    }
    return buildLinkedGroupAccentMap(ids)
  }, [hubWeekBlocks])

  const getHubJobDisplayTitle = useCallback(
    (id: string) => hubJobTitleById.get(id) ?? formatScheduleDispatchHubJobTitle(null, null),
    [hubJobTitleById],
  )

  const hubMergedRows = useMemo(() => {
    const agg = aggregateWeekSummariesByJob(hubSummaryRows)
    const rows = hubJobs.map((j) => {
      const s = agg.get(j.id) ?? { total: 0, byDay: {} }
      return {
        ...j,
        displayTitle: formatScheduleDispatchHubJobTitle(j.hcp_number, j.job_name),
        totalBlocks: s.total,
        byDay: { ...s.byDay },
      }
    })
    rows.sort((a, b) => {
      if (b.totalBlocks !== a.totalBlocks) return b.totalBlocks - a.totalBlocks
      const ha = (a.hcp_number ?? '').trim()
      const hb = (b.hcp_number ?? '').trim()
      return hb.localeCompare(ha, undefined, { numeric: true })
    })
    return rows
  }, [hubJobs, hubSummaryRows])

  const loadHub = useCallback(async () => {
    if (jobId) return
    const hubLoadSeq = ++hubLoadSeqRef.current
    setHubLoading(true)
    try {
      setHubJobsError(null)
      setHubSummariesError(null)
      setHubSalariedUserIds(new Set())

      const [jr, br] = await Promise.all([
        fetchJobsLedgerForScheduleDispatchHub(),
        fetchJobScheduleBlocksForHubDateRange(weekStart, weekEnd),
      ])

      let hubJobsData: ScheduleDispatchHubJobRow[] = []
      if (jr.error) {
        setHubJobsError(jr.error)
        setHubJobs([])
      } else {
        hubJobsData = jr.data
        setHubJobs(jr.data)
      }

      const jobIds = hubJobsData.map((j) => j.id)
      const teamRes = await fetchTeamMemberUserIdsForJobIds(jobIds)
      const teamIds = teamRes.error ? [] : teamRes.data
      if (teamRes.error) showToast(`Team roster: ${teamRes.error}`, 'warning')

      const usersTabRes = await fetchUsersTabUserIdsForScheduleDispatchHub(role === 'dev')
      const usersTabIds = usersTabRes.error ? [] : usersTabRes.data
      if (usersTabRes.error) showToast(`Dispatch people list: ${usersTabRes.error}`, 'warning')

      const mergedHubBaseIds = [...new Set([...teamIds, ...usersTabIds])]
      setHubTeamMemberUserIds(mergedHubBaseIds)

      let blocksData: JobScheduleBlockRow[] = []
      if (br.error) {
        setHubSummariesError(br.error)
        setHubWeekBlocks([])
        showToast(`Schedule blocks: ${br.error}`, 'warning')
      } else {
        setHubSummariesError(null)
        blocksData = br.data
        setHubWeekBlocks(br.data)
      }

      const assigneeIds = [...new Set(blocksData.map((b) => b.assignee_user_id))]
      const rosterIds = [...new Set([...mergedHubBaseIds, ...assigneeIds])]
      const { data: nameMap, error: nameErr } = await fetchUserNamesForIds(rosterIds)
      setHubPeopleNameById(nameMap)
      if (nameErr) showToast(`People names: ${nameErr}`, 'warning')

      try {
        const salaried = await fetchSalariedUserIdSetFromUserIds(rosterIds)
        setHubSalariedUserIds(salaried)
      } catch (e) {
        setHubSalariedUserIds(new Set())
        showToast(`Salary flags: ${formatErrorMessage(e)}`, 'warning')
      }

      if (!canShowHubExpectedManpowerPayroll) {
        setHubHourlyWageByUserId(new Map())
      } else {
        const names = new Set<string>()
        for (const uid of rosterIds) {
          const raw = nameMap.get(uid)?.trim()
          if (raw && raw !== 'Unknown') names.add(raw)
        }
        const nameList = [...names]
        if (nameList.length === 0) {
          setHubHourlyWageByUserId(new Map())
        } else {
          try {
            const payData = await withSupabaseRetry(
              async () =>
                supabase
                  .from('people_pay_config')
                  .select('person_name, hourly_wage')
                  .in('person_name', nameList),
              'scheduleDispatchHubPeoplePayWages',
            )
            const wageByName = new Map<string, number>()
            for (const r of (payData ?? []) as Array<{ person_name: string; hourly_wage: number | null }>) {
              const pn = r.person_name?.trim()
              if (!pn) continue
              const w = r.hourly_wage
              wageByName.set(pn, typeof w === 'number' && Number.isFinite(w) ? w : 0)
            }
            const wageByUserId = new Map<string, number>()
            for (const uid of rosterIds) {
              const nm = nameMap.get(uid)?.trim()
              wageByUserId.set(uid, nm ? (wageByName.get(nm) ?? 0) : 0)
            }
            setHubHourlyWageByUserId(wageByUserId)
          } catch (e) {
            setHubHourlyWageByUserId(new Map())
            showToast(`Pay rates: ${formatErrorMessage(e)}`, 'warning')
          }
        }
      }
    } catch (err) {
      showToast(formatErrorMessage(err), 'error')
    } finally {
      if (hubLoadSeqRef.current === hubLoadSeq) {
        setHubLoading(false)
      }
    }
  }, [jobId, weekStart, weekEnd, role, showToast, canShowHubExpectedManpowerPayroll])

  useEffect(() => {
    if (jobId) {
      setHubLoading(false)
      return
    }
    void loadHub()
  }, [jobId, loadHub])

  useEffect(() => {
    if (jobId) return
    const pj = searchParams.get('placeJob')?.trim() ?? ''
    if (!pj) {
      placeJobArmKeyRef.current = ''
      return
    }
    if (hubTabIsJobs) {
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev)
        n.set('week', weekStart)
        n.delete('hubTab')
        n.set('placeJob', pj)
        return n
      }, { replace: true })
      return
    }
    if (hubLoading) return
    const key = `${pj}|${weekStart}`
    if (placeJobArmKeyRef.current === key) return
    placeJobArmKeyRef.current = key
    setCardPlacementMode(null)
    setPlusMenuBlockId(null)
    setHubAssignJobPlacement({ jobId: pj })
  }, [jobId, weekStart, hubTabIsJobs, hubLoading, searchParams, setSearchParams])

  const load = useCallback(async () => {
    if (!jobId) return
    setLoading(true)
    setLoadError(null)
    setJobScheduleSalariedUserIds(new Set())
    setScheduleJobProjectId(null)
    setOfficialJobTeamUserIds(null)
    const [ctx, blk] = await Promise.all([
      fetchScheduleJobContext(jobId),
      fetchJobScheduleBlocksForJobDateRange(jobId, weekStart, weekEnd),
    ])
    if (ctx.error || !ctx.data) {
      setLoadError(ctx.error ?? 'Could not load job.')
      setJobTitle('')
      setTeamMembers([])
      setBlocks([])
      setScheduleJobProjectId(null)
      setOfficialJobTeamUserIds(null)
    } else {
      setJobTitle(ctx.data.jobTitle)
      setScheduleJobProjectId(ctx.data.project_id)
      setOfficialJobTeamUserIds(new Set(ctx.data.teamMembers.map((t) => t.user_id)))
      let blocksData: JobScheduleBlockRow[] = []
      if (blk.error) {
        setLoadError(blk.error)
        setBlocks([])
      } else {
        blocksData = blk.data
        setBlocks(blk.data)
      }
      const teamIds = ctx.data.teamMembers.map((t) => t.user_id)
      const assigneeIds = blocksData.map((b) => b.assignee_user_id)
      const rosterIds = [...new Set([...teamIds, ...assigneeIds])].filter(Boolean)
      const teamById = new Map(ctx.data.teamMembers.map((t) => [t.user_id, t]))
      const { data: nameMap, error: nameErr } = await fetchUserNamesForIds(rosterIds)
      if (nameErr) showToast(`People names: ${nameErr}`, 'warning')
      const mergedRoster: ScheduleTeamMember[] = rosterIds.map((uid) => {
        const fromTeam = teamById.get(uid)
        if (fromTeam) return fromTeam
        return { user_id: uid, name: nameMap.get(uid) ?? null }
      })
      setTeamMembers(mergedRoster)
      try {
        const salaried = await fetchSalariedUserIdSetFromUserIds(rosterIds)
        setJobScheduleSalariedUserIds(salaried)
      } catch (e) {
        setJobScheduleSalariedUserIds(new Set())
        showToast(`Salary flags: ${formatErrorMessage(e)}`, 'warning')
      }
    }
    setLoading(false)
  }, [jobId, weekStart, weekEnd, showToast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setJobPreview(null)
    setHubDetailJobModal(null)
  }, [jobId, weekStart])

  useEffect(() => {
    if (!jobId) return
    setHubAssignJobPlacement(null)
    setHubAssignJobPickerOpen(false)
    placeJobArmKeyRef.current = ''
  }, [jobId])

  const blocksByCell = useMemo(() => {
    const m = new Map<string, JobScheduleBlockRow[]>()
    for (const b of blocks) {
      const k = cellKey(b.assignee_user_id, b.work_date)
      const arr = m.get(k) ?? []
      arr.push(b)
      m.set(k, arr)
    }
    for (const [, arr] of m) {
      arr.sort((a, b) => a.time_start.localeCompare(b.time_start))
    }
    return m
  }, [blocks])

  const blockById = useMemo(() => {
    const m = new Map<string, JobScheduleBlockRow>()
    for (const b of blocks) m.set(b.id, b)
    return m
  }, [blocks])

  const groupMemberCountByGroupId = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of blocks) {
      const g = b.shared_block_group_id
      if (!g) continue
      m.set(g, (m.get(g) ?? 0) + 1)
    }
    return m
  }, [blocks])

  const nameByUserId = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of teamMembers) {
      m.set(t.user_id, (t.name ?? '').trim() || 'Unnamed')
    }
    return m
  }, [teamMembers])

  const addUserToJobRoster = useCallback(
    async (userId: string) => {
      if (!jobId || !userId || !canAddToJobRoster || officialJobTeamUserIds == null) return
      if (officialJobTeamUserIds.has(userId)) {
        showToast('Already on job roster.', 'info')
        return
      }
      setAddToJobBusyUserId(userId)
      try {
        const existing = await withSupabaseRetry(
          async () =>
            await supabase
              .from('jobs_ledger_team_members')
              .select('id')
              .eq('job_id', jobId)
              .eq('user_id', userId)
              .maybeSingle(),
          'dispatch check jobs_ledger_team_member',
        )
        if (existing) {
          showToast('Already on job roster.', 'info')
          void load()
          return
        }
        await withSupabaseRetry(
          async () =>
            await supabase.from('jobs_ledger_team_members').insert({ job_id: jobId, user_id: userId }),
          'dispatch insert jobs_ledger_team_member',
        )
        showToast('Added to job.', 'success')
        void load()
      } catch (e) {
        showToast(formatErrorMessage(e), 'error')
      } finally {
        setAddToJobBusyUserId(null)
      }
    },
    [jobId, canAddToJobRoster, officialJobTeamUserIds, showToast, load],
  )

  const [blockModalState, setBlockModalState] = useState<ScheduleDispatchBlockModalState | null>(null)
  const [addTimeStart, setAddTimeStart] = useState('08:00')
  const [addTimeEnd, setAddTimeEnd] = useState('12:00')
  const [addNote, setAddNote] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [cardPlacementMode, setCardPlacementMode] = useState<ScheduleDispatchCardPlacementMode | null>(null)
  const [plusMenuBlockId, setPlusMenuBlockId] = useState<string | null>(null)
  const [hubAssignJobPlacement, setHubAssignJobPlacement] = useState<HubAssignJobPlacementState | null>(null)
  const [hubAssignJobPickerOpen, setHubAssignJobPickerOpen] = useState(false)
  const [hubAssignJobPickerSearch, setHubAssignJobPickerSearch] = useState('')
  const placeJobArmKeyRef = useRef<string>('')

  const placementSourceBlock = useMemo(() => {
    if (!cardPlacementMode) return null
    const m = jobId ? blockById : hubBlockById
    return m.get(cardPlacementMode.sourceBlockId) ?? null
  }, [cardPlacementMode, jobId, blockById, hubBlockById])

  useEffect(() => {
    if (!cardPlacementMode && !hubAssignJobPlacement) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCardPlacementMode(null)
        setPlusMenuBlockId(null)
        setHubAssignJobPlacement(null)
        setSearchParams((prev) => {
          const n = new URLSearchParams(prev)
          if (!n.has('placeJob')) return prev
          n.delete('placeJob')
          return n
        }, { replace: true })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cardPlacementMode, hubAssignJobPlacement, setSearchParams])

  const stripPlaceJobFromUrl = useCallback(() => {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      if (!n.has('placeJob')) return prev
      n.delete('placeJob')
      return n
    }, { replace: true })
  }, [setSearchParams])

  const openAddBlock = useCallback(
    (args: { assigneeUserId: string; workDate: string; jobId: string }) => {
      setCardPlacementMode(null)
      setPlusMenuBlockId(null)
      setHubAssignJobPlacement(null)
      setBlockModalState({ kind: 'add', assigneeUserId: args.assigneeUserId, workDate: args.workDate, jobId: args.jobId })
      setAddTimeStart('08:00')
      setAddTimeEnd('12:00')
      setAddNote('')
      setAddError(null)
    },
    [],
  )

  const openEdit = useCallback(
    (block: JobScheduleBlockRow) => {
      if (!canEdit || !jobId || block.job_id !== jobId) return
      setCardPlacementMode(null)
      setPlusMenuBlockId(null)
      setBlockModalState({ kind: 'edit', blockId: block.id })
      setAddTimeStart(block.time_start.slice(0, 5))
      setAddTimeEnd(block.time_end.slice(0, 5))
      setAddNote(block.note ?? '')
      setAddError(null)
    },
    [canEdit, jobId],
  )

  const closeAdd = useCallback(() => {
    setBlockModalState(null)
    setAddError(null)
    stripPlaceJobFromUrl()
  }, [stripPlaceJobFromUrl])

  const onStartCardPlacement = useCallback(
    (source: JobScheduleBlockRow, variant: 'linked' | 'unlinked') => {
      if (!canEdit) return
      if (jobId) {
        if (source.job_id !== jobId) return
      } else if (hubTabIsJobs) {
        showToast('Switch to the People tab to place a copy on the grid.', 'info')
        return
      }
      setBlockModalState(null)
      setAddError(null)
      setPlusMenuBlockId(null)
      setHubAssignJobPlacement(null)
      stripPlaceJobFromUrl()
      setCardPlacementMode({ sourceBlockId: source.id, variant })
      const extra =
        variant === 'linked'
          ? ' Linked copies stay on the same work day as the source.'
          : ' Solo copies can go on any day in this week.'
      showToast(`Click a team member's day cell to add the copy. Press Esc to cancel.${extra}`, 'info')
    },
    [canEdit, jobId, hubTabIsJobs, showToast, stripPlaceJobFromUrl],
  )

  const onCardPlacementPickCell = useCallback(
    async (assigneeUserId: string, workDate: string) => {
      if (!cardPlacementMode || !authUser?.id) return
      const placementVariant = cardPlacementMode.variant
      const sourceBlockId = cardPlacementMode.sourceBlockId

      if (jobId) {
        const source = blockById.get(sourceBlockId)
        if (!source || source.job_id !== jobId) {
          setCardPlacementMode(null)
          return
        }
        if (placementVariant === 'linked' && workDate !== source.work_date) {
          showToast(
            'Linked copies use the source block’s day. Use drag to move the whole crew to another day.',
            'info',
          )
          return
        }

        const { error } = await insertScheduleDispatchCopiedLeg({
          jobId,
          createdBy: authUser.id,
          source,
          targetAssigneeUserId: assigneeUserId,
          targetWorkDate: workDate,
          linkMode: placementVariant === 'linked' ? 'linked' : 'unlinked',
          allJobBlocks: blocks,
        })
        if (error) {
          showToast(error, 'error')
          return
        }
        setCardPlacementMode(null)
        showToast(placementVariant === 'linked' ? 'Linked copy added.' : 'Solo copy added.', 'success')
        await load()
        return
      }

      const source = hubBlockById.get(sourceBlockId)
      if (!source) {
        setCardPlacementMode(null)
        return
      }
      if (placementVariant === 'linked' && workDate !== source.work_date) {
        showToast(
          'Linked copies use the source block’s day. Use drag to move the whole crew to another day.',
          'info',
        )
        return
      }

      const allJobBlocks = hubWeekBlocks.filter((b) => b.job_id === source.job_id)
      const { error: hubInsErr } = await insertScheduleDispatchCopiedLeg({
        jobId: source.job_id,
        createdBy: authUser.id,
        source,
        targetAssigneeUserId: assigneeUserId,
        targetWorkDate: workDate,
        linkMode: placementVariant === 'linked' ? 'linked' : 'unlinked',
        allJobBlocks,
      })
      if (hubInsErr) {
        showToast(hubInsErr, 'error')
        return
      }
      setCardPlacementMode(null)
      showToast(placementVariant === 'linked' ? 'Linked copy added.' : 'Solo copy added.', 'success')
      await loadHub()
    },
    [
      cardPlacementMode,
      jobId,
      authUser?.id,
      blockById,
      hubBlockById,
      blocks,
      hubWeekBlocks,
      load,
      loadHub,
      showToast,
    ],
  )

  const onHubAssignJobCellPick = useCallback(
    (assigneeUserId: string, workDate: string) => {
      if (!hubAssignJobPlacement) return
      const jid = hubAssignJobPlacement.jobId
      setHubAssignJobPlacement(null)
      openAddBlock({ assigneeUserId, workDate, jobId: jid })
    },
    [hubAssignJobPlacement, openAddBlock],
  )

  const onCancelHubAssignJobPlacement = useCallback(() => {
    setHubAssignJobPlacement(null)
    stripPlaceJobFromUrl()
  }, [stripPlaceJobFromUrl])

  const onRequestHubAddJob = useCallback(() => {
    setCardPlacementMode(null)
    setPlusMenuBlockId(null)
    setHubAssignJobPlacement(null)
    stripPlaceJobFromUrl()
    setHubAssignJobPickerSearch('')
    setHubAssignJobPickerOpen(true)
  }, [stripPlaceJobFromUrl])

  const onRequestHubNewJob = useCallback(() => {
    if (!jobFormModal) return
    setCardPlacementMode(null)
    setPlusMenuBlockId(null)
    setHubAssignJobPickerOpen(false)
    jobFormModal.openNewJob({
      onCreatedJobId: (newId) => {
        void loadHub().then(() => {
          setHubAssignJobPlacement({ jobId: newId })
          showToast('Click a person day cell to add the first block for this job.', 'info')
        })
      },
      onSaved: () => void loadHub(),
    })
  }, [jobFormModal, loadHub, showToast])

  const hubAssignJobPickerRows = useMemo(() => {
    const q = hubAssignJobPickerSearch.trim().toLowerCase()
    let list = hubMergedRows
    if (q) {
      list = list.filter(
        (r) =>
          (r.hcp_number ?? '').toLowerCase().includes(q) ||
          (r.job_name ?? '').toLowerCase().includes(q) ||
          r.displayTitle.toLowerCase().includes(q),
      )
    }
    return list
  }, [hubMergedRows, hubAssignJobPickerSearch])

  const blockModalPersonLabel = useMemo(() => {
    if (!blockModalState) return ''
    if (blockModalState.kind === 'add') {
      if (jobId) {
        return nameByUserId.get(blockModalState.assigneeUserId) ?? 'Unknown'
      }
      return hubPeopleNameById.get(blockModalState.assigneeUserId) ?? 'Unknown'
    }
    const b = blockById.get(blockModalState.blockId)
    return b ? nameByUserId.get(b.assignee_user_id) ?? 'Unknown' : ''
  }, [blockModalState, nameByUserId, blockById, jobId, hubPeopleNameById])

  const blockModalJobTitleForModal = useMemo(() => {
    if (!blockModalState) return ''
    if (blockModalState.kind === 'add') {
      return getHubJobDisplayTitle(blockModalState.jobId)
    }
    return jobTitle
  }, [blockModalState, getHubJobDisplayTitle, jobTitle])

  const blockModalWorkDate = useMemo(() => {
    if (!blockModalState) return ''
    if (blockModalState.kind === 'add') return blockModalState.workDate
    const b = blockById.get(blockModalState.blockId)
    return b?.work_date ?? ''
  }, [blockModalState, blockById])

  const saveBlockModal = useCallback(async () => {
    if (!blockModalState) return
    if (blockModalState.kind === 'edit' && !jobId) return
    if (blockModalState.kind === 'add' && !authUser?.id) return

    const v = validateRange(addTimeStart, addTimeEnd)
    if (v) {
      setAddError(v)
      return
    }
    const ts = timeInputToPg(addTimeStart)
    const te = timeInputToPg(addTimeEnd)
    const candidate = scheduleBlockToRange(ts, te)
    const noteVal = addNote.trim() || null

    if (blockModalState.kind === 'add') {
      const targetJobId = blockModalState.jobId
      const assigneeUserId = blockModalState.assigneeUserId
      const workDate = blockModalState.workDate
      const { data: dayBlocks, error: dayErr } = await fetchScheduleBlocksForAssigneesOnDay([assigneeUserId], workDate)
      if (dayErr) {
        setAddError(dayErr)
        return
      }
      if (scheduleOverlapsAny(candidate, dayBlocks, undefined)) {
        setAddError('That time overlaps another block for this person on this day.')
        return
      }
      setAddSaving(true)
      setAddError(null)
      const createdBy = authUser?.id
      if (!createdBy) {
        setAddSaving(false)
        return
      }
      const { error: insErr } = await insertJobScheduleBlock({
        job_id: targetJobId,
        assignee_user_id: assigneeUserId,
        work_date: workDate,
        time_start: ts,
        time_end: te,
        note: noteVal,
        created_by: createdBy,
        shared_block_group_id: newJobScheduleSharedBlockGroupId(),
      })
      setAddSaving(false)
      if (insErr) {
        setAddError(insErr)
        return
      }
      showToast('Block added.', 'success')
      closeAdd()
      if (jobId) {
        await load()
      } else {
        await loadHub()
      }
      return
    }

    const b = blockById.get(blockModalState.blockId)
    if (!b) {
      showToast('Block not found.', 'error')
      closeAdd()
      return
    }
    const groupId = b.shared_block_group_id
    if (groupId) {
      const legs = blocks.filter((x) => x.job_id === jobId && x.shared_block_group_id === groupId)
      const assigneeIds = [...new Set(legs.map((l) => l.assignee_user_id))]
      for (const uid of assigneeIds) {
        const { data: dayBlocks, error: dayErr } = await fetchScheduleBlocksForAssigneesOnDay([uid], b.work_date)
        if (dayErr) {
          setAddError(dayErr)
          return
        }
        const excludeIds = legs.filter((l) => l.assignee_user_id === uid).map((l) => l.id)
        if (scheduleOverlapsAny(candidate, dayBlocks, excludeIds)) {
          setAddError('That time overlaps another block for this person on this day.')
          return
        }
      }
    } else {
      const { data: dayBlocks, error: dayErr } = await fetchScheduleBlocksForAssigneesOnDay([b.assignee_user_id], b.work_date)
      if (dayErr) {
        setAddError(dayErr)
        return
      }
      if (scheduleOverlapsAny(candidate, dayBlocks, [blockModalState.blockId])) {
        setAddError('That time overlaps another block for this person on this day.')
        return
      }
    }

    setAddSaving(true)
    setAddError(null)
    if (groupId) {
      const { error: upErr } = await updateJobScheduleBlockGroup(jobId, groupId, {
        time_start: ts,
        time_end: te,
        note: noteVal,
      })
      setAddSaving(false)
      if (upErr) {
        setAddError(upErr)
        return
      }
      showToast('Block updated.', 'success')
    } else {
      const { error: upErr } = await updateJobScheduleBlock(blockModalState.blockId, {
        time_start: ts,
        time_end: te,
        note: noteVal,
      })
      setAddSaving(false)
      if (upErr) {
        setAddError(upErr)
        return
      }
      showToast('Block updated.', 'success')
    }

    closeAdd()
    await load()
  }, [
    blockModalState,
    jobId,
    authUser?.id,
    addTimeStart,
    addTimeEnd,
    addNote,
    blockById,
    blocks,
    closeAdd,
    load,
    loadHub,
    showToast,
  ])

  const onDeleteBlock = useCallback(
    async (id: string) => {
      if (!canEdit) return
      if (!window.confirm('Remove this scheduled block?')) return
      const { error: delErr } = await deleteJobScheduleBlock(id)
      if (delErr) {
        showToast(delErr, 'error')
        return
      }
      if (jobId) {
        await load()
      } else {
        await loadHub()
      }
    },
    [canEdit, jobId, load, loadHub, showToast],
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      await executeScheduleDispatchBlockReassign(event, {
        blockById,
        canEdit,
        showToast,
        onSuccess: load,
      })
    },
    [blockById, canEdit, load, showToast],
  )

  const handleHubDragEnd = useCallback(
    async (event: DragEndEvent) => {
      await executeScheduleDispatchBlockReassign(event, {
        blockById: hubBlockById,
        canEdit,
        showToast,
        onSuccess: loadHub,
      })
    },
    [hubBlockById, canEdit, loadHub, showToast],
  )

  const shiftWeek = useCallback(
    (deltaWeeks: number) => {
      setHubAssignJobPlacement(null)
      placeJobArmKeyRef.current = ''
      const next = ymdAddDays(weekStart, deltaWeeks * 7)
      if (jobId) {
        setSearchParams({ jobId, week: next }, { replace: false })
      } else {
        const p: Record<string, string> = { week: next }
        if (hubTabIsJobs) p.hubTab = 'jobs'
        setSearchParams(p, { replace: false })
      }
    },
    [jobId, weekStart, setSearchParams, hubTabIsJobs],
  )

  const goThisWeek = useCallback(() => {
    setHubAssignJobPlacement(null)
    placeJobArmKeyRef.current = ''
    const s = getDefaultWeekRange().start
    if (jobId) {
      setSearchParams({ jobId, week: s }, { replace: false })
    } else {
      const p: Record<string, string> = { week: s }
      if (hubTabIsJobs) p.hubTab = 'jobs'
      setSearchParams(p, { replace: false })
    }
  }, [jobId, setSearchParams, hubTabIsJobs])

  const setHubTab = useCallback(
    (t: 'jobs' | 'people') => {
      if (t === 'jobs') {
        setCardPlacementMode(null)
        setPlusMenuBlockId(null)
        setHubAssignJobPlacement(null)
        stripPlaceJobFromUrl()
      }
      if (t === 'people') {
        setSearchParams((prev) => {
          const n = new URLSearchParams(prev)
          n.set('week', weekStart)
          n.delete('hubTab')
          return n
        }, { replace: true })
        return
      }
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev)
        n.set('week', weekStart)
        n.set('hubTab', 'jobs')
        return n
      }, { replace: true })
    },
    [weekStart, setSearchParams, stripPlaceJobFromUrl],
  )

  const openJobWeekGrid = useCallback(
    (id: string) => {
      setSearchParams({ jobId: id, week: weekStart }, { replace: false })
    },
    [setSearchParams, weekStart],
  )

  const openHubJobDetail = useCallback(
    (block: JobScheduleBlockRow, workDateYmd: string) => {
      setHubDetailJobModal({
        jobId: block.job_id,
        scheduleContext: {
          workDate: workDateYmd,
          timeStart: block.time_start,
          timeEnd: block.time_end,
          note: block.note,
        },
        prefillRowLabel: getHubJobDisplayTitle(block.job_id),
        prefillAddress: null,
      })
    },
    [getHubJobDisplayTitle],
  )

  const openJobPreviewFromJobWeek = useCallback(() => {
    const pid = scheduleJobProjectId?.trim()
    if (!pid) {
      showToast('No workflow project linked to this job.', 'warning')
      return
    }
    setJobPreview({ projectId: pid, dateKey: null })
  }, [scheduleJobProjectId, showToast])

  if (authLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  }

  if (role != null && !CAN_USE_SCHEDULE_DISPATCH.has(role)) {
    return <Navigate to="/dashboard" replace />
  }

  if (!jobId) {
    return (
      <>
        {cardPlacementMode ? (
          <div
            style={{
              margin: '0 1.25rem',
              marginBottom: '0.75rem',
              padding: '0.5rem 0.75rem',
              background: '#e0e7ff',
              border: '1px solid #a5b4fc',
              borderRadius: 6,
              fontSize: '0.8125rem',
              color: '#3730a3',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>
              Adding a <strong>{cardPlacementMode.variant === 'linked' ? 'linked' : 'solo'}</strong> copy from{' '}
              {placementSourceBlock
                ? scheduleFormatWindow(placementSourceBlock.time_start, placementSourceBlock.time_end)
                : 'this block'}
              . Click a team member&apos;s day cell
              {cardPlacementMode.variant === 'linked'
                ? ` on ${placementSourceBlock?.work_date ?? 'that day'}.`
                : '.'}{' '}
              Press Esc to cancel.
            </span>
            <button
              type="button"
              onClick={() => {
                setCardPlacementMode(null)
                setPlusMenuBlockId(null)
              }}
              style={{
                padding: '0.2rem 0.55rem',
                fontSize: '0.75rem',
                border: '1px solid #4338ca',
                borderRadius: 4,
                background: '#fff',
                color: '#312e81',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}
        {hubAssignJobPlacement ? (
          <div
            style={{
              margin: '0 1.25rem',
              marginBottom: '0.75rem',
              padding: '0.5rem 0.75rem',
              background: '#ecfdf5',
              border: '1px solid #6ee7b7',
              borderRadius: 6,
              fontSize: '0.8125rem',
              color: '#065f46',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>
              Placing schedule for <strong>{getHubJobDisplayTitle(hubAssignJobPlacement.jobId)}</strong>. Click a
              person&apos;s day cell. Press Esc to cancel.
            </span>
            <button
              type="button"
              onClick={() => onCancelHubAssignJobPlacement()}
              style={{
                padding: '0.2rem 0.55rem',
                fontSize: '0.75rem',
                border: '1px solid #047857',
                borderRadius: 4,
                background: '#fff',
                color: '#064e3b',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => void handleHubDragEnd(e)}
        >
          <ScheduleDispatchHub
            weekStart={weekStart}
            visibleDayKeys={visibleDayKeys}
            hideWeekend={hideWeekend}
            onHideWeekendChange={setHideWeekend}
            weekNavDateRangeOverride={dispatchWeekNavDateRangeOverride}
            rows={hubMergedRows}
            loading={hubLoading}
            jobsError={hubJobsError}
            summariesError={hubSummariesError}
            hubTab={hubTabIsJobs ? 'jobs' : 'people'}
            onHubTabChange={setHubTab}
            personDayBlocks={hubPersonDayBlocks}
            allPeopleRows={hubAllPeopleRows}
            userIdsWithBlocksThisWeek={hubUserIdsWithBlocksThisWeek}
            salariedUserIds={hubSalariedUserIds}
            getJobDisplayTitle={getHubJobDisplayTitle}
            groupMemberCountByGroupId={hubGroupMemberCountByGroupId}
            canEdit={canEdit}
            onWeekShift={shiftWeek}
            onThisWeek={goThisWeek}
            onOpenJob={openJobWeekGrid}
            onOpenHubJobDetail={openHubJobDetail}
            scheduleTodayYmd={scheduleTodayYmd}
            cardPlacementMode={cardPlacementMode}
            placementSourceWorkDate={placementSourceBlock?.work_date ?? null}
            plusMenuBlockId={plusMenuBlockId}
            onPlusMenuBlockIdChange={setPlusMenuBlockId}
            onStartCardPlacement={(b, v) => onStartCardPlacement(b, v)}
            onCardPlacementCellPick={(assigneeUserId, workDate) =>
              void onCardPlacementPickCell(assigneeUserId, workDate)
            }
            highlightLinkedGroups={highlightLinkedGroups}
            onHighlightLinkedGroupsChange={setHighlightLinkedGroups}
            linkedGroupAccentByGroupId={hubLinkedGroupAccentMap}
            onOpenLinkedGroup={(gid) => setLinkedGroupModalId(gid)}
            hubWeekBlocks={hubWeekBlocks}
            hubExpectedManpowerDayKey={hubExpectedManpowerDayKey}
            onHubExpectedManpowerDayChange={setHubExpectedManpowerDayKey}
            hubPeopleNameById={hubPeopleNameById}
            canShowExpectedManpowerPayroll={canShowHubExpectedManpowerPayroll}
            hubHourlyWageByUserId={hubHourlyWageByUserId}
            hubAssignJobPlacement={hubAssignJobPlacement}
            onRequestHubAddJob={onRequestHubAddJob}
            onRequestHubNewJob={onRequestHubNewJob}
            onHubAssignJobCellPick={onHubAssignJobCellPick}
            onDeleteBlock={(id) => void onDeleteBlock(id)}
          />
        </DndContext>
        <AddBlockModal
          open={blockModalState != null}
          mode={blockModalState?.kind === 'edit' ? 'edit' : 'add'}
          jobTitle={blockModalJobTitleForModal}
          personLabel={blockModalPersonLabel}
          workDate={blockModalWorkDate}
          timeStart={addTimeStart}
          timeEnd={addTimeEnd}
          note={addNote}
          saving={addSaving}
          error={addError}
          onClose={closeAdd}
          onChangeStart={setAddTimeStart}
          onChangeEnd={setAddTimeEnd}
          onChangeNote={setAddNote}
          onSave={() => void saveBlockModal()}
        />
        {hubAssignJobPickerOpen ? (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1003,
            }}
            onClick={() => setHubAssignJobPickerOpen(false)}
            role="presentation"
          >
            <div
              role="dialog"
              aria-labelledby="hub-assign-job-picker-title"
              style={{
                background: '#fff',
                borderRadius: 8,
                padding: '1.25rem',
                maxWidth: 480,
                width: '92%',
                maxHeight: '80vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="hub-assign-job-picker-title" style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>
                Add job to schedule
              </h2>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#4b5563' }}>
                Choose a job from this week&apos;s hub list, then click a person and day on the People grid.
              </p>
              <input
                type="search"
                value={hubAssignJobPickerSearch}
                onChange={(e) => setHubAssignJobPickerSearch(e.target.value)}
                placeholder="Search HCP or job name"
                aria-label="Search jobs"
                style={{ marginBottom: '0.75rem', padding: '0.4rem', fontSize: '0.875rem' }}
              />
              <div style={{ overflowY: 'auto', flex: 1, border: '1px solid #e5e7eb', borderRadius: 6 }}>
                {hubAssignJobPickerRows.length === 0 ? (
                  <div style={{ padding: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>No jobs match.</div>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {hubAssignJobPickerRows.map((r) => (
                      <li key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setHubAssignJobPickerOpen(false)
                            setCardPlacementMode(null)
                            setPlusMenuBlockId(null)
                            setHubAssignJobPlacement({ jobId: r.id })
                            showToast('Click a person day cell to place a block for this job.', 'info')
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '0.55rem 0.75rem',
                            border: 'none',
                            background: '#fff',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                          }}
                        >
                          {r.displayTitle}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setHubAssignJobPickerOpen(false)}
                  style={{
                    padding: '0.45rem 1rem',
                    fontSize: '0.875rem',
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {linkedGroupModalId ? (
          <LinkedScheduleGroupModal
            open
            onClose={() => setLinkedGroupModalId(null)}
            groupId={linkedGroupModalId}
            weekStart={weekStart}
            weekEnd={weekEnd}
            getJobDisplayTitle={getHubJobDisplayTitle}
          />
        ) : null}
        {hubDetailJobModal ? (
          <DetailJobModal
            open
            onClose={() => setHubDetailJobModal(null)}
            jobId={hubDetailJobModal.jobId}
            scheduleContext={hubDetailJobModal.scheduleContext}
            authRole={role}
            assignedJobsRows={[]}
            prefillRowLabel={hubDetailJobModal.prefillRowLabel}
            prefillAddress={hubDetailJobModal.prefillAddress}
            onEditJobSaved={() => void loadHub()}
          />
        ) : null}
      </>
    )
  }

  return (
    <>
    <div style={{ padding: '1rem 1.25rem', maxWidth: '100%' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.35rem', fontWeight: role === 'assistant' ? 700 : 400 }}>
          Dispatch
        </h1>
        <div style={{ marginBottom: 6 }}>
          <button
            type="button"
            onClick={() => navigate(`/schedule-dispatch?week=${encodeURIComponent(weekStart)}`)}
            style={{
              padding: 0,
              border: 'none',
              background: 'none',
              color: '#2563eb',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              textDecoration: 'underline',
              textUnderlineOffset: 2,
            }}
          >
            Week overview (all jobs)
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={openJobPreviewFromJobWeek}
            disabled={loading}
            title={jobTitle}
            aria-label={`Job preview: ${jobTitle}`}
            style={{
              padding: 0,
              margin: 0,
              border: 'none',
              background: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              font: 'inherit',
              fontSize: '0.9375rem',
              color: '#374151',
              fontWeight: 600,
              textAlign: 'left',
            }}
          >
            {jobTitle}
          </button>
          <button
            type="button"
            onClick={() => {
              jobFormModal?.openEditJob(jobId, { onSaved: () => void load() })
            }}
            title="Edit job"
            aria-label="Edit job"
            style={{
              flex: '0 0 auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              margin: 0,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#6b7280',
              borderRadius: 4,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 640 640"
              width={18}
              height={18}
              fill="currentColor"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
            </svg>
          </button>
        </div>
        {loadError ? (
          <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: '0.5rem 0 0', whiteSpace: 'pre-wrap' }}>{loadError}</p>
        ) : null}
      </div>

      {cardPlacementMode ? (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.5rem 0.75rem',
            background: '#e0e7ff',
            border: '1px solid #a5b4fc',
            borderRadius: 6,
            fontSize: '0.8125rem',
            color: '#3730a3',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>
            Adding a <strong>{cardPlacementMode.variant === 'linked' ? 'linked' : 'solo'}</strong> copy from{' '}
            {placementSourceBlock
              ? scheduleFormatWindow(placementSourceBlock.time_start, placementSourceBlock.time_end)
              : 'this block'}
            . Click a team member&apos;s day cell
            {cardPlacementMode.variant === 'linked'
              ? ` on ${placementSourceBlock?.work_date ?? 'that day'}.`
              : '.'}{' '}
            Press Esc to cancel.
          </span>
          <button
            type="button"
            onClick={() => {
              setCardPlacementMode(null)
              setPlusMenuBlockId(null)
            }}
            style={{
              padding: '0.2rem 0.55rem',
              fontSize: '0.75rem',
              border: '1px solid #4338ca',
              borderRadius: 4,
              background: '#fff',
              color: '#312e81',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
        <ScheduleDispatchGrid
          weekStart={weekStart}
          visibleDayKeys={visibleDayKeys}
          hideWeekend={hideWeekend}
          onHideWeekendChange={setHideWeekend}
          weekNavDateRangeOverride={dispatchWeekNavDateRangeOverride}
          cardPlacementMode={cardPlacementMode}
          placementSourceWorkDate={placementSourceBlock?.work_date ?? null}
          plusMenuBlockId={plusMenuBlockId}
          onPlusMenuBlockIdChange={setPlusMenuBlockId}
          onStartCardPlacement={(b, v) => onStartCardPlacement(b, v)}
          onCardPlacementCellPick={(assigneeUserId, workDate) =>
            void onCardPlacementPickCell(assigneeUserId, workDate)
          }
          groupMemberCountByGroupId={groupMemberCountByGroupId}
          salariedUserIds={jobScheduleSalariedUserIds}
          teamMembers={teamMembers}
          blocksByCell={blocksByCell}
          loading={loading}
          canEdit={canEdit}
          onWeekShift={shiftWeek}
          onThisWeek={goThisWeek}
          onAddClick={(assigneeUserId, workDate) => openAddBlock({ assigneeUserId, workDate, jobId })}
          onEditBlock={openEdit}
          onDeleteBlock={(id) => void onDeleteBlock(id)}
          scheduleTodayYmd={scheduleTodayYmd}
          officialJobTeamUserIds={officialJobTeamUserIds ?? undefined}
          canAddUserToJobRoster={canAddToJobRoster}
          onAddUserToJobRoster={canAddToJobRoster ? (uid) => void addUserToJobRoster(uid) : undefined}
          addToJobBusyUserId={addToJobBusyUserId}
        />
      </DndContext>

      <AddBlockModal
        open={blockModalState != null}
        mode={blockModalState?.kind === 'edit' ? 'edit' : 'add'}
        jobTitle={blockModalJobTitleForModal}
        personLabel={blockModalPersonLabel}
        workDate={blockModalWorkDate}
        timeStart={addTimeStart}
        timeEnd={addTimeEnd}
        note={addNote}
        saving={addSaving}
        error={addError}
        onClose={closeAdd}
        onChangeStart={setAddTimeStart}
        onChangeEnd={setAddTimeEnd}
        onChangeNote={setAddNote}
        onSave={() => void saveBlockModal()}
      />
    </div>
    {jobPreview ? (
      <PreviewJobModal
        open
        onClose={() => setJobPreview(null)}
        projectId={jobPreview.projectId}
        contextDateKey={jobPreview.dateKey}
        authUserId={authUser?.id}
        showJobsDeepLink={role !== 'subcontractor'}
      />
    ) : null}
    </>
  )
}
