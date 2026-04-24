import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToastContext } from '../contexts/ToastContext'
import { useUserDayScheduleModal } from '../contexts/UserDayScheduleModalContext'
import { usePersonDayScheduleData } from '../hooks/usePersonDayScheduleData'
import { useIntervalNowMs } from '../hooks/useIntervalNowMs'
import { useMatchMedia } from '../hooks/useMatchMedia'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { saveNewScheduleBlockForPersonDay } from '../lib/scheduleDispatchAddBlockSave'
import { CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES } from '../lib/scheduleDispatchEditRoles'
import {
  defaultNewBlockRangeInFirstGap,
  type AddBlockTimelineSegment,
} from '../lib/scheduleDispatchAddBlockTimeline'
import { scheduleTimeToMinutesFromMidnight } from '../lib/jobScheduleOverlap'
import { scheduleFormatWeekdayLong } from '../lib/jobScheduleChicago'
import { blocksToSegments } from '../lib/quickfillScheduleSegments'
import { recordNotComingInForUserAsStaff } from '../lib/notComingInTimeOff'
import { formatScheduleDispatchHubJobTitle } from '../lib/scheduleDispatchHub'
import { clockSessionsToDispatchSecondaryBands } from '../lib/clockSessionsToDispatchSecondaryBands'
import {
  DISPATCH_ADD_BLOCK_SLOT_COUNT,
  dispatchMinutesToHHmm,
  timeInputToPg,
} from '../lib/dispatchAddBlockTime'
import {
  DISPATCH_ADD_BLOCK_ORIENTATION_MARKS,
  dispatchAddBlockTrackThumbLeftPct,
  type DispatchOccupiedBand,
} from './schedule/DispatchAddBlockTimeRange'
import { ScheduleDispatchAddBlockModal } from './schedule/ScheduleDispatchAddBlockModal'
import { ScheduleDispatchAssignJobPickerModal } from './schedule/ScheduleDispatchAssignJobPickerModal'
import {
  QuickfillScheduleUserRow,
  QUICKFILL_SCHEDULE_ADD_COL_WIDTH,
} from './schedule/QuickfillScheduleUserRow'
import { DashboardMyTimeDayEditorModal } from './DashboardMyTimeDayEditorModal'
import {
  APP_CALENDAR_TZ,
  companyWeekStartSundayContaining,
  denverCalendarDayKey,
  formatDenverWeekday,
  getDefaultWeekRange,
  referenceDateForWorkDateYmd,
  ymdAddDays,
} from '../utils/dateUtils'

const MODAL_Z = 1200

const scheduleDateInputSrOnly: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

type BlockModalState = { kind: 'add'; assigneeUserId: string; workDate: string; jobId: string }

function UserDayScheduleDateNav({
  workDateYmd,
  onWorkDateYmdChange,
  dayLabel,
  dateMdYDisplay,
}: {
  workDateYmd: string
  onWorkDateYmdChange: (ymd: string) => void
  dayLabel: string
  dateMdYDisplay: string
}) {
  return (
    <>
      <span style={{ color: '#111827', fontWeight: 600 }}>{dayLabel}</span>
      <label
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'pointer',
          color: '#374151',
          fontWeight: 500,
        }}
      >
        <input
          type="date"
          value={workDateYmd}
          onChange={(e) => {
            const v = e.target.value
            if (v) onWorkDateYmdChange(v)
          }}
          style={scheduleDateInputSrOnly}
          aria-label="Schedule day"
        />
        <span style={{ userSelect: 'none' }}>{dateMdYDisplay}</span>
      </label>
    </>
  )
}

const scheduleDayChevronButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 32,
  minHeight: 32,
  padding: 0,
  fontSize: '0.8125rem',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: '#fff',
  color: '#374151',
  cursor: 'pointer',
  boxSizing: 'border-box',
  flexShrink: 0,
}

export default function UserDayScheduleModal() {
  const modal = useUserDayScheduleModal()
  const { user: authUser, role } = useAuth()
  const { showToast } = useToastContext()
  const navigate = useNavigate()
  const nowMs = useIntervalNowMs(45_000)

  const payload = modal?.payload ?? null
  const isOpen = payload != null

  const [workDateYmd, setWorkDateYmd] = useState(() => denverCalendarDayKey(Date.now()))
  useEffect(() => {
    if (!payload) return
    setWorkDateYmd(payload.workDateYmd?.trim() || denverCalendarDayKey(Date.now()))
  }, [payload])

  const onDataError = useCallback(
    (message: string, variant: 'error' | 'warning') => {
      showToast(message, variant)
    },
    [showToast],
  )

  const { loading, blocks, sessions, jobTitleById, bidTitleById, hubJobsForPicker, reload } =
    usePersonDayScheduleData(isOpen ? payload.userId : null, isOpen ? workDateYmd : null, onDataError)

  const canEditSchedule = role != null && CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES.has(role)
  const showClockStripScopeToggle =
    role === 'dev' || role === 'master_technician' || role === 'assistant'
  const showStripSubjectMyTimeEditor = showClockStripScopeToggle || role === 'superintendent'

  const narrow = useNarrowViewport640()
  const headerInline = useMatchMedia('(min-width: 900px)')

  const [scheduleMyTimeEditor, setScheduleMyTimeEditor] = useState<{
    subjectUserId: string
    subjectDisplayName: string
  } | null>(null)
  const [cellAddContext, setCellAddContext] = useState<{ assigneeUserId: string; workDate: string } | null>(null)
  const [assignJobPickerOpen, setAssignJobPickerOpen] = useState(false)
  const [assignJobPickerSearch, setAssignJobPickerSearch] = useState('')
  const [blockModalState, setBlockModalState] = useState<BlockModalState | null>(null)
  const [addBlockTimelineSegments, setAddBlockTimelineSegments] = useState<AddBlockTimelineSegment[]>([])
  const [addBlockDraftByBlockId, setAddBlockDraftByBlockId] = useState<
    Record<string, { time_start: string; time_end: string }>
  >({})
  const [addTimeStart, setAddTimeStart] = useState('08:00')
  const [addTimeEnd, setAddTimeEnd] = useState('16:00')
  const [addNote, setAddNote] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [addSaving, setAddSaving] = useState(false)

  const segments = useMemo(
    () => blocksToSegments(blocks, new Map(jobTitleById)),
    [blocks, jobTitleById],
  )

  const secondaryBands = useMemo(
    () =>
      clockSessionsToDispatchSecondaryBands(
        sessions,
        workDateYmd,
        nowMs,
        new Map(jobTitleById),
        new Map(bidTitleById),
      ),
    [sessions, workDateYmd, nowMs, jobTitleById, bidTitleById],
  )

  const openMyTimeForSessionStrip = useCallback((uid: string, name: string) => {
    setScheduleMyTimeEditor({ subjectUserId: uid, subjectDisplayName: name })
  }, [])

  const closeAddBlock = useCallback(() => {
    setBlockModalState(null)
    setAddError(null)
    setAddBlockTimelineSegments([])
    setAddBlockDraftByBlockId({})
  }, [])

  const closeJobPicker = useCallback(() => {
    setAssignJobPickerOpen(false)
    setCellAddContext(null)
    setAssignJobPickerSearch('')
  }, [])

  const openScheduleAddFromModal = useCallback(() => {
    if (!payload) return
    setCellAddContext({ assigneeUserId: payload.userId, workDate: workDateYmd })
    setAssignJobPickerSearch('')
    setAssignJobPickerOpen(true)
  }, [payload, workDateYmd])

  const openAddBlock = useCallback(
    (args: { assigneeUserId: string; workDate: string; jobId: string }) => {
      setAssignJobPickerOpen(false)
      setCellAddContext(null)
      setAssignJobPickerSearch('')
      setBlockModalState({ kind: 'add', assigneeUserId: args.assigneeUserId, workDate: args.workDate, jobId: args.jobId })
      const rows = blocks
      const labelFor = (jid: string) => jobTitleById.get(jid) ?? formatScheduleDispatchHubJobTitle(null, null)
      const segs: AddBlockTimelineSegment[] = [...rows]
        .map((b) => ({
          blockId: b.id,
          jobId: b.job_id,
          label: labelFor(b.job_id),
          time_start: b.time_start,
          time_end: b.time_end,
          shared_block_group_id: b.shared_block_group_id,
        }))
        .sort(
          (a, b) =>
            scheduleTimeToMinutesFromMidnight(timeInputToPg(a.time_start.slice(0, 5))) -
            scheduleTimeToMinutesFromMidnight(timeInputToPg(b.time_start.slice(0, 5))),
        )
      setAddBlockTimelineSegments(segs)
      setAddBlockDraftByBlockId({})
      const def = defaultNewBlockRangeInFirstGap({ segments: segs, draftByBlockId: {} })
      if (def) {
        setAddTimeStart(dispatchMinutesToHHmm(def.startMin))
        setAddTimeEnd(dispatchMinutesToHHmm(def.endMin))
      } else {
        setAddTimeStart('08:00')
        setAddTimeEnd('16:00')
      }
      setAddNote('')
      setAddError(null)
    },
    [blocks, jobTitleById],
  )

  const quickfillOrderedSessionJobLedgerIds = useMemo(() => {
    if (!cellAddContext) return [] as string[]
    const list = sessions.filter((s) => s.user_id === cellAddContext.assigneeUserId)
    const out: string[] = []
    const seen = new Set<string>()
    for (const s of list) {
      const jid = s.job_ledger_id?.trim()
      if (!jid || seen.has(jid)) continue
      seen.add(jid)
      out.push(jid)
    }
    return out
  }, [cellAddContext, sessions])

  const quickfillSessionJobOrderIndex = useMemo(() => {
    const m = new Map<string, number>()
    quickfillOrderedSessionJobLedgerIds.forEach((id, i) => m.set(id, i))
    return m
  }, [quickfillOrderedSessionJobLedgerIds])

  const quickfillPickerJobsSorted = useMemo(
    () =>
      [...hubJobsForPicker].sort((a, b) => {
        const ia = quickfillSessionJobOrderIndex.get(a.id)
        const ib = quickfillSessionJobOrderIndex.get(b.id)
        const aIn = ia !== undefined
        const bIn = ib !== undefined
        if (aIn && !bIn) return -1
        if (!aIn && bIn) return 1
        if (aIn && bIn && ia !== ib) return (ia as number) - (ib as number)
        const ha = (a.hcp_number ?? '').trim()
        const hb = (b.hcp_number ?? '').trim()
        return hb.localeCompare(ha, undefined, { numeric: true })
      }),
    [hubJobsForPicker, quickfillSessionJobOrderIndex],
  )

  const quickfillAssignJobPickerRows = useMemo(() => {
    const q = assignJobPickerSearch.trim().toLowerCase()
    const sessionTodaySet = new Set(quickfillOrderedSessionJobLedgerIds)
    let list = quickfillPickerJobsSorted
    if (q) {
      list = list.filter(
        (j) =>
          (j.hcp_number ?? '').toLowerCase().includes(q) ||
          (j.job_name ?? '').toLowerCase().includes(q) ||
          formatScheduleDispatchHubJobTitle(j.hcp_number, j.job_name).toLowerCase().includes(q),
      )
    }
    return list.map((j) => ({
      id: j.id,
      displayTitle: formatScheduleDispatchHubJobTitle(j.hcp_number, j.job_name),
      sessionToday: sessionTodaySet.has(j.id),
    }))
  }, [assignJobPickerSearch, quickfillOrderedSessionJobLedgerIds, quickfillPickerJobsSorted])

  const quickfillCellChoiceSubtitle = useMemo(() => {
    if (!cellAddContext) return ''
    return `${payload?.displayName ?? 'Unknown'} · ${scheduleFormatWeekdayLong(cellAddContext.workDate)} (${
      cellAddContext.workDate
    })`
  }, [cellAddContext, payload?.displayName])

  const quickfillAssignJobPickerSubtitle = useMemo((): ReactNode => {
    if (!cellAddContext) return null
    return (
      <p style={{ margin: 0, fontSize: '0.875rem', color: '#4b5563' }}>
        Pick a job to add a block for <strong>{quickfillCellChoiceSubtitle}</strong>.
      </p>
    )
  }, [cellAddContext, quickfillCellChoiceSubtitle])

  const blockModalPersonLabel = useMemo(
    () => (payload != null ? payload.displayName : ''),
    [payload],
  )
  const blockModalJobTitle = useMemo(
    () => (blockModalState != null ? jobTitleById.get(blockModalState.jobId) ?? formatScheduleDispatchHubJobTitle(null, null) : ''),
    [blockModalState, jobTitleById],
  )

  const addBlockModalTimeline = useMemo(() => {
    if (blockModalState == null) return undefined
    return {
      segments: addBlockTimelineSegments,
      draftByBlockId: addBlockDraftByBlockId,
      setDraftByBlockId: setAddBlockDraftByBlockId,
    }
  }, [blockModalState, addBlockTimelineSegments, addBlockDraftByBlockId])

  const saveBlockModal = useCallback(async () => {
    if (!blockModalState || !authUser?.id) return
    setAddSaving(true)
    setAddError(null)
    const res = await saveNewScheduleBlockForPersonDay({
      authUserId: authUser.id,
      assigneeUserId: blockModalState.assigneeUserId,
      workDate: blockModalState.workDate,
      targetJobId: blockModalState.jobId,
      addTimeStart,
      addTimeEnd,
      addNote,
      addBlockDraftByBlockId,
    })
    setAddSaving(false)
    if (!res.ok) {
      setAddError(res.error)
      return
    }
    showToast('Block added.', 'success')
    closeAddBlock()
    void reload({ quiet: true })
  }, [
    addBlockDraftByBlockId,
    addNote,
    addTimeEnd,
    addTimeStart,
    authUser?.id,
    blockModalState,
    closeAddBlock,
    reload,
    showToast,
  ])

  const handleMarkNotComingIn = useCallback(async () => {
    const editor = scheduleMyTimeEditor
    if (!editor) return
    const result = await recordNotComingInForUserAsStaff({
      subjectUserId: editor.subjectUserId,
      workDateYmd: workDateYmd,
    })
    if (result.ok && result.alreadyMarked) {
      showToast(`${editor.subjectDisplayName} already has unpaid time off on ${workDateYmd}.`, 'warning')
      return
    }
    if (!result.ok) {
      showToast(result.message, 'error')
      return
    }
    showToast(`Marked ${editor.subjectDisplayName} as not coming in (${workDateYmd}).`, 'success')
    if (result.syncWarning) {
      showToast(`Salary sync: ${result.syncWarning}`, 'warning')
    }
    void reload({ quiet: true })
  }, [scheduleMyTimeEditor, workDateYmd, showToast, reload])

  const dayLabel = useMemo(() => {
    const ms = referenceDateForWorkDateYmd(workDateYmd).getTime()
    return formatDenverWeekday(ms)
  }, [workDateYmd])

  const dateMdYDisplay = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: APP_CALENDAR_TZ,
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      }).format(referenceDateForWorkDateYmd(workDateYmd)),
    [workDateYmd],
  )

  const scheduleDispatchHref = useMemo(() => {
    const weekStart = companyWeekStartSundayContaining(workDateYmd) ?? getDefaultWeekRange().start
    return `/schedule-dispatch?week=${encodeURIComponent(weekStart)}&day=${encodeURIComponent(workDateYmd)}`
  }, [workDateYmd])

  const openOccupiedBandOnScheduleDispatch = useCallback(
    (band: DispatchOccupiedBand) => {
      const jid = band.jobId?.trim()
      if (!jid) return
      const weekStart = companyWeekStartSundayContaining(workDateYmd) ?? getDefaultWeekRange().start
      navigate(
        `/schedule-dispatch?jobId=${encodeURIComponent(jid)}&week=${encodeURIComponent(weekStart)}&day=${encodeURIComponent(workDateYmd)}`,
      )
    },
    [navigate, workDateYmd],
  )

  const jobLabelsRecord = useMemo(() => Object.fromEntries(jobTitleById), [jobTitleById])
  const bidLabelsRecord = useMemo(() => Object.fromEntries(bidTitleById), [bidTitleById])

  useEffect(() => {
    setAssignJobPickerOpen(false)
    setCellAddContext(null)
    setAssignJobPickerSearch('')
    closeAddBlock()
  }, [workDateYmd, closeAddBlock])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        modal?.close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, modal])

  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [isOpen])

  if (!isOpen || !modal || !payload) return null

  const showTodayInHeader = workDateYmd !== denverCalendarDayKey(Date.now())
  const userDayHeaderTitle = (
    <h2
      id="user-day-schedule-modal-title"
      style={{
        margin: 0,
        fontSize: '1.05rem',
        fontWeight: 600,
        color: '#111827',
        minWidth: 0,
        width: '100%',
        overflow: 'hidden',
      }}
    >
      {showStripSubjectMyTimeEditor ? (
        <button
          type="button"
          onClick={() => openMyTimeForSessionStrip(payload.userId, payload.displayName)}
          title={`Time and attendance for ${payload.displayName} (${workDateYmd})`}
          aria-label={`Time and attendance for ${payload.displayName} on ${workDateYmd}`}
          style={{
            display: 'block',
            maxWidth: '100%',
            margin: 0,
            padding: 0,
            border: 'none',
            background: 'none',
            font: 'inherit',
            fontSize: '1.05rem',
            fontWeight: 600,
            color: 'inherit',
            textAlign: 'left',
            cursor: 'pointer',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {payload.displayName}
        </button>
      ) : (
        <span
          style={{
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {payload.displayName}
        </span>
      )}
    </h2>
  )
  const userDayHeaderToday = showTodayInHeader ? (
    <button
      type="button"
      onClick={() => setWorkDateYmd(denverCalendarDayKey(Date.now()))}
      style={{
        flexShrink: 0,
        padding: '0.25rem 0.5rem',
        fontSize: '0.8125rem',
        border: '1px solid #2563eb',
        borderRadius: 4,
        background: '#eff6ff',
        color: '#1d4ed8',
        cursor: 'pointer',
      }}
    >
      Today
    </button>
  ) : null

  const dateNavProps = {
    workDateYmd,
    onWorkDateYmdChange: setWorkDateYmd,
    dayLabel,
    dateMdYDisplay,
  } as const

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: MODAL_Z,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-day-schedule-modal-title"
      onClick={() => modal.close()}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          maxWidth: 'min(100%, 48rem)',
          width: '100%',
          maxHeight: 'min(90vh, 800px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid #e5e7eb',
            flexShrink: 0,
          }}
        >
          {narrow ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>{userDayHeaderTitle}</div>
              {userDayHeaderToday}
            </div>
          ) : headerInline ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
              }}
            >
              <div style={{ minWidth: 0, width: '100%', justifySelf: 'start' }}>{userDayHeaderTitle}</div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem 0.5rem',
                  fontSize: '0.875rem',
                }}
              >
                <UserDayScheduleDateNav {...dateNavProps} />
              </div>
              <div style={{ justifySelf: 'end' }}>{userDayHeaderToday}</div>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                }}
              >
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>{userDayHeaderTitle}</div>
                {userDayHeaderToday}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem 0.5rem',
                  width: '100%',
                  fontSize: '0.875rem',
                }}
              >
                <UserDayScheduleDateNav {...dateNavProps} />
              </div>
            </>
          )}
        </div>

        <div
          style={{
            padding: '0.75rem 1rem 1rem',
            overflow: 'auto',
            flex: 1,
            minHeight: 0,
          }}
        >
          {narrow ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem 0.5rem',
                width: '100%',
                marginBottom: '0.75rem',
                fontSize: '0.875rem',
              }}
            >
              <UserDayScheduleDateNav {...dateNavProps} />
            </div>
          ) : null}

          <div
            style={{
              position: 'relative',
              width: '100%',
              marginBottom: '0.15rem',
            }}
          >
            <button
              type="button"
              onClick={() => setWorkDateYmd((d) => ymdAddDays(d, -1))}
              title="Previous day"
              aria-label="Previous day"
              style={{
                ...scheduleDayChevronButtonStyle,
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 1,
              }}
            >
              <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
            </button>
            <div
              aria-hidden
              style={{
                position: 'relative',
                width: '100%',
                minWidth: 0,
                height: 12,
                pointerEvents: 'none',
              }}
            >
              {DISPATCH_ADD_BLOCK_ORIENTATION_MARKS.filter(
                (m) => m.slotIndex <= DISPATCH_ADD_BLOCK_SLOT_COUNT - 1,
              ).map(({ slotIndex, label }) => (
                <span
                  key={slotIndex}
                  style={{
                    position: 'absolute',
                    left: dispatchAddBlockTrackThumbLeftPct(slotIndex, DISPATCH_ADD_BLOCK_SLOT_COUNT),
                    transform: 'translateX(-50%)',
                    fontSize: '0.65rem',
                    color: '#9ca3af',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setWorkDateYmd((d) => ymdAddDays(d, 1))}
              title="Next day"
              aria-label="Next day"
              style={{
                ...scheduleDayChevronButtonStyle,
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 1,
              }}
            >
              <ChevronRight size={18} strokeWidth={2.25} aria-hidden />
            </button>
          </div>

          {loading ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading…</p>
          ) : (
            <QuickfillScheduleUserRow
              userId={payload.userId}
              displayName={payload.displayName}
              scheduleDayYmd={workDateYmd}
              segments={segments}
              secondaryBands={secondaryBands}
              showNameColumn={false}
              onOpenMyTimeForSessionStrip={
                showStripSubjectMyTimeEditor ? openMyTimeForSessionStrip : undefined
              }
              onOccupiedBandClick={openOccupiedBandOnScheduleDispatch}
            />
          )}
        </div>

        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid #e5e7eb',
            padding: '0.5rem 1rem 0.75rem',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div style={{ justifySelf: 'start' }}>
            <Link
              to={scheduleDispatchHref}
              onClick={() => modal.close()}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.8125rem',
                border: '1px solid #2563eb',
                borderRadius: 4,
                background: '#eff6ff',
                color: '#1d4ed8',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              Dispatch
            </Link>
          </div>
          <div style={{ justifySelf: 'center' }}>
            {canEditSchedule ? (
              <button
                type="button"
                onClick={openScheduleAddFromModal}
                title={`Add job to schedule for ${payload.displayName}`}
                aria-label={`Add schedule block for ${payload.displayName} on this day`}
                style={{
                  width: QUICKFILL_SCHEDULE_ADD_COL_WIDTH,
                  height: QUICKFILL_SCHEDULE_ADD_COL_WIDTH,
                  flexShrink: 0,
                  padding: 0,
                  margin: 0,
                  border: 'none',
                  borderRadius: 6,
                  background: '#f3f4f6',
                  color: '#9ca3af',
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  lineHeight: 1,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                +
              </button>
            ) : null}
          </div>
          <div style={{ justifySelf: 'end' }}>
            <button
              type="button"
              onClick={() => modal.close()}
              style={{
                padding: '0.35rem 0.6rem',
                fontSize: '0.875rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: '#fff',
                cursor: 'pointer',
                color: '#374151',
              }}
              aria-label="Close"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <ScheduleDispatchAssignJobPickerModal
        open={assignJobPickerOpen}
        onClose={closeJobPicker}
        subtitle={quickfillAssignJobPickerSubtitle}
        jobRows={quickfillAssignJobPickerRows}
        searchValue={assignJobPickerSearch}
        onSearchChange={setAssignJobPickerSearch}
        onPickJob={(jobId) => {
          if (!cellAddContext) return
          openAddBlock({
            assigneeUserId: cellAddContext.assigneeUserId,
            workDate: cellAddContext.workDate,
            jobId,
          })
        }}
      />
      <ScheduleDispatchAddBlockModal
        open={blockModalState != null}
        mode="add"
        jobTitle={blockModalJobTitle}
        personLabel={blockModalPersonLabel}
        workDate={blockModalState?.workDate ?? ''}
        timeStart={addTimeStart}
        timeEnd={addTimeEnd}
        note={addNote}
        saving={addSaving}
        error={addError}
        onClose={closeAddBlock}
        onChangeStart={setAddTimeStart}
        onChangeEnd={setAddTimeEnd}
        onChangeNote={setAddNote}
        onSave={() => void saveBlockModal()}
        addTimeline={addBlockModalTimeline}
      />
      {scheduleMyTimeEditor ? (
        <DashboardMyTimeDayEditorModal
          dateStr={workDateYmd}
          sessions={[]}
          subjectUserId={scheduleMyTimeEditor.subjectUserId}
          subjectDisplayName={scheduleMyTimeEditor.subjectDisplayName}
          jobLabels={jobLabelsRecord}
          bidLabels={bidLabelsRecord}
          allowNcnsFromMyTime={showClockStripScopeToggle}
          showMarkNotComingIn={showStripSubjectMyTimeEditor}
          onMarkNotComingIn={showStripSubjectMyTimeEditor ? () => void handleMarkNotComingIn() : undefined}
          onClose={() => setScheduleMyTimeEditor(null)}
          onSaved={() => {
            void reload({ quiet: true })
            setScheduleMyTimeEditor(null)
          }}
          onLinkedSessionsUpdated={() => void reload({ quiet: true })}
        />
      ) : null}
    </div>
  )
}
