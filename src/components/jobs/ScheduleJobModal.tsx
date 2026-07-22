import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DispatchAddBlockTimeRange } from '../schedule/DispatchAddBlockTimeRange'
import { isSelectableOption } from '../SearchableSelect'
import { SearchableMultiSelect } from '../SearchableMultiSelect'
import {
  deleteJobScheduleBlock,
  fetchJobScheduleBlocksForJobDay,
  fetchScheduleBlocksForAssigneesOnDay,
  fetchScheduleJobContext,
  insertJobScheduleBlock,
  newJobScheduleSharedBlockGroupId,
  type ScheduleJobContext,
  type ScheduleTeamMember,
} from '../../lib/jobScheduleBlocks'
import {
  scheduleDateKeyAddDays,
  scheduleFormatWeekdayLong,
  scheduleTodayDateKey,
} from '../../lib/jobScheduleChicago'
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
} from '../../lib/dispatchAddBlockTime'
import {
  scheduleBlockToRange,
  scheduleOverlapsAny,
  scheduleTimeToMinutesFromMidnight,
  validateJobScheduleBlockMinuteRange,
} from '../../lib/jobScheduleOverlap'
import { ScheduleDayTimeline, type ScheduleTimelineSegment } from './ScheduleDayTimeline'

export type { ScheduleTeamMember } from '../../lib/jobScheduleBlocks'

type ScheduleFormDraft = {
  assigneeUserIds: string[]
  timeStart: string
  timeEnd: string
  note: string
}

const DEFAULT_DRAFT: ScheduleFormDraft = {
  assigneeUserIds: [],
  timeStart: '08:00',
  timeEnd: '12:00',
  note: '',
}

function dedupeAssigneeIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

type Props = {
  open: boolean
  onClose: () => void
  jobId: string
  jobTitle: string
  teamMembers: ScheduleTeamMember[]
  /** Roster (e.g. Jobs page users); shown after job team in assignee picker. */
  assigneeCandidates?: ScheduleTeamMember[]
}

const EMPTY_TEAM_MEMBERS: ScheduleTeamMember[] = []
const EMPTY_ASSIGNEE_CANDIDATES: ScheduleTeamMember[] = []

function scheduleAssigneeLabel(tm: ScheduleTeamMember): string {
  const n = (tm.name ?? '').trim()
  return n || tm.user_id.slice(0, 8)
}

export function ScheduleJobModal({
  open,
  onClose,
  jobId,
  jobTitle,
  teamMembers,
  assigneeCandidates: assigneeCandidatesProp,
}: Props) {
  const assigneeCandidates = assigneeCandidatesProp ?? EMPTY_ASSIGNEE_CANDIDATES
  const draftsRef = useRef<Record<string, ScheduleFormDraft>>({})
  const [contextStack, setContextStack] = useState<ScheduleJobContext[]>(() => [
    { jobId, jobTitle, project_id: null, teamMembers },
  ])
  const [workDate, setWorkDate] = useState(() => scheduleTodayDateKey())
  const [blocksThisJob, setBlocksThisJob] = useState<Awaited<ReturnType<typeof fetchJobScheduleBlocksForJobDay>>['data']>([])
  const [dayBlocksAll, setDayBlocksAll] = useState<Awaited<ReturnType<typeof fetchScheduleBlocksForAssigneesOnDay>>['data']>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contextNavLoading, setContextNavLoading] = useState(false)
  const [contextNavError, setContextNavError] = useState<string | null>(null)
  const [assigneeUserIds, setAssigneeUserIds] = useState<string[]>([])
  const [timeStart, setTimeStart] = useState('08:00')
  const [timeEnd, setTimeEnd] = useState('12:00')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const currentContext = useMemo(
    () => contextStack[contextStack.length - 1],
    [contextStack],
  )

  useEffect(() => {
    if (!open) {
      draftsRef.current = {}
      setContextStack([])
      setContextNavError(null)
      setContextNavLoading(false)
      return
    }
    setContextStack([{ jobId, jobTitle, project_id: null, teamMembers }])
    draftsRef.current = {}
    setWorkDate(scheduleTodayDateKey())
    setContextNavError(null)
    const teamFirst = teamMembers[0]?.user_id
    if (teamFirst) {
      setAssigneeUserIds([teamFirst])
    } else {
      const sorted = [...assigneeCandidates].sort((a, b) =>
        scheduleAssigneeLabel(a).localeCompare(scheduleAssigneeLabel(b)),
      )
      const c0 = sorted[0]?.user_id
      setAssigneeUserIds(c0 ? [c0] : [])
    }
    setTimeStart(DEFAULT_DRAFT.timeStart)
    setTimeEnd(DEFAULT_DRAFT.timeEnd)
    setNote(DEFAULT_DRAFT.note)
    // Only open + root jobId: do not depend on teamMembers[] identity (parent re-renders).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jobTitle/teamMembers/assigneeCandidates read fresh when jobId/open changes
  }, [open, jobId])

  const flushDraftToRef = useCallback(
    (ctxJobId: string) => {
      draftsRef.current = {
        ...draftsRef.current,
        [ctxJobId]: {
          assigneeUserIds,
          timeStart,
          timeEnd,
          note,
        },
      }
    },
    [assigneeUserIds, timeStart, timeEnd, note],
  )

  const applyDraftToForm = useCallback((targetJobId: string, members: ScheduleTeamMember[]) => {
    const d = draftsRef.current[targetJobId]
    const candFirst =
      [...assigneeCandidates].sort((a, b) =>
        scheduleAssigneeLabel(a).localeCompare(scheduleAssigneeLabel(b)),
      )[0]?.user_id ?? ''
    const teamFirst = members[0]?.user_id
    const defaultIds = dedupeAssigneeIds(teamFirst ? [teamFirst] : candFirst ? [candFirst] : [])
    const allowed = new Set([
      ...members.map((m) => m.user_id),
      ...assigneeCandidates.map((c) => c.user_id),
    ])
    const fromDraft = dedupeAssigneeIds(d?.assigneeUserIds?.filter((id) => allowed.has(id)) ?? [])
    setAssigneeUserIds(fromDraft.length > 0 ? fromDraft : defaultIds)
    setTimeStart(d?.timeStart ?? DEFAULT_DRAFT.timeStart)
    setTimeEnd(d?.timeEnd ?? DEFAULT_DRAFT.timeEnd)
    setNote(d?.note ?? DEFAULT_DRAFT.note)
  }, [assigneeCandidates])

  const goToJob = useCallback(
    async (targetJobId: string) => {
      if (!open) return
      const current = contextStack[contextStack.length - 1]
      if (!current || targetJobId === current.jobId) return

      flushDraftToRef(current.jobId)

      const idx = contextStack.findIndex((c) => c.jobId === targetJobId)
      if (idx >= 0) {
        const nextStack = contextStack.slice(0, idx + 1)
        const nextCtx = nextStack[nextStack.length - 1]!
        setContextStack(nextStack)
        setContextNavError(null)
        applyDraftToForm(nextCtx.jobId, nextCtx.teamMembers)
        return
      }

      setContextNavLoading(true)
      setContextNavError(null)
      const { data, error: fetchErr } = await fetchScheduleJobContext(targetJobId)
      setContextNavLoading(false)
      if (fetchErr || !data) {
        setContextNavError(fetchErr ?? 'Could not load job.')
        return
      }
      setContextStack((prev) => [...prev, data])
      applyDraftToForm(data.jobId, data.teamMembers)
    },
    [open, contextStack, flushDraftToRef, applyDraftToForm],
  )

  const currentJobId = currentContext?.jobId ?? ''
  const currentTeamMembers = currentContext?.teamMembers ?? EMPTY_TEAM_MEMBERS

  const assigneeSelectOptions = useMemo(() => {
    const teamSorted = [...currentTeamMembers].sort((a, b) =>
      scheduleAssigneeLabel(a).localeCompare(scheduleAssigneeLabel(b)),
    )
    const teamIds = new Set(teamSorted.map((t) => t.user_id))
    const othersSorted = [...assigneeCandidates]
      .filter((c) => !teamIds.has(c.user_id))
      .sort((a, b) => scheduleAssigneeLabel(a).localeCompare(scheduleAssigneeLabel(b)))
    const teamOpts = teamSorted.map((t) => ({ value: t.user_id, label: scheduleAssigneeLabel(t) }))
    const otherOpts = othersSorted.map((t) => ({ value: t.user_id, label: scheduleAssigneeLabel(t) }))
    if (teamOpts.length > 0 && otherOpts.length > 0) {
      return [
        ...teamOpts,
        { kind: 'separator' as const, id: 'schedule-assignee-divider' },
        ...otherOpts,
      ]
    }
    return [...teamOpts, ...otherOpts]
  }, [currentTeamMembers, assigneeCandidates])

  const nameByUserId = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of assigneeCandidates) {
      m.set(c.user_id, scheduleAssigneeLabel(c))
    }
    if (currentContext) {
      for (const t of currentContext.teamMembers) {
        m.set(t.user_id, scheduleAssigneeLabel(t))
      }
    }
    return m
  }, [assigneeCandidates, currentContext])

  useEffect(() => {
    if (!open) return
    if (assigneeUserIds.length > 0) return
    const first = assigneeSelectOptions.find(isSelectableOption)?.value
    if (first) setAssigneeUserIds([first])
  }, [open, assigneeUserIds.length, assigneeSelectOptions])

  const hasAssigneePickOptions = useMemo(
    () => assigneeSelectOptions.some(isSelectableOption),
    [assigneeSelectOptions],
  )

  const assigneeUserIdsLoadKey = useMemo(
    () => dedupeAssigneeIds(assigneeUserIds).sort().join(','),
    [assigneeUserIds],
  )

  const load = useCallback(async () => {
    if (!open || !currentJobId) return
    setLoading(true)
    setError(null)
    const teamIds = currentTeamMembers.map((t) => t.user_id)
    const selected = dedupeAssigneeIds(assigneeUserIds)
    const ids = [...new Set([...teamIds, ...selected].filter(Boolean))]
    const [r1, r2] = await Promise.all([
      fetchJobScheduleBlocksForJobDay(currentJobId, workDate),
      fetchScheduleBlocksForAssigneesOnDay(ids, workDate),
    ])
    if (r1.error) setError(r1.error)
    else if (r2.error) setError(r2.error)
    setBlocksThisJob(r1.data)
    setDayBlocksAll(r2.data)
    setLoading(false)
  }, [open, currentJobId, workDate, currentTeamMembers, assigneeUserIdsLoadKey])

  useEffect(() => {
    void load()
  }, [load])

  const timelineSegments = useMemo((): ScheduleTimelineSegment[] => {
    const segs: ScheduleTimelineSegment[] = []
    const seen = new Set<string>()
    for (const b of dayBlocksAll) {
      const name = nameByUserId.get(b.assignee_user_id) ?? 'Unknown'
      const isThis = b.job_id === currentJobId
      const id = b.id
      if (seen.has(id)) continue
      seen.add(id)
      const barLabel = name.trim().split(/\s+/)[0] || name
      segs.push({
        id,
        jobId: b.job_id,
        timeStart: b.time_start,
        timeEnd: b.time_end,
        label: barLabel,
        tooltipName: isThis ? name : `${name} (other job)`,
        variant: isThis ? 'this_job' : 'other',
      })
    }
    return segs.sort((a, b) => a.timeStart.localeCompare(b.timeStart))
  }, [dayBlocksAll, currentJobId, nameByUserId])

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
      setTimeStart(dispatchMinutesToHHmm(s))
      setTimeEnd(dispatchMinutesToHHmm(e))
    },
    [timeEnd],
  )

  const onEndSliderChange = useCallback(
    (slotIndex: number) => {
      const eMin = dispatchSlotIndexToMinutes(slotIndex)
      const sMinCur = timeInputToMinutesSafe(timeStart)
      const { s, e } = clampDispatchEndStartForMinDuration(eMin, sMinCur)
      setTimeStart(dispatchMinutesToHHmm(s))
      setTimeEnd(dispatchMinutesToHHmm(e))
    },
    [timeStart],
  )

  const shiftDay = (delta: number) => {
    const next = scheduleDateKeyAddDays(workDate, delta)
    if (next) setWorkDate(next)
  }

  const validateRange = (): string | null => {
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

  const saveBlock = async () => {
    const ids = dedupeAssigneeIds(assigneeUserIds)
    if (ids.length === 0) {
      setError('Pick at least one person.')
      return
    }
    const v = validateRange()
    if (v) {
      setError(v)
      return
    }
    const ts = timeInputToPg(timeStart)
    const te = timeInputToPg(timeEnd)
    const candidate = scheduleBlockToRange(ts, te)
    for (const uid of ids) {
      const sameAssignee = dayBlocksAll.filter((b) => b.assignee_user_id === uid)
      if (scheduleOverlapsAny(candidate, sameAssignee, undefined)) {
        const personName = nameByUserId.get(uid) ?? 'This person'
        setError(`${personName}: that time overlaps another block on this day.`)
        return
      }
    }
    setSaving(true)
    setError(null)
    const groupId = newJobScheduleSharedBlockGroupId()
    for (const uid of ids) {
      const { error: insErr } = await insertJobScheduleBlock({
        job_id: currentJobId,
        assignee_user_id: uid,
        work_date: workDate,
        time_start: ts,
        time_end: te,
        note: note.trim() || null,
        shared_block_group_id: groupId,
      })
      if (insErr) {
        setSaving(false)
        setError(insErr)
        await load()
        return
      }
    }
    setSaving(false)
    setNote('')
    draftsRef.current[currentJobId] = {
      assigneeUserIds: ids,
      timeStart,
      timeEnd,
      note: '',
    }
    await load()
  }

  const removeBlock = async (id: string) => {
    if (!window.confirm('Remove this scheduled block?')) return
    setError(null)
    const { error: delErr } = await deleteJobScheduleBlock(id)
    if (delErr) {
      setError(delErr)
      return
    }
    await load()
  }

  const handleClose = () => {
    draftsRef.current = {}
    setContextStack([])
    onClose()
  }

  if (!open) return null
  if (!currentContext) return null

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
      onClick={handleClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-labelledby="schedule-job-modal-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 560,
          width: '92%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ minWidth: 0 }}>
            <h2
              id="schedule-job-modal-title"
              style={{
                margin: 0,
                fontSize: '1.15rem',
                fontWeight: 400,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'baseline',
                gap: '0.35rem',
              }}
            >
              <span style={{ fontWeight: 600 }}>Schedule</span>
              <nav
                aria-label="Schedule job context"
                style={{
                  margin: 0,
                  fontSize: '1.15rem',
                  color: 'var(--text-600)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                }}
              >
                {contextStack.map((ctx, i) => (
                  <span key={`${ctx.jobId}-${i}`}>
                    {i > 0 ? (
                      <span aria-hidden style={{ margin: '0 0.25rem', color: 'var(--text-faint)' }}>
                        ←
                      </span>
                    ) : null}
                    {i < contextStack.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => void goToJob(ctx.jobId)}
                        disabled={contextNavLoading}
                        style={{
                          padding: 0,
                          margin: 0,
                          border: 'none',
                          background: 'none',
                          color: 'var(--text-link)',
                          cursor: contextNavLoading ? 'not-allowed' : 'pointer',
                          font: 'inherit',
                          textDecoration: 'underline',
                          textUnderlineOffset: 2,
                        }}
                      >
                        {ctx.jobTitle}
                      </button>
                    ) : (
                      <span aria-current="page" style={{ fontWeight: 600, color: 'var(--text-strong)' }}>
                        {ctx.jobTitle}
                      </span>
                    )}
                  </span>
                ))}
              </nav>
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.875rem',
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Close
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '1rem',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => shiftDay(-1)}
            style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
            aria-label="Previous day"
          >
            ←
          </button>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem', textAlign: 'center', flex: '1 1 auto' }}>
            {scheduleFormatWeekdayLong(workDate)}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{workDate}</div>
          </div>
          <button
            type="button"
            onClick={() => shiftDay(1)}
            style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
            aria-label="Next day"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => setWorkDate(scheduleTodayDateKey())}
            style={{ padding: '0.4rem 0.75rem', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
          >
            Today
          </button>
        </div>

        {contextNavLoading ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading job…</p> : null}
        {contextNavError ? <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{contextNavError}</p> : null}
        {loading ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p> : null}
        {error ? <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{error}</p> : null}

        <ScheduleDayTimeline
          segments={timelineSegments}
          currentJobId={currentJobId}
          onSegmentClick={(seg) => void goToJob(seg.jobId)}
        />

        <div
          style={{
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-700)' }}>
            Add block for this job
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <div style={{ marginBottom: 4 }}>Team members</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginBottom: 6 }}>
                Linked: same time and instructions for everyone selected ({assigneeUserIds.length} selected).
              </div>
              <SearchableMultiSelect
                id="schedule-job-assignee"
                options={assigneeSelectOptions}
                value={assigneeUserIds}
                onChange={setAssigneeUserIds}
                disabled={!hasAssigneePickOptions}
                listAriaLabel="Team members"
              />
            </div>
            <div style={{ marginBottom: 0 }}>
              <DispatchAddBlockTimeRange
                compact
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
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
                marginBottom: '0.75rem',
                alignItems: 'flex-end',
              }}
            >
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: '1 1 120px' }}>
                Start
                <input
                  type="time"
                  value={timeStart}
                  onChange={(e) => setTimeStart(e.target.value)}
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
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2 }}>Duration</div>
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--text-700)',
                  }}
                >
                  {durationDisplay}
                </div>
              </div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: '1 1 120px' }}>
                End
                <input
                  type="time"
                  value={timeEnd}
                  onChange={(e) => setTimeEnd(e.target.value)}
                  style={{ display: 'block', marginTop: 4, width: '100%', padding: '0.35rem' }}
                />
              </label>
            </div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Job instructions (optional)
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                style={{ display: 'block', marginTop: 4, width: '100%', padding: '0.4rem', fontSize: '0.875rem' }}
              />
            </label>
            <button
              type="button"
              disabled={
                saving || assigneeUserIds.length === 0 || !hasAssigneePickOptions
              }
              onClick={() => void saveBlock()}
              style={{
                alignSelf: 'flex-start',
                padding: '0.45rem 1rem',
                fontSize: '0.875rem',
                background:
                  saving || assigneeUserIds.length === 0 || !hasAssigneePickOptions
                    ? 'var(--bg-200)'
                    : '#2563eb',
                color:
                  saving || assigneeUserIds.length === 0 || !hasAssigneePickOptions
                    ? '#6b7280'
                    : '#fff',
                border: 'none',
                borderRadius: 4,
                cursor:
                  saving || assigneeUserIds.length === 0 || !hasAssigneePickOptions
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {saving
                ? 'Saving…'
                : assigneeUserIds.length > 1
                  ? `Add to schedule (${assigneeUserIds.length})`
                  : 'Add to schedule'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-700)' }}>
            This job — {blocksThisJob.length} block{blocksThisJob.length === 1 ? '' : 's'}
          </div>
          {blocksThisJob.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No blocks on this day yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {blocksThisJob.map((b) => (
                <li
                  key={b.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <span>
                    <strong>{nameByUserId.get(b.assignee_user_id) ?? 'Unknown'}</strong>
                    {' · '}
                    {b.time_start.slice(0, 5)}–{b.time_end.slice(0, 5)}
                    {b.note ? ` — ${b.note}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeBlock(b.id)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      background: 'var(--bg-red-tint)',
                      color: 'var(--text-red-700)',
                      border: '1px solid #fecaca',
                      borderRadius: 4,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
