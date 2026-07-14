import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useIntervalNowMs } from '../../hooks/useIntervalNowMs'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import {
  PERSON_MONTH_SCHEDULE_WINDOW_DAYS,
  usePersonMonthScheduleData,
} from '../../hooks/usePersonMonthScheduleData'
import { QuickfillScheduleOrientationLabelsRow } from '../schedule/QuickfillScheduleUserRow'
import { UserScheduleDayRow, UserScheduleEmptyDayRow } from './UserScheduleDayRow'
import {
  applyRailWindowMinFloor,
  computeUserReviewSharedSlotWindow,
  USER_REVIEW_RAIL_MIN_FLOOR_SLOTS,
  type SharedSlotWindowRowInput,
} from '../../lib/userReviewSharedSlotWindow'
import { blocksToSegments, segmentsToOccupiedBands } from '../../lib/quickfillScheduleSegments'
import { clockSessionsToDispatchSecondaryBands } from '../../lib/clockSessionsToDispatchSecondaryBands'
import { ScheduleBlockPreviewModal } from './ScheduleBlockPreviewModal'
import { DashboardMyTimeDayEditorModal } from '../DashboardMyTimeDayEditorModal'
import { recordNotComingInForUserAsStaff } from '../../lib/notComingInTimeOff'
import { formatScheduleDispatchHubJobTitle } from '../../lib/scheduleDispatchHub'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { formatRangeCompact } from '../../lib/userReviewRangeLabel'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import {
  companyWeekStartSundayContaining,
  denverCalendarDayKey,
  getDefaultWeekRange,
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

export type UserMonthScheduleSectionProps = {
  userId: string
  displayName: string
  /** Anchor day (inclusive end of the rolling window) YYYY-MM-DD. */
  anchorYmd: string
  onAnchorYmdChange: (ymd: string) => void
  onClose: () => void
  titleId: string
  belowScheduleSlot?: ReactNode
  headerExtras?: ReactNode
  /** See `UserWeekScheduleSection` — wires the title button to the switch-user modal. */
  onOpenSwitchUser?: () => void
  canSwitchUser?: boolean
}

export function UserMonthScheduleSection({
  userId,
  displayName,
  anchorYmd,
  onAnchorYmdChange,
  onClose,
  titleId,
  belowScheduleSlot,
  headerExtras,
  onOpenSwitchUser,
  canSwitchUser,
}: UserMonthScheduleSectionProps) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const nowMs = useIntervalNowMs(45_000)
  const narrow = useNarrowViewport640()

  const showClockStripScopeToggle =
    role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  const showStripSubjectMyTimeEditor =
    showClockStripScopeToggle || role === 'superintendent'

  const onDataError = useCallback(
    (message: string, variant: 'error' | 'warning') => {
      showToast(message, variant)
    },
    [showToast],
  )

  const { loading, daysYmd, blocksByDayYmd, sessionsByDayYmd, jobTitleById, bidTitleById, reload } =
    usePersonMonthScheduleData(userId, anchorYmd, onDataError)

  const [blockPreview, setBlockPreview] = useState<JobScheduleBlockRow | null>(null)
  const [scheduleMyTimeEditor, setScheduleMyTimeEditor] = useState<{
    subjectUserId: string
    subjectDisplayName: string
    dayYmd: string
  } | null>(null)

  const openBlockPreviewForDay = useCallback(
    (dayYmd: string, blockId: string) => {
      const list = blocksByDayYmd.get(dayYmd) ?? []
      const b = list.find((x) => x.id === blockId)
      if (b) setBlockPreview(b)
    },
    [blocksByDayYmd],
  )

  const openMyTimeForDay = useCallback(
    (uid: string, name: string, dayYmd: string) => {
      setScheduleMyTimeEditor({ subjectUserId: uid, subjectDisplayName: name, dayYmd })
    },
    [],
  )

  const blockPreviewJobTitle = useMemo(() => {
    if (!blockPreview) return ''
    const fromMap = jobTitleById.get(blockPreview.job_id)?.trim()
    return fromMap && fromMap.length > 0 ? fromMap : formatScheduleDispatchHubJobTitle(null, null)
  }, [blockPreview, jobTitleById])

  const jobLabelsRecord = useMemo(() => Object.fromEntries(jobTitleById), [jobTitleById])
  const bidLabelsRecord = useMemo(() => Object.fromEntries(bidTitleById), [bidTitleById])

  const sharedRailWindow = useMemo(() => {
    const jobMap = new Map(jobTitleById)
    const bidMap = new Map(bidTitleById)
    const rows: SharedSlotWindowRowInput[] = daysYmd.map((d) => {
      const blocks = blocksByDayYmd.get(d) ?? []
      const sessions = sessionsByDayYmd.get(d) ?? []
      const occ = segmentsToOccupiedBands(blocksToSegments(blocks, jobMap))
      const sec = clockSessionsToDispatchSecondaryBands(sessions, d, nowMs, jobMap, bidMap)
      return {
        occupiedStartHiSlots: occ.map((s) => ({
          startSlotIndex: s.startSlotIndex,
          endSlotIndex: s.endSlotIndex,
        })),
        secondaryStartHiSlots: sec.map((b) => ({
          startSlotIndex: b.startSlotIndex,
          endSlotIndex: b.endSlotIndex,
        })),
      }
    })
    const raw = computeUserReviewSharedSlotWindow(rows)
    return applyRailWindowMinFloor(raw, USER_REVIEW_RAIL_MIN_FLOOR_SLOTS)
  }, [daysYmd, blocksByDayYmd, sessionsByDayYmd, jobTitleById, bidTitleById, nowMs])

  const handleMarkNotComingIn = useCallback(async () => {
    const editor = scheduleMyTimeEditor
    if (!editor) return
    const result = await recordNotComingInForUserAsStaff({
      subjectUserId: editor.subjectUserId,
      workDateYmd: editor.dayYmd,
    })
    if (result.ok && result.alreadyMarked) {
      showToast(
        `${editor.subjectDisplayName} already has unpaid time off on ${editor.dayYmd}.`,
        'warning',
      )
      return
    }
    if (!result.ok) {
      showToast(result.message, 'error')
      return
    }
    showToast(
      `Marked ${editor.subjectDisplayName} as not coming in (${editor.dayYmd}).`,
      'success',
    )
    if (result.syncWarning) {
      showToast(`Salary sync: ${result.syncWarning}`, 'warning')
    }
    void reload({ quiet: true })
  }, [scheduleMyTimeEditor, showToast, reload])

  const monthStartYmd = useMemo(
    () => (daysYmd.length > 0 ? daysYmd[0]! : anchorYmd),
    [daysYmd, anchorYmd],
  )
  const monthEndYmd = anchorYmd

  const rangeLabelCompact = useMemo(
    () => formatRangeCompact(monthStartYmd, monthEndYmd),
    [monthStartYmd, monthEndYmd],
  )

  const scheduleDispatchHref = useMemo(() => {
    const weekStart = companyWeekStartSundayContaining(anchorYmd) ?? getDefaultWeekRange().start
    return `/schedule-dispatch?week=${encodeURIComponent(weekStart)}`
  }, [anchorYmd])

  const todayYmd = denverCalendarDayKey(Date.now())
  const showLast30Button = anchorYmd !== todayYmd

  const titleNode = (
    <h2
      id={titleId}
      style={{
        margin: 0,
        fontSize: '1.05rem',
        fontWeight: 600,
        color: 'var(--text-strong)',
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {onOpenSwitchUser ? (
        <button
          type="button"
          onClick={() => onOpenSwitchUser()}
          title={`Switch user from ${displayName}`}
          aria-label={`Switch user from ${displayName}`}
          style={{
            display: 'inline',
            margin: 0,
            padding: 0,
            border: 'none',
            background: 'none',
            font: 'inherit',
            color: 'inherit',
            textAlign: 'left',
            cursor: 'pointer',
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
        displayName
      )}
    </h2>
  )

  const last30Button = showLast30Button ? (
    <button
      type="button"
      onClick={() => onAnchorYmdChange(todayYmd)}
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
      Last 30 days
    </button>
  ) : null

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
          <div style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden' }}>{titleNode}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button
              type="button"
              onClick={() =>
                onAnchorYmdChange(ymdAddDays(anchorYmd, -PERSON_MONTH_SCHEDULE_WINDOW_DAYS))
              }
              title="Previous 30 days"
              aria-label="Previous 30 days"
              style={chevronStyle}
            >
              <ChevronLeft size={14} strokeWidth={2.25} aria-hidden />
            </button>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-700)', whiteSpace: 'nowrap' }}>
              <span
                style={{ color: 'var(--text-strong)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
              >
                {rangeLabelCompact}
              </span>
            </span>
            <button
              type="button"
              onClick={() =>
                onAnchorYmdChange(ymdAddDays(anchorYmd, PERSON_MONTH_SCHEDULE_WINDOW_DAYS))
              }
              title="Next 30 days"
              aria-label="Next 30 days"
              style={chevronStyle}
            >
              <ChevronRight size={14} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {headerExtras}
            {last30Button}
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
          showNameColumn={!narrow}
          marginBottom="0.4rem"
          railTrimWindow={sharedRailWindow}
        />

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            {daysYmd.map((dayYmd) => {
              const blocks = blocksByDayYmd.get(dayYmd) ?? []
              const sessions = sessionsByDayYmd.get(dayYmd) ?? []
              if (blocks.length === 0 && sessions.length === 0) {
                return <UserScheduleEmptyDayRow key={dayYmd} dayYmd={dayYmd} />
              }
              return (
                <UserScheduleDayRow
                  key={dayYmd}
                  userId={userId}
                  displayName={displayName}
                  dayYmd={dayYmd}
                  blocks={blocks}
                  sessions={sessions}
                  jobTitleById={jobTitleById}
                  bidTitleById={bidTitleById}
                  nowMs={nowMs}
                  showOpenMyTime={showStripSubjectMyTimeEditor}
                  onOccupiedBandClick={(band) => openBlockPreviewForDay(dayYmd, band.blockId)}
                  onOpenBlockPreviewForBlock={(blockId) =>
                    openBlockPreviewForDay(dayYmd, blockId)
                  }
                  narrow={narrow}
                  onOpenMyTimeForSessionStrip={openMyTimeForDay}
                  railTrimWindow={sharedRailWindow}
                />
              )
            })}
          </div>
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
        <div style={{ justifySelf: 'center', color: 'var(--text-faint)', fontSize: '0.75rem' }}>
          {/* Month mode reserves no "+ Add block" button — staff add per-day from Dispatch. */}
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

      <ScheduleBlockPreviewModal
        open={blockPreview != null}
        block={blockPreview}
        jobTitle={blockPreviewJobTitle}
        onClose={() => setBlockPreview(null)}
      />
      {scheduleMyTimeEditor ? (
        <DashboardMyTimeDayEditorModal
          dateStr={scheduleMyTimeEditor.dayYmd}
          sessions={[]}
          subjectUserId={scheduleMyTimeEditor.subjectUserId}
          subjectDisplayName={scheduleMyTimeEditor.subjectDisplayName}
          jobLabels={jobLabelsRecord}
          bidLabels={bidLabelsRecord}
          allowNcnsFromMyTime={showClockStripScopeToggle}
          showMarkNotComingIn={showStripSubjectMyTimeEditor}
          onMarkNotComingIn={
            showStripSubjectMyTimeEditor ? () => void handleMarkNotComingIn() : undefined
          }
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
