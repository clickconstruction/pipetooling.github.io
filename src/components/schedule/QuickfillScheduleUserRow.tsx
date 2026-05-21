import { memo, useMemo, type CSSProperties, type ReactNode } from 'react'
import {
  DISPATCH_ADD_BLOCK_SLOT_COUNT,
  dispatchMinutesToHHmm,
  dispatchMinutesToSlotIndex,
  dispatchSlotIndexToMinutes,
  formatDispatchQuickTimeLabel,
  timeInputToMinutesSafe,
} from '../../lib/dispatchAddBlockTime'
import {
  DISPATCH_ADD_BLOCK_ORIENTATION_MARKS,
  DispatchAddBlockTimeRange,
  dispatchAddBlockTrackThumbLeftPct,
  type DispatchOccupiedBand,
  type DispatchSecondaryBand,
} from './DispatchAddBlockTimeRange'
import {
  defaultNewBlockRangeInFirstGap,
  type AddBlockTimelineSegment,
} from '../../lib/scheduleDispatchAddBlockTimeline'
import { segmentsToOccupiedBands } from '../../lib/quickfillScheduleSegments'

/** Matches per-row name column so shared 8 AM / 12 PM / 4 PM labels align with each timeline. */
export const QUICKFILL_SCHEDULE_NAME_COL_WIDTH = 'clamp(5.5rem, 24vw, 8.5rem)'
export const QUICKFILL_SCHEDULE_ADD_COL_WIDTH = '2rem'
export const QUICKFILL_SCHEDULE_ROW_GAP = '0.5rem'

const noopSlot = () => {}

/**
 * Renders the shared "8 AM / 12 PM / 4 PM" orientation labels above one or more
 * `QuickfillScheduleUserRow` strips, using the same flex layout (leading name
 * column spacer and optional trailing add-column spacer) so the labels line up
 * with the slider track underneath.
 */
export function QuickfillScheduleOrientationLabelsRow({
  showNameColumn,
  showAddColumn = false,
  marginBottom = '0.15rem',
}: {
  /** Mirrors the strip's `showNameColumn`. When true, inserts a leading spacer. */
  showNameColumn: boolean
  /** Mirrors the presence of `onScheduleAddClick`. When true, inserts a trailing spacer. */
  showAddColumn?: boolean
  marginBottom?: CSSProperties['marginBottom']
}) {
  return (
    <div
      aria-hidden
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: QUICKFILL_SCHEDULE_ROW_GAP,
        width: '100%',
        marginBottom,
        pointerEvents: 'none',
      }}
    >
      {showNameColumn ? (
        <div style={{ width: QUICKFILL_SCHEDULE_NAME_COL_WIDTH, flexShrink: 0 }} />
      ) : null}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minWidth: 0,
          height: 12,
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
      {showAddColumn ? (
        <div style={{ width: QUICKFILL_SCHEDULE_ADD_COL_WIDTH, flexShrink: 0 }} />
      ) : null}
    </div>
  )
}

export const QuickfillScheduleUserRow = memo(function QuickfillScheduleUserRow({
  userId,
  displayName,
  scheduleDayYmd,
  segments,
  secondaryBands,
  onScheduleAddClick,
  onOpenMyTimeForSessionStrip,
  onOpenPersonMyTime,
  onOccupiedBandClick,
  showNameColumn = true,
  nameColumnLabel,
  nameColumnSubline,
  compactRow = false,
}: {
  userId: string
  displayName: string
  /** Calendar day for this row (YYYY-MM-DD); used for name-button accessibility when opening My Time. */
  scheduleDayYmd: string
  segments: AddBlockTimelineSegment[]
  secondaryBands?: DispatchSecondaryBand[]
  onScheduleAddClick?: () => void
  onOpenMyTimeForSessionStrip?: (uid: string, name: string) => void
  /** Opens My Time day editor (NCNS / Not coming in) from the person name — same handler as strip when provided. */
  onOpenPersonMyTime?: (uid: string, name: string) => void
  onOccupiedBandClick?: (band: DispatchOccupiedBand) => void
  /** When false, only the track (+ optional add column) is shown; use when the name is shown elsewhere (e.g. modal title). */
  showNameColumn?: boolean
  /** Visible text override for the leading name column. Defaults to `displayName`.
      The underlying My-Time button, title, aria-label, and groupAriaLabel still use displayName. */
  nameColumnLabel?: string
  /** Optional softer subline rendered below `nameColumnLabel` in the leading name column.
      Used by the User Review modal's Week/Month day rows to surface a relative-day phrase
      like "(3 days ago)" under "Sat · 05/16". When the name column is rendered as a button,
      the subline sits inside the same button so the entire chip remains one click target. */
  nameColumnSubline?: ReactNode
  /** When true, the row uses tighter vertical padding (0.15rem 0) and drops the
      bottom hairline. Used by surfaces that already provide their own separation
      (e.g. the User Review modal's week-mode day list, which uses grid gap). */
  compactRow?: boolean
}) {
  const occupiedBands = useMemo(() => segmentsToOccupiedBands(segments), [segments])

  const { startSlotIndex, endSlotIndex } = useMemo(() => {
    const def = defaultNewBlockRangeInFirstGap({ segments, draftByBlockId: {} })
    if (def) {
      return {
        startSlotIndex: dispatchMinutesToSlotIndex(def.startMin),
        endSlotIndex: dispatchMinutesToSlotIndex(def.endMin),
      }
    }
    return {
      startSlotIndex: dispatchMinutesToSlotIndex(timeInputToMinutesSafe('08:00')),
      endSlotIndex: dispatchMinutesToSlotIndex(timeInputToMinutesSafe('16:00')),
    }
  }, [segments])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: QUICKFILL_SCHEDULE_ROW_GAP,
        padding: compactRow ? '0.15rem 0' : '0.45rem 0',
        borderBottom: compactRow ? 'none' : '1px solid #f3f4f6',
      }}
    >
      {showNameColumn ? (
        <div
          style={{
            width: QUICKFILL_SCHEDULE_NAME_COL_WIDTH,
            flexShrink: 0,
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#111827',
            whiteSpace: 'normal',
            overflow: 'hidden',
            lineHeight: 1.2,
            padding: '0.15rem 0.25rem',
          }}
        >
          {onOpenPersonMyTime ? (
            <button
              type="button"
              onClick={() => onOpenPersonMyTime(userId, displayName)}
              title={`Time and attendance for ${displayName} (${scheduleDayYmd})`}
              aria-label={`Time and attendance for ${displayName} on ${scheduleDayYmd}`}
              style={{
                display: 'block',
                width: '100%',
                margin: 0,
                padding: 0,
                border: 'none',
                background: 'none',
                font: 'inherit',
                fontWeight: 600,
                color: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
                overflow: 'hidden',
                whiteSpace: 'normal',
              }}
            >
              {nameColumnLabel ?? displayName}
              {nameColumnSubline}
            </button>
          ) : (
            <>
              {nameColumnLabel ?? displayName}
              {nameColumnSubline}
            </>
          )}
        </div>
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <DispatchAddBlockTimeRange
          compact
          showOrientationLabels={false}
          showProposedRange={false}
          slotCount={DISPATCH_ADD_BLOCK_SLOT_COUNT}
          startSlotIndex={startSlotIndex}
          endSlotIndex={endSlotIndex}
          onStartChange={noopSlot}
          onEndChange={noopSlot}
          formatAriaValue={(i) =>
            formatDispatchQuickTimeLabel(dispatchMinutesToHHmm(dispatchSlotIndexToMinutes(i)))
          }
          disabled
          groupAriaLabel={`${displayName}: scheduled blocks preview (read-only), 30-minute steps from 4:00 AM to 8:00 PM Central${
            secondaryBands?.length
              ? ` Includes ${secondaryBands.length} clock session${secondaryBands.length === 1 ? '' : 's'}.`
              : ''
          }`}
          occupiedBands={occupiedBands.length > 0 ? occupiedBands : undefined}
          secondaryBands={secondaryBands}
          onSecondaryBandClick={
            onOpenMyTimeForSessionStrip && (secondaryBands?.length ?? 0) > 0
              ? () => onOpenMyTimeForSessionStrip(userId, displayName)
              : undefined
          }
          onOccupiedBandClick={onOccupiedBandClick}
        />
      </div>
      {onScheduleAddClick ? (
        <button
          type="button"
          onClick={onScheduleAddClick}
          title={`Add job to schedule for ${displayName}`}
          aria-label={`Add schedule block for ${displayName} on this day`}
          style={{
            width: QUICKFILL_SCHEDULE_ADD_COL_WIDTH,
            flexShrink: 0,
            height: QUICKFILL_SCHEDULE_ADD_COL_WIDTH,
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
  )
})
