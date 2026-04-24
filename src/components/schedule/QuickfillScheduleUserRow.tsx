import { memo, useMemo } from 'react'
import {
  DISPATCH_ADD_BLOCK_SLOT_COUNT,
  dispatchMinutesToHHmm,
  dispatchMinutesToSlotIndex,
  dispatchSlotIndexToMinutes,
  formatDispatchQuickTimeLabel,
  timeInputToMinutesSafe,
} from '../../lib/dispatchAddBlockTime'
import {
  DispatchAddBlockTimeRange,
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
        padding: '0.45rem 0',
        borderBottom: '1px solid #f3f4f6',
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
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
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
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName}
            </button>
          ) : (
            displayName
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
