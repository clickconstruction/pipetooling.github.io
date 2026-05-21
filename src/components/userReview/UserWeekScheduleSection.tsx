import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useIntervalNowMs } from '../../hooks/useIntervalNowMs'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { usePersonWeekScheduleData } from '../../hooks/usePersonWeekScheduleData'
import { QuickfillScheduleOrientationLabelsRow } from '../schedule/QuickfillScheduleUserRow'
import { UserScheduleDayRow } from './UserScheduleDayRow'
import { ScheduleBlockPreviewModal } from './ScheduleBlockPreviewModal'
import { DashboardMyTimeDayEditorModal } from '../DashboardMyTimeDayEditorModal'
import { recordNotComingInForUserAsStaff } from '../../lib/notComingInTimeOff'
import { formatScheduleDispatchHubJobTitle } from '../../lib/scheduleDispatchHub'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { formatRangeCompact } from '../../lib/userReviewRangeLabel'
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
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: '#fff',
  color: '#374151',
  cursor: 'pointer',
  boxSizing: 'border-box',
  flexShrink: 0,
}

export type UserWeekScheduleSectionProps = {
  userId: string
  displayName: string
  /** Anchor week-start (Sunday) YYYY-MM-DD. */
  weekStartYmd: string
  onWeekStartYmdChange: (ymd: string) => void
  onClose: () => void
  titleId: string
  belowScheduleSlot?: ReactNode
  headerExtras?: ReactNode
}

export function UserWeekScheduleSection({
  userId,
  displayName,
  weekStartYmd,
  onWeekStartYmdChange,
  onClose,
  titleId,
  belowScheduleSlot,
  headerExtras,
}: UserWeekScheduleSectionProps) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const nowMs = useIntervalNowMs(45_000)
  const narrow = useNarrowViewport640()

  const showClockStripScopeToggle =
    role === 'dev' || role === 'master_technician' || role === 'assistant'
  const showStripSubjectMyTimeEditor =
    showClockStripScopeToggle || role === 'superintendent'

  const onDataError = useCallback(
    (message: string, variant: 'error' | 'warning') => {
      showToast(message, variant)
    },
    [showToast],
  )

  const { loading, daysYmd, blocksByDayYmd, sessionsByDayYmd, jobTitleById, bidTitleById, reload } =
    usePersonWeekScheduleData(userId, weekStartYmd, onDataError)

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

  const weekEndYmd = useMemo(
    () => (daysYmd.length > 0 ? daysYmd[daysYmd.length - 1]! : weekStartYmd),
    [daysYmd, weekStartYmd],
  )

  const weekRangeLabelCompact = useMemo(
    () => formatRangeCompact(weekStartYmd, weekEndYmd),
    [weekStartYmd, weekEndYmd],
  )

  const scheduleDispatchHref = useMemo(() => {
    const weekStart = companyWeekStartSundayContaining(weekStartYmd) ?? getDefaultWeekRange().start
    return `/schedule-dispatch?week=${encodeURIComponent(weekStart)}`
  }, [weekStartYmd])

  const todayYmd = denverCalendarDayKey(Date.now())
  const currentWeekStart =
    companyWeekStartSundayContaining(todayYmd) ?? getDefaultWeekRange().start
  const showThisWeekButton = weekStartYmd !== currentWeekStart

  const titleNode = (
    <h2
      id={titleId}
      style={{
        margin: 0,
        fontSize: '1.05rem',
        fontWeight: 600,
        color: '#111827',
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {displayName}
    </h2>
  )

  const thisWeekButton = showThisWeekButton ? (
    <button
      type="button"
      onClick={() => onWeekStartYmdChange(currentWeekStart)}
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
      This week
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
          borderBottom: '1px solid #e5e7eb',
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
              onClick={() => onWeekStartYmdChange(ymdAddDays(weekStartYmd, -7))}
              title="Previous week"
              aria-label="Previous week"
              style={chevronStyle}
            >
              <ChevronLeft size={14} strokeWidth={2.25} aria-hidden />
            </button>
            <span style={{ fontSize: '0.875rem', color: '#374151', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 600 }}>Week of</span>{' '}
              <span
                style={{ color: '#111827', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
              >
                {weekRangeLabelCompact}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onWeekStartYmdChange(ymdAddDays(weekStartYmd, 7))}
              title="Next week"
              aria-label="Next week"
              style={chevronStyle}
            >
              <ChevronRight size={14} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {headerExtras}
            {thisWeekButton}
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
        <QuickfillScheduleOrientationLabelsRow showNameColumn={!narrow} marginBottom="0.4rem" />

        {loading ? (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading…</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            {daysYmd.map((dayYmd) => (
              <UserScheduleDayRow
                key={dayYmd}
                userId={userId}
                displayName={displayName}
                dayYmd={dayYmd}
                blocks={blocksByDayYmd.get(dayYmd) ?? []}
                sessions={sessionsByDayYmd.get(dayYmd) ?? []}
                jobTitleById={jobTitleById}
                bidTitleById={bidTitleById}
                nowMs={nowMs}
                showOpenMyTime={showStripSubjectMyTimeEditor}
                onOccupiedBandClick={(band) => openBlockPreviewForDay(dayYmd, band.blockId)}
                narrow={narrow}
                onOpenMyTimeForSessionStrip={openMyTimeForDay}
              />
            ))}
          </div>
        )}

        {belowScheduleSlot}
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
            onClick={() => onClose()}
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
        <div style={{ justifySelf: 'center', color: '#9ca3af', fontSize: '0.75rem' }}>
          {/* Week mode reserves no "+ Add block" button — staff add per-day from Dispatch. */}
        </div>
        <div style={{ justifySelf: 'end' }}>
          <button
            type="button"
            onClick={() => onClose()}
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

