import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  scheduleBlockToRange,
  scheduleOverlapsAny,
  scheduleTimeToMinutesFromMidnight,
  validateJobScheduleBlockMinuteRange,
} from '../../lib/jobScheduleOverlap'
import { ScheduleDayTimeline, type ScheduleTimelineSegment } from './ScheduleDayTimeline'

export type { ScheduleTeamMember } from '../../lib/jobScheduleBlocks'

type ScheduleFormDraft = {
  assigneeUserId: string
  timeStart: string
  timeEnd: string
  note: string
}

const DEFAULT_DRAFT: ScheduleFormDraft = {
  assigneeUserId: '',
  timeStart: '08:00',
  timeEnd: '12:00',
  note: '',
}

type Props = {
  open: boolean
  onClose: () => void
  jobId: string
  jobTitle: string
  teamMembers: ScheduleTeamMember[]
}

function timeInputToPg(t: string): string {
  const x = t.trim()
  if (/^\d{2}:\d{2}$/.test(x)) return `${x}:00`
  if (/^\d{2}:\d{2}:\d{2}$/.test(x)) return x
  return `${x}:00`
}

const MIN_MIN = 4 * 60
const MAX_MIN = 20 * 60

const EMPTY_TEAM_MEMBERS: ScheduleTeamMember[] = []

export function ScheduleJobModal({ open, onClose, jobId, jobTitle, teamMembers }: Props) {
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
  const [assigneeUserId, setAssigneeUserId] = useState('')
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
    const first = teamMembers[0]?.user_id ?? ''
    setAssigneeUserId(first)
    setTimeStart(DEFAULT_DRAFT.timeStart)
    setTimeEnd(DEFAULT_DRAFT.timeEnd)
    setNote(DEFAULT_DRAFT.note)
    // Only open + root jobId: do not depend on teamMembers[] identity (parent re-renders).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jobTitle/teamMembers read fresh when jobId/open changes
  }, [open, jobId])

  const flushDraftToRef = useCallback(
    (ctxJobId: string) => {
      draftsRef.current = {
        ...draftsRef.current,
        [ctxJobId]: {
          assigneeUserId,
          timeStart,
          timeEnd,
          note,
        },
      }
    },
    [assigneeUserId, timeStart, timeEnd, note],
  )

  const applyDraftToForm = useCallback((targetJobId: string, members: ScheduleTeamMember[]) => {
    const d = draftsRef.current[targetJobId]
    const first = members[0]?.user_id ?? ''
    const a =
      d?.assigneeUserId && members.some((m) => m.user_id === d.assigneeUserId)
        ? d.assigneeUserId
        : first
    setAssigneeUserId(a)
    setTimeStart(d?.timeStart ?? DEFAULT_DRAFT.timeStart)
    setTimeEnd(d?.timeEnd ?? DEFAULT_DRAFT.timeEnd)
    setNote(d?.note ?? DEFAULT_DRAFT.note)
  }, [])

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

  const nameByUserId = useMemo(() => {
    const m = new Map<string, string>()
    if (!currentContext) return m
    for (const t of currentContext.teamMembers) {
      m.set(t.user_id, (t.name ?? '').trim() || 'Unnamed')
    }
    return m
  }, [currentContext])

  const currentJobId = currentContext?.jobId ?? ''
  const currentTeamMembers = currentContext?.teamMembers ?? EMPTY_TEAM_MEMBERS

  const load = useCallback(async () => {
    if (!open || !currentJobId) return
    setLoading(true)
    setError(null)
    const ids = currentTeamMembers.map((t) => t.user_id)
    const [r1, r2] = await Promise.all([
      fetchJobScheduleBlocksForJobDay(currentJobId, workDate),
      fetchScheduleBlocksForAssigneesOnDay(ids, workDate),
    ])
    if (r1.error) setError(r1.error)
    else if (r2.error) setError(r2.error)
    setBlocksThisJob(r1.data)
    setDayBlocksAll(r2.data)
    setLoading(false)
  }, [open, currentJobId, workDate, currentTeamMembers])

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
    if (!assigneeUserId) {
      setError('Pick a team member.')
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
    const sameAssignee = dayBlocksAll.filter((b) => b.assignee_user_id === assigneeUserId)
    if (scheduleOverlapsAny(candidate, sameAssignee, undefined)) {
      setError('That time overlaps another block for this person on this day.')
      return
    }
    setSaving(true)
    setError(null)
    const { error: insErr } = await insertJobScheduleBlock({
      job_id: currentJobId,
      assignee_user_id: assigneeUserId,
      work_date: workDate,
      time_start: ts,
      time_end: te,
      note: note.trim() || null,
      shared_block_group_id: newJobScheduleSharedBlockGroupId(),
    })
    setSaving(false)
    if (insErr) {
      setError(insErr)
      return
    }
    setNote('')
    draftsRef.current[currentJobId] = {
      assigneeUserId,
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
          background: '#fff',
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
            <h2 id="schedule-job-modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>
              Schedule
            </h2>
            <nav aria-label="Schedule job context" style={{ margin: '0.35rem 0 0', fontSize: '0.875rem', color: '#4b5563' }}>
              {contextStack.map((ctx, i) => (
                <span key={`${ctx.jobId}-${i}`}>
                  {i > 0 ? (
                    <span aria-hidden style={{ margin: '0 0.25rem', color: '#9ca3af' }}>
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
                        color: '#2563eb',
                        cursor: contextNavLoading ? 'not-allowed' : 'pointer',
                        font: 'inherit',
                        textDecoration: 'underline',
                        textUnderlineOffset: 2,
                      }}
                    >
                      {ctx.jobTitle}
                    </button>
                  ) : (
                    <span aria-current="page" style={{ fontWeight: 600, color: '#111827' }}>
                      {ctx.jobTitle}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.875rem',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
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
            style={{ padding: '0.4rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
            aria-label="Previous day"
          >
            ←
          </button>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem', textAlign: 'center', flex: '1 1 auto' }}>
            {scheduleFormatWeekdayLong(workDate)}
            <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 400 }}>{workDate}</div>
          </div>
          <button
            type="button"
            onClick={() => shiftDay(1)}
            style={{ padding: '0.4rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
            aria-label="Next day"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => setWorkDate(scheduleTodayDateKey())}
            style={{ padding: '0.4rem 0.75rem', border: '1px solid #2563eb', color: '#2563eb', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
          >
            Today
          </button>
        </div>

        {contextNavLoading ? <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading job…</p> : null}
        {contextNavError ? <p style={{ color: '#b91c1c', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{contextNavError}</p> : null}
        {loading ? <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading…</p> : null}
        {error ? <p style={{ color: '#b91c1c', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{error}</p> : null}

        <ScheduleDayTimeline
          segments={timelineSegments}
          currentJobId={currentJobId}
          onSegmentClick={(seg) => void goToJob(seg.jobId)}
        />

        <div
          style={{
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e5e7eb',
          }}
        >
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
            Add block for this job
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              Team member
              <select
                value={assigneeUserId}
                onChange={(e) => setAssigneeUserId(e.target.value)}
                style={{ display: 'block', marginTop: 4, width: '100%', padding: '0.4rem', fontSize: '0.875rem' }}
              >
                {currentTeamMembers.map((t) => (
                  <option key={t.user_id} value={t.user_id}>
                    {(t.name ?? '').trim() || t.user_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.75rem', color: '#6b7280', flex: '1 1 120px' }}>
                Start
                <input
                  type="time"
                  value={timeStart}
                  onChange={(e) => setTimeStart(e.target.value)}
                  style={{ display: 'block', marginTop: 4, width: '100%', padding: '0.35rem' }}
                />
              </label>
              <label style={{ fontSize: '0.75rem', color: '#6b7280', flex: '1 1 120px' }}>
                End
                <input
                  type="time"
                  value={timeEnd}
                  onChange={(e) => setTimeEnd(e.target.value)}
                  style={{ display: 'block', marginTop: 4, width: '100%', padding: '0.35rem' }}
                />
              </label>
            </div>
            <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              Note (optional)
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
              disabled={saving || currentTeamMembers.length === 0}
              onClick={() => void saveBlock()}
              style={{
                alignSelf: 'flex-start',
                padding: '0.45rem 1rem',
                fontSize: '0.875rem',
                background: saving || currentTeamMembers.length === 0 ? '#e5e7eb' : '#2563eb',
                color: saving || currentTeamMembers.length === 0 ? '#6b7280' : '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: saving || currentTeamMembers.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Add to schedule'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
            This job — {blocksThisJob.length} block{blocksThisJob.length === 1 ? '' : 's'}
          </div>
          {blocksThisJob.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No blocks on this day yet.</p>
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
                    borderBottom: '1px solid #f3f4f6',
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
                      background: '#fef2f2',
                      color: '#b91c1c',
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
