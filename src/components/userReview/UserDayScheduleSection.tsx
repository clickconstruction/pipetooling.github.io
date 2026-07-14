import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { usePersonDayScheduleData } from '../../hooks/usePersonDayScheduleData'
import { useIntervalNowMs } from '../../hooks/useIntervalNowMs'
import { saveNewScheduleBlockForPersonDay } from '../../lib/scheduleDispatchAddBlockSave'
import { CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES } from '../../lib/scheduleDispatchEditRoles'
import {
  defaultNewBlockRangeInFirstGap,
  type AddBlockTimelineSegment,
} from '../../lib/scheduleDispatchAddBlockTimeline'
import { scheduleTimeToMinutesFromMidnight } from '../../lib/jobScheduleOverlap'
import { scheduleFormatWeekdayLong } from '../../lib/jobScheduleChicago'
import { blocksToSegments, segmentsToOccupiedBands } from '../../lib/quickfillScheduleSegments'
import { recordNotComingInForUserAsStaff } from '../../lib/notComingInTimeOff'
import { formatScheduleDispatchHubJobTitle } from '../../lib/scheduleDispatchHub'
import { clockSessionsToDispatchSecondaryBands } from '../../lib/clockSessionsToDispatchSecondaryBands'
import {
  dispatchMinutesToHHmm,
  timeInputToPg,
} from '../../lib/dispatchAddBlockTime'
import {
  applyRailWindowMinFloor,
  computeUserReviewSharedSlotWindow,
  USER_REVIEW_RAIL_MIN_FLOOR_SLOTS,
} from '../../lib/userReviewSharedSlotWindow'
import { ScheduleDispatchAddBlockModal } from '../schedule/ScheduleDispatchAddBlockModal'
import { ScheduleDispatchAssignJobPickerModal } from '../schedule/ScheduleDispatchAssignJobPickerModal'
import {
  QuickfillScheduleOrientationLabelsRow,
  QuickfillScheduleUserRow,
  QUICKFILL_SCHEDULE_ADD_COL_WIDTH,
} from '../schedule/QuickfillScheduleUserRow'
import { DashboardMyTimeDayEditorModal } from '../DashboardMyTimeDayEditorModal'
import { ScheduleBlockPreviewModal } from './ScheduleBlockPreviewModal'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import {
  APP_CALENDAR_TZ,
  companyWeekStartSundayContaining,
  denverCalendarDayKey,
  formatDenverWeekday,
  getDefaultWeekRange,
  referenceDateForWorkDateYmd,
  ymdAddDays,
} from '../../utils/dateUtils'

const chevronStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 28,
  minHeight: 24,
  padding: 0,
  fontSize: '0.75rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: 'var(--surface)',
  color: 'var(--text-700)',
  cursor: 'pointer',
  boxSizing: 'border-box',
  flexShrink: 0,
}

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
      <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{dayLabel}</span>
      <label
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'pointer',
          color: 'var(--text-700)',
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

export type UserDayScheduleSectionProps = {
  userId: string
  displayName: string
  workDateYmd: string
  onWorkDateYmdChange: (ymd: string) => void
  onClose: () => void
  titleId: string
  /** Optional content rendered between the schedule strip and the footer. */
  belowScheduleSlot?: ReactNode
  /** When provided, overrides the default header title node (e.g. for Day/Week toggle in v2). */
  headerExtras?: ReactNode
  /**
   * When provided, the name `<h2>` opens the User Review switch-user
   * modal instead of the per-user MyTime editor. MyTime is still
   * reachable one click deeper via the clock strip's session bands.
   */
  onOpenSwitchUser?: () => void
  /** When true, the name button advertises the switcher affordance (caret + aria copy). */
  canSwitchUser?: boolean
}

export function UserDayScheduleSection({
  userId,
  displayName,
  workDateYmd,
  onWorkDateYmdChange,
  onClose,
  titleId,
  belowScheduleSlot,
  headerExtras,
  onOpenSwitchUser,
  canSwitchUser,
}: UserDayScheduleSectionProps) {
  const { user: authUser, role } = useAuth()
  const { showToast } = useToastContext()
  const nowMs = useIntervalNowMs(45_000)

  const onDataError = useCallback(
    (message: string, variant: 'error' | 'warning') => {
      showToast(message, variant)
    },
    [showToast],
  )

  const { loading, blocks, sessions, jobTitleById, bidTitleById, hubJobsForPicker, reload } =
    usePersonDayScheduleData(userId, workDateYmd, onDataError)

  const canEditSchedule = role != null && CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES.has(role)
  const showClockStripScopeToggle =
    role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  const showStripSubjectMyTimeEditor = showClockStripScopeToggle || role === 'superintendent'

  const [scheduleMyTimeEditor, setScheduleMyTimeEditor] = useState<{
    subjectUserId: string
    subjectDisplayName: string
  } | null>(null)
  const [blockPreview, setBlockPreview] = useState<JobScheduleBlockRow | null>(null)
  const [cellAddContext, setCellAddContext] = useState<{
    assigneeUserId: string
    workDate: string
  } | null>(null)
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

  const sharedRailWindow = useMemo(() => {
    const occupied = segmentsToOccupiedBands(segments)
    const raw = computeUserReviewSharedSlotWindow([
      {
        occupiedStartHiSlots: occupied.map((s) => ({
          startSlotIndex: s.startSlotIndex,
          endSlotIndex: s.endSlotIndex,
        })),
        secondaryStartHiSlots: secondaryBands.map((b) => ({
          startSlotIndex: b.startSlotIndex,
          endSlotIndex: b.endSlotIndex,
        })),
      },
    ])
    return applyRailWindowMinFloor(raw, USER_REVIEW_RAIL_MIN_FLOOR_SLOTS)
  }, [segments, secondaryBands])

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
    setCellAddContext({ assigneeUserId: userId, workDate: workDateYmd })
    setAssignJobPickerSearch('')
    setAssignJobPickerOpen(true)
  }, [userId, workDateYmd])

  const openAddBlock = useCallback(
    (args: { assigneeUserId: string; workDate: string; jobId: string }) => {
      setAssignJobPickerOpen(false)
      setCellAddContext(null)
      setAssignJobPickerSearch('')
      setBlockModalState({
        kind: 'add',
        assigneeUserId: args.assigneeUserId,
        workDate: args.workDate,
        jobId: args.jobId,
      })
      const rows = blocks
      const labelFor = (jid: string) =>
        jobTitleById.get(jid) ?? formatScheduleDispatchHubJobTitle(null, null)
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
    return `${displayName} · ${scheduleFormatWeekdayLong(cellAddContext.workDate)} (${
      cellAddContext.workDate
    })`
  }, [cellAddContext, displayName])

  const quickfillAssignJobPickerSubtitle = useMemo((): ReactNode => {
    if (!cellAddContext) return null
    return (
      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-600)' }}>
        Pick a job to add a block for <strong>{quickfillCellChoiceSubtitle}</strong>.
      </p>
    )
  }, [cellAddContext, quickfillCellChoiceSubtitle])

  const blockModalPersonLabel = displayName
  const blockModalJobTitle = useMemo(
    () =>
      blockModalState != null
        ? jobTitleById.get(blockModalState.jobId) ?? formatScheduleDispatchHubJobTitle(null, null)
        : '',
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

  const openBlockPreview = useCallback(
    (blockId: string) => {
      const b = blocks.find((x) => x.id === blockId)
      if (b) setBlockPreview(b)
    },
    [blocks],
  )

  const blockPreviewJobTitle = useMemo(() => {
    if (!blockPreview) return ''
    const fromMap = jobTitleById.get(blockPreview.job_id)?.trim()
    return fromMap && fromMap.length > 0 ? fromMap : formatScheduleDispatchHubJobTitle(null, null)
  }, [blockPreview, jobTitleById])

  const jobLabelsRecord = useMemo(() => Object.fromEntries(jobTitleById), [jobTitleById])
  const bidLabelsRecord = useMemo(() => Object.fromEntries(bidTitleById), [bidTitleById])

  useEffect(() => {
    setAssignJobPickerOpen(false)
    setCellAddContext(null)
    setAssignJobPickerSearch('')
    closeAddBlock()
  }, [workDateYmd, closeAddBlock])

  const showTodayInHeader = workDateYmd !== denverCalendarDayKey(Date.now())
  const userDayHeaderTitle = (
    <h2
      id={titleId}
      style={{
        margin: 0,
        fontSize: '1.05rem',
        fontWeight: 600,
        color: 'var(--text-strong)',
        minWidth: 0,
        width: '100%',
        overflow: 'hidden',
      }}
    >
      {onOpenSwitchUser || showStripSubjectMyTimeEditor ? (
        <button
          type="button"
          onClick={
            onOpenSwitchUser
              ? () => onOpenSwitchUser()
              : () => openMyTimeForSessionStrip(userId, displayName)
          }
          title={
            onOpenSwitchUser
              ? `Switch user from ${displayName}`
              : `Time and attendance for ${displayName} (${workDateYmd})`
          }
          aria-label={
            onOpenSwitchUser
              ? `Switch user from ${displayName}`
              : `Time and attendance for ${displayName} on ${workDateYmd}`
          }
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
          {displayName}
          {canSwitchUser ? (
            <span aria-hidden style={{ marginLeft: '0.35rem', color: 'var(--text-faint)', fontWeight: 400 }}>
              ▾
            </span>
          ) : null}
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
          {displayName}
        </span>
      )}
    </h2>
  )
  const userDayHeaderToday = showTodayInHeader ? (
    <button
      type="button"
      onClick={() => onWorkDateYmdChange(denverCalendarDayKey(Date.now()))}
      style={{
        flexShrink: 0,
        padding: '0.25rem 0.5rem',
        fontSize: '0.8125rem',
        border: '1px solid #2563eb',
        borderRadius: 4,
        background: 'var(--bg-blue-tint)',
        color: 'var(--text-blue-700)',
        cursor: 'pointer',
      }}
    >
      Today
    </button>
  ) : null

  const dateNavProps = {
    workDateYmd,
    onWorkDateYmdChange,
    dayLabel,
    dateMdYDisplay,
  } as const

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.35rem 0.75rem',
          }}
        >
          <div style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden' }}>
            {userDayHeaderTitle}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.875rem',
            }}
          >
            <button
              type="button"
              onClick={() => onWorkDateYmdChange(ymdAddDays(workDateYmd, -1))}
              title="Previous day"
              aria-label="Previous day"
              style={chevronStyle}
            >
              <ChevronLeft size={14} strokeWidth={2.25} aria-hidden />
            </button>
            <UserDayScheduleDateNav {...dateNavProps} />
            <button
              type="button"
              onClick={() => onWorkDateYmdChange(ymdAddDays(workDateYmd, 1))}
              title="Next day"
              aria-label="Next day"
              style={chevronStyle}
            >
              <ChevronRight size={14} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {headerExtras}
            {userDayHeaderToday}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '0.75rem 1rem 1rem',
          overflow: 'auto',
          flex: 1,
          minHeight: 0,
        }}
      >
        <QuickfillScheduleOrientationLabelsRow
          showNameColumn={false}
          railTrimWindow={sharedRailWindow}
        />

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
        ) : (
          <QuickfillScheduleUserRow
            userId={userId}
            displayName={displayName}
            scheduleDayYmd={workDateYmd}
            segments={segments}
            secondaryBands={secondaryBands}
            showNameColumn={false}
            onOpenMyTimeForSessionStrip={
              showStripSubjectMyTimeEditor ? openMyTimeForSessionStrip : undefined
            }
            onOccupiedBandClick={(band) => openBlockPreview(band.blockId)}
            railTrimWindow={sharedRailWindow}
          />
        )}

        {belowScheduleSlot}
      </div>

      <div
        style={{
          flexShrink: 0,
          borderTop: '1px solid var(--border)',
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
            onClick={() => onClose()}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.8125rem',
              border: '1px solid #2563eb',
              borderRadius: 4,
              background: 'var(--bg-blue-tint)',
              color: 'var(--text-blue-700)',
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
              title={`Add job to schedule for ${displayName}`}
              aria-label={`Add schedule block for ${displayName} on this day`}
              style={{
                width: QUICKFILL_SCHEDULE_ADD_COL_WIDTH,
                height: QUICKFILL_SCHEDULE_ADD_COL_WIDTH,
                flexShrink: 0,
                padding: 0,
                margin: 0,
                border: 'none',
                borderRadius: 6,
                background: 'var(--bg-muted)',
                color: 'var(--text-faint)',
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
            onClick={() => onClose()}
            style={{
              padding: '0.35rem 0.6rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: 'var(--surface)',
              cursor: 'pointer',
              color: 'var(--text-700)',
            }}
            aria-label="Close"
          >
            Close
          </button>
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
      <ScheduleBlockPreviewModal
        open={blockPreview != null}
        block={blockPreview}
        jobTitle={blockPreviewJobTitle}
        onClose={() => setBlockPreview(null)}
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
    </>
  )
}
