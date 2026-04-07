import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useAuth } from '../hooks/useAuth'
import { useToastContext } from '../contexts/ToastContext'
import {
  deleteJobScheduleBlock,
  fetchJobScheduleBlocksForHubDateRange,
  fetchJobScheduleBlocksForJobDateRange,
  fetchScheduleBlocksForAssigneesOnDay,
  fetchScheduleJobContext,
  ensureSharedBlockGroupForRow,
  insertJobScheduleBlock,
  newJobScheduleSharedBlockGroupId,
  updateJobScheduleBlock,
  updateJobScheduleBlockGroup,
  type JobScheduleBlockRow,
  type ScheduleTeamMember,
} from '../lib/jobScheduleBlocks'
import {
  JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES,
  scheduleBlockToRange,
  scheduleOverlapsAny,
  scheduleTimeToMinutesFromMidnight,
  validateJobScheduleBlockMinuteRange,
} from '../lib/jobScheduleOverlap'
import { scheduleFormatWeekdayLong } from '../lib/jobScheduleChicago'
import { parseScheduleDispatchCellDroppableId } from '../lib/scheduleDispatchDnd'
import { fetchSalariedUserIdSetFromUserIds } from '../lib/salaryPayConfigGate'
import { DispatchAddBlockTimeRange } from '../components/schedule/DispatchAddBlockTimeRange'
import { PreviewJobModal } from '../components/calendar/PreviewJobModal'
import { ScheduleDispatchHub } from '../components/schedule/ScheduleDispatchHub'
import { cellKey, ScheduleDispatchGrid } from '../components/schedule/ScheduleDispatchGrid'
import {
  aggregateWeekSummariesByJob,
  blocksToJobWeekSummaries,
  buildPersonDayBlockMap,
  fetchJobsLedgerForScheduleDispatchHub,
  fetchTeamMemberUserIdsForJobIds,
  fetchUserNamesForIds,
  formatScheduleDispatchHubJobTitle,
  type ScheduleDispatchHubJobRow,
} from '../lib/scheduleDispatchHub'
import { formatErrorMessage } from '../utils/errorHandling'
import {
  companyWeekStartSundayContaining,
  formatScheduleDispatchVisibleDateRange,
  getDefaultWeekRange,
  getScheduleDispatchVisibleDayKeys,
  ymdAddDays,
} from '../utils/dateUtils'

const SCHEDULE_DISPATCH_HIDE_WEEKEND_STORAGE_KEY = 'scheduleDispatchHideWeekend'

function readScheduleDispatchHideWeekend(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SCHEDULE_DISPATCH_HIDE_WEEKEND_STORAGE_KEY) === '1'
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

type ScheduleDispatchBlockModalState =
  | { kind: 'add'; assigneeUserId: string; workDate: string }
  | { kind: 'edit'; blockId: string }

type ScheduleDispatchMirrorMode = { targetAssigneeUserId: string; workDate: string }

function timeInputToPg(t: string): string {
  const x = t.trim()
  if (/^\d{2}:\d{2}$/.test(x)) return `${x}:00`
  if (/^\d{2}:\d{2}:\d{2}$/.test(x)) return x
  return `${x}:00`
}

const MIN_MIN = 4 * 60
const MAX_MIN = 20 * 60

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

const DISPATCH_ADD_BLOCK_SLOT_STEP = JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES
const DISPATCH_ADD_BLOCK_SLOT_COUNT = (MAX_MIN - MIN_MIN) / DISPATCH_ADD_BLOCK_SLOT_STEP + 1

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function dispatchSlotIndexToMinutes(i: number): number {
  return MIN_MIN + clampInt(i, 0, DISPATCH_ADD_BLOCK_SLOT_COUNT - 1) * DISPATCH_ADD_BLOCK_SLOT_STEP
}

/** Nearest 30m slot for slider thumb; typed times off the grid may show a slightly different thumb until adjusted. */
function dispatchMinutesToSlotIndex(m: number): number {
  const c = clampInt(m, MIN_MIN, MAX_MIN)
  return clampInt(
    Math.round((c - MIN_MIN) / DISPATCH_ADD_BLOCK_SLOT_STEP),
    0,
    DISPATCH_ADD_BLOCK_SLOT_COUNT - 1,
  )
}

function dispatchMinutesToHHmm(m: number): string {
  const mm = clampInt(m, MIN_MIN, MAX_MIN)
  const h = Math.floor(mm / 60)
  const min = mm % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function timeInputToMinutesSafe(t: string): number {
  return scheduleTimeToMinutesFromMidnight(timeInputToPg(t))
}

function clampDispatchStartEndForMinDuration(sMin: number, eMin: number): { s: number; e: number } {
  let s = sMin
  let e = eMin
  if (e <= s) {
    e = Math.min(s + JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES, MAX_MIN)
  }
  if (e - s < JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES) {
    const bumpEnd = Math.min(s + JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES, MAX_MIN)
    if (bumpEnd - s >= JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES) {
      e = bumpEnd
    } else {
      s = Math.max(e - JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES, MIN_MIN)
    }
  }
  return { s, e }
}

function clampDispatchEndStartForMinDuration(eMin: number, sMin: number): { s: number; e: number } {
  let s = sMin
  let e = eMin
  if (e <= s) {
    s = Math.max(e - JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES, MIN_MIN)
  }
  if (e - s < JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES) {
    const bumpStart = Math.max(e - JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES, MIN_MIN)
    if (e - bumpStart >= JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES) {
      s = bumpStart
    } else {
      e = Math.min(s + JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES, MAX_MIN)
    }
  }
  return { s, e }
}

function formatDispatchQuickTimeLabel(hhmm: string): string {
  const [hs, ms] = hhmm.split(':')
  const h = Number(hs ?? '0')
  const m = Number(ms ?? '0')
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

function formatBlockDurationMinutes(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return '—'
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h > 0) return `${h}h ${r}m`
  return `${r}m`
}

function formatBlockDurationAriaLabel(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return 'Duration not available'
  const h = Math.floor(m / 60)
  const r = m % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`)
  if (r > 0) parts.push(`${r} ${r === 1 ? 'minute' : 'minutes'}`)
  if (parts.length === 0) return 'Duration zero minutes'
  return `Duration ${parts.join(' ')}`
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
        setSearchParams({ jobId, week: n }, { replace: true })
      } else {
        const p: Record<string, string> = { week: n }
        if (hubTabIsJobs) p.hubTab = 'jobs'
        setSearchParams(p, { replace: true })
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

  const visibleDayKeys = useMemo(
    () => getScheduleDispatchVisibleDayKeys(weekStart, hideWeekend),
    [weekStart, hideWeekend],
  )
  const dispatchWeekNavDateRangeOverride = useMemo(
    () => (hideWeekend ? formatScheduleDispatchVisibleDateRange(visibleDayKeys) : undefined),
    [hideWeekend, visibleDayKeys],
  )

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
  const [hubSalariedUserIds, setHubSalariedUserIds] = useState<Set<string>>(() => new Set())
  const [jobPreview, setJobPreview] = useState<{ projectId: string; dateKey: string } | null>(null)

  const canEdit = role != null && CAN_USE_SCHEDULE_DISPATCH.has(role)

  const hubSummaryRows = useMemo(() => blocksToJobWeekSummaries(hubWeekBlocks), [hubWeekBlocks])

  const hubPersonDayBlocks = useMemo(() => buildPersonDayBlockMap(hubWeekBlocks), [hubWeekBlocks])

  const hubJobTitleById = useMemo(() => {
    const m = new Map<string, string>()
    for (const j of hubJobs) {
      m.set(j.id, formatScheduleDispatchHubJobTitle(j.hcp_number, j.job_name))
    }
    return m
  }, [hubJobs])

  const hubJobProjectIdById = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const j of hubJobs) {
      m.set(j.id, j.project_id)
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
      setHubTeamMemberUserIds(teamIds)

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
      const rosterIds = [...new Set([...teamIds, ...assigneeIds])]
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
    } catch (err) {
      showToast(formatErrorMessage(err), 'error')
    } finally {
      if (hubLoadSeqRef.current === hubLoadSeq) {
        setHubLoading(false)
      }
    }
  }, [jobId, weekStart, weekEnd, showToast])

  useEffect(() => {
    if (jobId) {
      setHubLoading(false)
      return
    }
    void loadHub()
  }, [jobId, loadHub])

  const load = useCallback(async () => {
    if (!jobId) return
    setLoading(true)
    setLoadError(null)
    setJobScheduleSalariedUserIds(new Set())
    const [ctx, blk] = await Promise.all([
      fetchScheduleJobContext(jobId),
      fetchJobScheduleBlocksForJobDateRange(jobId, weekStart, weekEnd),
    ])
    if (ctx.error || !ctx.data) {
      setLoadError(ctx.error ?? 'Could not load job.')
      setJobTitle('')
      setTeamMembers([])
      setBlocks([])
    } else {
      setJobTitle(ctx.data.jobTitle)
      setTeamMembers(ctx.data.teamMembers)
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

  const jobWeekDatesWithBlocks = useMemo(() => new Set(blocks.map((b) => b.work_date)), [blocks])

  const nameByUserId = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of teamMembers) {
      m.set(t.user_id, (t.name ?? '').trim() || 'Unnamed')
    }
    return m
  }, [teamMembers])

  const [blockModalState, setBlockModalState] = useState<ScheduleDispatchBlockModalState | null>(null)
  const [addTimeStart, setAddTimeStart] = useState('08:00')
  const [addTimeEnd, setAddTimeEnd] = useState('12:00')
  const [addNote, setAddNote] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [mirrorMode, setMirrorMode] = useState<ScheduleDispatchMirrorMode | null>(null)

  useEffect(() => {
    if (!mirrorMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMirrorMode(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mirrorMode])

  const openAdd = useCallback((assigneeUserId: string, workDate: string) => {
    setMirrorMode(null)
    setBlockModalState({ kind: 'add', assigneeUserId, workDate })
    setAddTimeStart('08:00')
    setAddTimeEnd('12:00')
    setAddNote('')
    setAddError(null)
  }, [])

  const openEdit = useCallback(
    (block: JobScheduleBlockRow) => {
      if (!canEdit || !jobId || block.job_id !== jobId) return
      setMirrorMode(null)
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
  }, [])

  const onStartMirror = useCallback(
    (assigneeUserId: string, workDate: string) => {
      if (!canEdit || !jobId) return
      setBlockModalState(null)
      setAddError(null)
      setMirrorMode({ targetAssigneeUserId: assigneeUserId, workDate })
      showToast("Click a teammate's block on this day to mirror its time. Press Esc to cancel.", 'info')
    },
    [canEdit, jobId, showToast],
  )

  const onMirrorPickSource = useCallback(
    async (source: JobScheduleBlockRow) => {
      if (!mirrorMode || !jobId || !authUser?.id) return
      if (source.job_id !== jobId) return
      if (source.work_date !== mirrorMode.workDate) return
      if (source.assignee_user_id === mirrorMode.targetAssigneeUserId) return

      const gidExisting = source.shared_block_group_id
      if (gidExisting) {
        const targetInGroup = blocks.some(
          (x) => x.shared_block_group_id === gidExisting && x.assignee_user_id === mirrorMode.targetAssigneeUserId,
        )
        if (targetInGroup) {
          showToast('That person is already linked to this block.', 'info')
          return
        }
      }

      let groupId = source.shared_block_group_id
      if (!groupId) {
        const { data: newGid, error: enErr } = await ensureSharedBlockGroupForRow(source.id)
        if (enErr || !newGid) {
          showToast(enErr ?? 'Could not link block.', 'error')
          return
        }
        groupId = newGid
      }

      const candidate = scheduleBlockToRange(source.time_start, source.time_end)
      const { data: dayBlocks, error: dayErr } = await fetchScheduleBlocksForAssigneesOnDay(
        [mirrorMode.targetAssigneeUserId],
        mirrorMode.workDate,
      )
      if (dayErr) {
        showToast(dayErr, 'error')
        return
      }
      if (scheduleOverlapsAny(candidate, dayBlocks, undefined)) {
        showToast('That time overlaps another block for this person on this day.', 'error')
        return
      }

      const { error: insErr } = await insertJobScheduleBlock({
        job_id: jobId,
        assignee_user_id: mirrorMode.targetAssigneeUserId,
        work_date: mirrorMode.workDate,
        time_start: source.time_start,
        time_end: source.time_end,
        note: source.note,
        created_by: authUser.id,
        shared_block_group_id: groupId,
      })
      if (insErr) {
        showToast(insErr, 'error')
        return
      }
      setMirrorMode(null)
      showToast('Mirrored block added.', 'success')
      await load()
    },
    [mirrorMode, jobId, authUser?.id, blocks, load, showToast],
  )

  const blockModalPersonLabel = useMemo(() => {
    if (!blockModalState) return ''
    if (blockModalState.kind === 'add') {
      return nameByUserId.get(blockModalState.assigneeUserId) ?? 'Unknown'
    }
    const b = blockById.get(blockModalState.blockId)
    return b ? nameByUserId.get(b.assignee_user_id) ?? 'Unknown' : ''
  }, [blockModalState, nameByUserId, blockById])

  const blockModalWorkDate = useMemo(() => {
    if (!blockModalState) return ''
    if (blockModalState.kind === 'add') return blockModalState.workDate
    const b = blockById.get(blockModalState.blockId)
    return b?.work_date ?? ''
  }, [blockModalState, blockById])

  const saveBlockModal = useCallback(async () => {
    if (!blockModalState || !jobId) return
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
        job_id: jobId,
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
      await load()
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
      await load()
    },
    [canEdit, load, showToast],
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      if (!canEdit) return
      const { active, over } = event
      if (!over) return
      const parsed = parseScheduleDispatchCellDroppableId(over.id)
      if (!parsed) return
      const blockId = String(active.id)
      const block = blockById.get(blockId)
      if (!block) return
      if (block.shared_block_group_id) {
        showToast('Linked blocks cannot be reassigned by dragging. Edit times or remove a leg.', 'info')
        return
      }
      if (block.work_date !== parsed.workDate) {
        showToast('Moving to another day is not supported yet.', 'info')
        return
      }
      if (block.assignee_user_id === parsed.assigneeUserId) return

      const { data: dayBlocks, error: dayErr } = await fetchScheduleBlocksForAssigneesOnDay(
        [parsed.assigneeUserId],
        parsed.workDate,
      )
      if (dayErr) {
        showToast(dayErr, 'error')
        return
      }
      const candidate = scheduleBlockToRange(block.time_start, block.time_end)
      if (scheduleOverlapsAny(candidate, dayBlocks, [blockId])) {
        showToast('That time overlaps another block for this person on this day.', 'error')
        return
      }
      const { error: upErr } = await updateJobScheduleBlock(blockId, { assignee_user_id: parsed.assigneeUserId })
      if (upErr) {
        showToast(upErr, 'error')
        return
      }
      await load()
    },
    [canEdit, blockById, load, showToast],
  )

  const shiftWeek = useCallback(
    (deltaWeeks: number) => {
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
      if (t === 'people') {
        setSearchParams({ week: weekStart }, { replace: true })
        return
      }
      setSearchParams({ week: weekStart, hubTab: 'jobs' }, { replace: true })
    },
    [weekStart, setSearchParams],
  )

  const openJobWeekGrid = useCallback(
    (id: string) => {
      setSearchParams({ jobId: id, week: weekStart }, { replace: false })
    },
    [setSearchParams, weekStart],
  )

  const openJobPreviewFromHub = useCallback(
    (jid: string, dateKey: string) => {
      const pid = hubJobProjectIdById.get(jid)?.trim()
      if (!pid) {
        showToast('No workflow project linked to this job.', 'warning')
        return
      }
      setJobPreview({ projectId: pid, dateKey })
    },
    [hubJobProjectIdById, showToast],
  )

  if (authLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  }

  if (role != null && !CAN_USE_SCHEDULE_DISPATCH.has(role)) {
    return <Navigate to="/dashboard" replace />
  }

  if (!jobId) {
    return (
      <>
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
          onWeekShift={shiftWeek}
          onThisWeek={goThisWeek}
          onOpenJob={openJobWeekGrid}
          onOpenJobPreview={openJobPreviewFromHub}
        />
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

  return (
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
        <div style={{ fontSize: '0.9375rem', color: '#374151', fontWeight: 600 }}>{jobTitle}</div>
        {loadError ? (
          <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: '0.5rem 0 0', whiteSpace: 'pre-wrap' }}>{loadError}</p>
        ) : null}
      </div>

      {mirrorMode ? (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.5rem 0.75rem',
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: 6,
            fontSize: '0.8125rem',
            color: '#92400e',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>
            Mirroring to <strong>{nameByUserId.get(mirrorMode.targetAssigneeUserId) ?? 'Unknown'}</strong> on{' '}
            {mirrorMode.workDate}. Click a teammate&apos;s block (same day) to copy time and link.
          </span>
          <button
            type="button"
            onClick={() => setMirrorMode(null)}
            style={{
              padding: '0.2rem 0.55rem',
              fontSize: '0.75rem',
              border: '1px solid #b45309',
              borderRadius: 4,
              background: '#fff',
              color: '#78350f',
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
          jobId={jobId}
          jobWeekDatesWithBlocks={jobWeekDatesWithBlocks}
          mirrorMode={mirrorMode}
          groupMemberCountByGroupId={groupMemberCountByGroupId}
          salariedUserIds={jobScheduleSalariedUserIds}
          teamMembers={teamMembers}
          blocksByCell={blocksByCell}
          loading={loading}
          canEdit={canEdit}
          onWeekShift={shiftWeek}
          onThisWeek={goThisWeek}
          onAddClick={openAdd}
          onEditBlock={openEdit}
          onStartMirror={onStartMirror}
          onMirrorPickSource={(b) => void onMirrorPickSource(b)}
          onDeleteBlock={(id) => void onDeleteBlock(id)}
        />
      </DndContext>

      <AddBlockModal
        open={blockModalState != null}
        mode={blockModalState?.kind === 'edit' ? 'edit' : 'add'}
        jobTitle={jobTitle}
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
  )
}
