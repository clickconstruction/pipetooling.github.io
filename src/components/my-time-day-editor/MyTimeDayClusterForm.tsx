import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  AssignSessionJobPopover,
  type AssignSessionJobPopoverSession,
  type AssignSessionJobSavedPatch,
} from '../clock-sessions/AssignSessionJobPopover'
import type { UnifiedSearchResult } from '../../utils/unifiedJobBidSearch'
import type { DispatchScheduledJobForAssign } from '../../lib/jobScheduleBlocks'
import {
  clockSessionRowForSegmentAssign,
  mergeAllocChoiceRequired,
  myTimeMergePersistBlockTitle,
  NO_JOB_BID_LINKED_LABEL,
  segmentAllocationLabelsForOverlap,
  unassignedSessionIdsOverlappingSegment,
} from '../../lib/myTimeDaySavePlan'
import {
  internalRowJoinMs,
  MIN_SEGMENT_MS,
  type DayEditorSession,
  type SplitEditorState,
  type SplitAction,
} from '../../lib/myTimeDayTimeline'
import {
  denverSameCalendarDay,
  formatDenverBlockDateHeader,
  formatDenverDateTimeShort,
  formatDenverBlockWeekdayHeader,
  formatDenverTimeOnly,
  formatDenverTimeRangeSameDay,
} from '../../utils/dateUtils'
import {
  anchorDateYmdFromClusterStart,
  msToDatetimeLocalValue,
  msToTimeLocalValue,
  parseDatetimeLocalToMs,
  parseTimeOnAnchorDateToMs,
} from './myTimeDayEditorDatetime'
import { ForceClockOutIcon } from '../icons/ForceClockOutIcon'
import { MyTimeSegmentMergeDirectionModal } from './MyTimeSegmentMergeDirectionModal'
import { useMyTimeCompactMergeMedia, useMyTimeFormStackMedia } from './useMyTimeCompactMergeMedia'

function formatDurationMs(ms: number): string {
  const h = ms / 3600000
  return h % 1 === 0 ? `${h.toFixed(1)} h` : `${h.toFixed(2)} h`
}

/** Two-column form rows: fixed label column, fluid controls (segment times). */
const FORM_ROW_GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '6.5rem minmax(0, 1fr)',
  columnGap: 8,
  rowGap: 6,
  alignItems: 'center',
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
}

const FORM_LABEL_CELL: CSSProperties = {
  fontSize: '0.68rem',
  fontWeight: 500,
  color: 'var(--text-muted)',
  textAlign: 'right',
  paddingRight: 6,
  lineHeight: 1.25,
}

/** Same typography as time-range text (right column meta, e.g. duration). */
const FORM_SPAN_VALUE_TEXT: CSSProperties = {
  color: 'var(--text-700)',
  fontVariantNumeric: 'tabular-nums',
  fontSize: '0.75rem',
  minWidth: 0,
}

const DATETIME_INPUT_STYLE: CSSProperties = {
  padding: '0.2rem 0.35rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  fontSize: '0.75rem',
}

export type MyTimeDayClusterFormProps = {
  clusterId: string
  c: DayEditorSession[]
  lastS: DayEditorSession
  split: SplitEditorState
  t0: number
  t1: number
  span: number
  flexW: number
  nowTick: number
  saving: boolean
  jobLabels: Record<string, string>
  bidLabels: Record<string, string>
  patchClusterAction: (action: SplitAction) => void
  onCommitInnerBoundary: (boundaryIndex: number, ms: number) => void
  setAssignBulk: (v: { sessionIds: string[]; label: string } | null) => void
  onAssignJobSaved: (patch?: AssignSessionJobSavedPatch) => void
  /** My Time: persist virtual splits before assign so each segment has its own clock_sessions row. */
  resolveAssignSession?: (segIdx: number) => Promise<AssignSessionJobPopoverSession | null>
  /** When set, distinct job/bid on merge opens parent modal instead of confirm-only. */
  onRequestMergeJobChoice?: (payload: { direction: 'prev' | 'next'; segIdx: number }) => void
  onForceClockOut?: (session: DayEditorSession) => void
  onAdjustTimes?: (session: DayEditorSession) => void
  /** Reject one DB row for this segment (`clockSessionRowForSegmentAssign`); parent sets rejected_at. */
  onRejectSession?: (session: DayEditorSession) => void | Promise<void>
  /** When set, segment reject buttons are disabled (single in-flight reject). */
  rejectSessionBusyId?: string | null
  /** Dashboard clock preview: no edits to times, notes, merge, or assign. */
  readOnlyView?: boolean
  /**
   * Dashboard `clockTimesReadOnly`: disable Form "Ends at" inputs only so boundaries are edited in Visual (blue handles), not via datetime fields.
   * Does not affect notes, merge, split, or assign (unlike `readOnlyView`).
   */
  segmentTimeInputsReadOnly?: boolean
  /** Dispatch schedule quick-picks in Assign popover (optional). */
  dispatchScheduleAssigneeUserId?: string
  dispatchScheduleWorkDateYmd?: string
  draftLocalJobBidAssign?: (
    target: AssignSessionJobPopoverSession,
    selection: UnifiedSearchResult | null,
  ) => void
  /** Day editor: show "Apply Schedule %" on the unassigned popover (day has no job-linked sessions). */
  showApplyScheduleProportions?: boolean
  onApplyScheduleProportions?: (picks: DispatchScheduledJobForAssign[]) => void
  /** Double gray rule under this card when the next timeline cluster overlaps in time (Form only). */
  overlapDividerBelow?: boolean
  /** False for the last cluster in the day timeline: no bottom separator under the final block. */
  showClusterBottomDivider?: boolean
}

export function MyTimeDayClusterForm({
  clusterId,
  c,
  lastS,
  split,
  t0,
  t1,
  span: _span,
  flexW,
  nowTick,
  saving,
  jobLabels,
  bidLabels,
  patchClusterAction,
  onCommitInnerBoundary,
  setAssignBulk,
  onAssignJobSaved,
  resolveAssignSession,
  onRequestMergeJobChoice,
  onForceClockOut,
  onAdjustTimes,
  onRejectSession,
  rejectSessionBusyId = null,
  readOnlyView = false,
  segmentTimeInputsReadOnly = false,
  dispatchScheduleAssigneeUserId,
  dispatchScheduleWorkDateYmd,
  draftLocalJobBidAssign,
  showApplyScheduleProportions = false,
  onApplyScheduleProportions,
  overlapDividerBelow = false,
  showClusterBottomDivider = true,
}: MyTimeDayClusterFormProps) {
  const timeOnlyMode = denverSameCalendarDay(t0, t1)
  const anchorYmd = anchorDateYmdFromClusterStart(t0)
  const compactMerge = useMyTimeCompactMergeMedia()
  const formStackLayout = useMyTimeFormStackMedia()
  const [mergeDirectionModalSegIdx, setMergeDirectionModalSegIdx] = useState<number | null>(null)

  useEffect(() => {
    if (saving) setMergeDirectionModalSegIdx(null)
  }, [saving])

  const mergeModalOpenLast = !lastS.clocked_out_at
  const mergeDirUpBlockedTitle =
    mergeDirectionModalSegIdx != null && mergeDirectionModalSegIdx > 0
      ? myTimeMergePersistBlockTitle(
          c,
          split,
          nowTick,
          mergeModalOpenLast,
          'prev',
          mergeDirectionModalSegIdx,
        )
      : undefined
  const mergeDirDownBlockedTitle =
    mergeDirectionModalSegIdx != null &&
    mergeDirectionModalSegIdx < split.boundaries.length - 2
      ? myTimeMergePersistBlockTitle(
          c,
          split,
          nowTick,
          mergeModalOpenLast,
          'next',
          mergeDirectionModalSegIdx,
        )
      : undefined

  const joinTargets = useMemo(() => internalRowJoinMs(c, nowTick), [c, nowTick])
  const blockDateAndTimeLine = `${formatDenverBlockDateHeader(t0, t1)} | ${formatDenverTimeOnly(t0)} – ${formatDenverTimeOnly(t1)}`

  const blockHeader = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, paddingTop: 2 }}>
      <span
        style={{
          fontSize: '0.68rem',
          fontWeight: 500,
          color: 'var(--text-muted)',
          lineHeight: 1.15,
          textAlign: 'left',
        }}
      >
        {formatDenverBlockWeekdayHeader(t0, t1)}
      </span>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          justifyContent: 'flex-start',
        }}
      >
        <span
          style={{
            fontSize: '0.65rem',
            color: 'var(--text-faint)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.15,
            textAlign: 'left',
            whiteSpace: 'normal',
          }}
        >
          {blockDateAndTimeLine}
        </span>
        {onForceClockOut && !readOnlyView && !lastS.clocked_out_at ? (
          <button
            type="button"
            disabled={saving}
            title="Force clock out and fix hours"
            aria-label="Force clock out and fix hours"
            onClick={() => onForceClockOut(lastS)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: 0,
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: saving ? 'not-allowed' : 'pointer',
              color: 'var(--text-muted)',
              lineHeight: 0,
              verticalAlign: 'middle',
            }}
          >
            <ForceClockOutIcon />
          </button>
        ) : null}
      </div>
    </div>
  )

  return (
    <Fragment>
    <div
      className="myTimeDaySessionRow myTimeDayClusterFormGrid"
      style={{
        flex: `${Math.max(1, flexW * 12)} 0 auto`,
        minHeight: 100,
        minWidth: 0,
        width: '100%',
        maxWidth: '100%',
        padding: '0.5rem 0',
        borderBottom: !showClusterBottomDivider
          ? 'none'
          : overlapDividerBelow
            ? '5px double #d1d5db'
            : '2px solid #d1d5db',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ minWidth: 0 }}>{blockHeader}</div>
      <div aria-hidden style={{ minHeight: 1 }} />
      {split.boundaries.slice(0, -1).map((_, segIdx) => {
        const a = split.boundaries[segIdx]!
        const b = split.boundaries[segIdx + 1]!
        const dur = b - a
        const canSplitThis = dur >= 2 * MIN_SEGMENT_MS
        const lastSeg = segIdx === split.boundaries.length - 2
        const openLast = !lastS.clocked_out_at && lastSeg

        const endEditable = segIdx < split.boundaries.length - 2

        const allocLabels = segmentAllocationLabelsForOverlap(c, split, nowTick, segIdx, jobLabels, bidLabels)
        const multiAlloc = allocLabels.length > 1
        const showSingleUnassignedAssign =
          !readOnlyView &&
          !saving &&
          allocLabels.length === 1 &&
          allocLabels[0] === NO_JOB_BID_LINKED_LABEL
        const unassignedIds = showSingleUnassignedAssign
          ? unassignedSessionIdsOverlappingSegment(c, split, nowTick, segIdx)
          : []
        const segmentAssignLabel = denverSameCalendarDay(a, b)
          ? formatDenverTimeRangeSameDay(a, b)
          : `${formatDenverDateTimeShort(a)} – ${formatDenverDateTimeShort(b)}`
        const singleAssignRow =
          showSingleUnassignedAssign && unassignedIds.length === 1
            ? c.find((row) => row.id === unassignedIds[0]!)
            : undefined
        const showSingleAssignedChange =
          !readOnlyView &&
          !saving &&
          allocLabels.length === 1 &&
          allocLabels[0] !== NO_JOB_BID_LINKED_LABEL
        const endInputId = `my-time-${clusterId}-seg-${segIdx}-end`
        const openLastCluster = !lastS.clocked_out_at
        const mergeUpBlockTitle =
          segIdx > 0
            ? myTimeMergePersistBlockTitle(c, split, nowTick, openLastCluster, 'prev', segIdx)
            : undefined
        const mergeDownBlockTitle =
          segIdx < split.boundaries.length - 2
            ? myTimeMergePersistBlockTitle(c, split, nowTick, openLastCluster, 'next', segIdx)
            : undefined

        const spanRangeText = openLast
          ? denverSameCalendarDay(a, b)
            ? `${formatDenverTimeOnly(a)} – Open · ${formatDenverTimeOnly(b)} (now)`
            : `${formatDenverDateTimeShort(a)} – Open · ${formatDenverTimeOnly(b)} (now)`
          : denverSameCalendarDay(a, b)
            ? formatDenverTimeRangeSameDay(a, b)
            : `${formatDenverDateTimeShort(a)} – ${formatDenverDateTimeShort(b)}`

        const adjustRow = clockSessionRowForSegmentAssign(c, split, nowTick, segIdx)
        const changeAssignTargetRow = showSingleAssignedChange ? adjustRow : null
        const spanDurationLine = `[${formatDurationMs(dur)}]`
        /** Match Visual: one line `8:00 AM – 4:00 PM [8.0 h]` inside the adjust control. */
        const formSpanAndDur = `${spanRangeText} ${spanDurationLine}`
        const adjustTimesAriaLabel = `Adjust clock-in and clock-out for this segment: ${spanRangeText}, ${formatDurationMs(dur)}`
        const spanAdjustClickable = Boolean(
          !readOnlyView && onAdjustTimes && adjustRow && !saving,
        )
        const showSegmentReject = Boolean(
          !readOnlyView && onRejectSession && adjustRow && adjustRow.clocked_out_at && !saving,
        )
        const segmentRejectDisabled = Boolean(rejectSessionBusyId != null)
        const showMergeControls = split.boundaries.length > 2 && !readOnlyView && !saving

        return (
          <Fragment key={`seg-form-${clusterId}-${segIdx}`}>
            {segIdx > 0 ? <div className="myTimeDayClusterFormSegmentDivider" aria-hidden /> : null}
            <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
              <div
                className="myTimeDayFormSpanFullRowInner"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  width: '100%',
                  minWidth: 0,
                  marginBottom: 0,
                }}
              >
                <div
                  className="myTimeDaySegmentOptionBRow"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    maxWidth: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: formStackLayout ? 'wrap' : 'nowrap',
                    gap: 6,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    className="myTimeDayFormSegTimeCol"
                    style={{
                      flex: '0 1 auto',
                      minWidth: 0,
                      maxWidth: 'min(50%, 22rem)',
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'nowrap',
                      gap: 6,
                    }}
                  >
                    {spanAdjustClickable ? (
                      <button
                        type="button"
                        className="myTimeDaySpanAdjustLink"
                        disabled={saving}
                        aria-label={adjustTimesAriaLabel}
                        title={`${spanRangeText} · ${formatDurationMs(dur)}`}
                        onClick={() => adjustRow && onAdjustTimes?.(adjustRow)}
                        style={{
                          flex: '1 1 auto',
                          minWidth: 0,
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textAlign: 'left',
                          fontSize: FORM_SPAN_VALUE_TEXT.fontSize,
                          fontVariantNumeric: FORM_SPAN_VALUE_TEXT.fontVariantNumeric,
                          margin: 0,
                        }}
                      >
                        {formSpanAndDur}
                      </button>
                    ) : (
                      <span
                        style={{
                          ...FORM_SPAN_VALUE_TEXT,
                          flex: '1 1 auto',
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formSpanAndDur}
                      </span>
                    )}
                  </div>
                  <div
                    className="myTimeDayFormSegJobCol"
                    style={{
                      flex: '1 1 0',
                      minWidth: 0,
                      maxWidth: '100%',
                      overflow: 'hidden',
                      display: 'flex',
                      justifyContent: formStackLayout ? 'flex-start' : 'center',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 4,
                        alignItems: 'center',
                        minWidth: 0,
                        flex: 1,
                        maxWidth: '100%',
                        overflow: 'hidden',
                        justifyContent: formStackLayout ? 'flex-start' : 'center',
                      }}
                    >
                      {showSingleUnassignedAssign && unassignedIds.length === 1 ? (
                        singleAssignRow ? (
                          <div style={{ minWidth: 0, maxWidth: '100%', flex: '1 1 auto' }}>
                            <AssignSessionJobPopover
                            popoverZIndex={1250}
                            unassignedTrigger="combined"
                            session={{
                              id: singleAssignRow.id,
                              job_ledger_id: singleAssignRow.job_ledger_id,
                              bid_id: singleAssignRow.bid_id,
                            }}
                            resolveSessionForAssign={
                              resolveAssignSession ? () => resolveAssignSession(segIdx) : undefined
                            }
                            onSaved={onAssignJobSaved}
                            dispatchScheduleAssigneeUserId={dispatchScheduleAssigneeUserId}
                            dispatchScheduleWorkDateYmd={dispatchScheduleWorkDateYmd}
                            draftLocalJobBidAssign={draftLocalJobBidAssign}
                            showApplyScheduleProportions={showApplyScheduleProportions}
                            onApplyScheduleProportions={onApplyScheduleProportions}
                          />
                          </div>
                        ) : null
                      ) : showSingleUnassignedAssign && unassignedIds.length > 1 ? (
                        <>
                          <span
                            title={NO_JOB_BID_LINKED_LABEL}
                            style={{
                              fontSize: '0.68rem',
                              lineHeight: 1.2,
                              padding: '2px 6px',
                              borderRadius: 4,
                              border: '1px solid var(--border)',
                              background: 'var(--bg-subtle)',
                              color: 'var(--text-700)',
                              flex: '1 1 auto',
                              minWidth: 0,
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {NO_JOB_BID_LINKED_LABEL}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setAssignBulk({
                                sessionIds: unassignedIds,
                                label: segmentAssignLabel,
                              })
                            }
                            style={{
                              padding: '0.15rem 0.45rem',
                              fontSize: '0.68rem',
                              border: '1px solid #3b82f6',
                              borderRadius: 4,
                              background: 'var(--bg-blue-tint)',
                              color: 'var(--text-link)',
                              cursor: 'pointer',
                            }}
                          >
                            Add job or bid
                          </button>
                        </>
                      ) : multiAlloc ? (
                        <div
                          role="group"
                          aria-label="Multiple distinct job or bid assignments overlap this time range"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: formStackLayout ? 'flex-start' : 'center',
                            gap: 4,
                            width: '100%',
                            minWidth: 0,
                            maxWidth: '100%',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 600,
                              color: 'var(--text-amber-800)',
                              lineHeight: 1.2,
                              textAlign: formStackLayout ? 'left' : 'center',
                            }}
                          >
                            Multiple jobs/bids in this span
                          </span>
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 4,
                              alignItems: 'center',
                              justifyContent: formStackLayout ? 'flex-start' : 'center',
                              minWidth: 0,
                              maxWidth: '100%',
                            }}
                          >
                            {allocLabels.map((label, li) => (
                              <span
                                key={`${clusterId}-${segIdx}-alloc-${li}`}
                                title={label}
                                style={{
                                  fontSize: '0.68rem',
                                  lineHeight: 1.2,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  border: '1px solid #f59e0b',
                                  background: 'var(--bg-amber-tint)',
                                  color: 'var(--text-amber-800)',
                                  maxWidth: '100%',
                                  minWidth: 0,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : changeAssignTargetRow ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            flexWrap: 'nowrap',
                            minWidth: 0,
                            width: '100%',
                          }}
                        >
                          <span
                            title={allocLabels[0] ?? ''}
                            style={{
                              fontSize: '0.68rem',
                              lineHeight: 1.2,
                              padding: '2px 6px',
                              borderRadius: 4,
                              border: '1px solid var(--border)',
                              background: 'var(--bg-subtle)',
                              color: 'var(--text-700)',
                              flex: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {allocLabels[0] ?? ''}
                          </span>
                          <span style={{ flexShrink: 0 }}>
                            <AssignSessionJobPopover
                              popoverZIndex={1250}
                              compactTrigger
                              session={{
                                id: changeAssignTargetRow.id,
                                job_ledger_id: changeAssignTargetRow.job_ledger_id,
                                bid_id: changeAssignTargetRow.bid_id,
                              }}
                              resolveSessionForAssign={
                                resolveAssignSession ? () => resolveAssignSession(segIdx) : undefined
                              }
                              onSaved={onAssignJobSaved}
                              dispatchScheduleAssigneeUserId={dispatchScheduleAssigneeUserId}
                              dispatchScheduleWorkDateYmd={dispatchScheduleWorkDateYmd}
                              draftLocalJobBidAssign={draftLocalJobBidAssign}
                            />
                          </span>
                        </div>
                      ) : (
                        <>
                          {allocLabels.map((label, li) => (
                            <span
                              key={`${clusterId}-${segIdx}-alloc-${li}`}
                              title={label}
                              style={{
                                fontSize: '0.68rem',
                                lineHeight: 1.2,
                                padding: '2px 6px',
                                borderRadius: 4,
                                border: '1px solid var(--border)',
                                background: 'var(--bg-subtle)',
                                color: 'var(--text-700)',
                                maxWidth: '100%',
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {label}
                            </span>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    className="myTimeDayFormSegActionsCol"
                    style={{
                      flex: '0 0 auto',
                      minWidth: 0,
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      flexWrap: 'nowrap',
                      gap: 4,
                    }}
                  >
                    {canSplitThis && !readOnlyView ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          patchClusterAction({
                            type: 'addSplitMidInSegment',
                            segIndex: segIdx,
                            joinTargets,
                          })
                        }
                        style={{
                          flexShrink: 0,
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.75rem',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 4,
                          background: 'var(--surface)',
                          cursor: saving ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Split
                      </button>
                    ) : null}
                    {showMergeControls ? (
                      compactMerge ? (
                        showSegmentReject ? (
                          <button
                            type="button"
                            disabled={saving || segmentRejectDisabled}
                            title="Segment actions: merge or reject"
                            aria-label="Segment actions"
                            onClick={() => setMergeDirectionModalSegIdx(segIdx)}
                            style={{
                              flexShrink: 0,
                              padding: '0 4px',
                              border: 'none',
                              background: 'transparent',
                              cursor: saving || segmentRejectDisabled ? 'not-allowed' : 'pointer',
                              color: 'var(--text-faint)',
                              fontSize: '1rem',
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={saving}
                            title="Segment actions"
                            aria-label="Segment actions"
                            onClick={() => setMergeDirectionModalSegIdx(segIdx)}
                            style={{
                              flexShrink: 0,
                              padding: '0 4px',
                              border: 'none',
                              background: 'transparent',
                              cursor: saving ? 'not-allowed' : 'pointer',
                              color: 'var(--text-faint)',
                              fontSize: '1.25rem',
                              lineHeight: 1,
                            }}
                          >
                            …
                          </button>
                        )
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            flexWrap: 'wrap',
                            gap: 4,
                            alignItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {segIdx > 0 ? (
                            <button
                              type="button"
                              disabled={!!mergeUpBlockTitle}
                              title={mergeUpBlockTitle}
                              aria-label={mergeUpBlockTitle ?? 'Merge up'}
                              onClick={() => {
                                if (mergeUpBlockTitle) return
                                const labUp = segmentAllocationLabelsForOverlap(
                                  c,
                                  split,
                                  nowTick,
                                  segIdx - 1,
                                  jobLabels,
                                  bidLabels
                                )
                                if (mergeAllocChoiceRequired(allocLabels, labUp)) {
                                  onRequestMergeJobChoice?.({ direction: 'prev', segIdx })
                                  return
                                }
                                patchClusterAction({
                                  type: 'removeSegmentMergeWithPrev',
                                  segIndex: segIdx,
                                  nowMs: nowTick,
                                  openLastCluster,
                                })
                              }}
                              style={{
                                padding: '1px 6px',
                                fontSize: '0.68rem',
                                border: '1px solid var(--border-strong)',
                                borderRadius: 4,
                                background: 'var(--surface)',
                                color: 'var(--text-muted)',
                                cursor: mergeUpBlockTitle ? 'not-allowed' : 'pointer',
                                opacity: mergeUpBlockTitle ? 0.55 : 1,
                              }}
                            >
                              Merge up
                            </button>
                          ) : null}
                          {segIdx < split.boundaries.length - 2 ? (
                            <button
                              type="button"
                              disabled={!!mergeDownBlockTitle}
                              title={mergeDownBlockTitle}
                              aria-label={mergeDownBlockTitle ?? 'Merge down'}
                              onClick={() => {
                                if (mergeDownBlockTitle) return
                                const labDn = segmentAllocationLabelsForOverlap(
                                  c,
                                  split,
                                  nowTick,
                                  segIdx + 1,
                                  jobLabels,
                                  bidLabels
                                )
                                if (mergeAllocChoiceRequired(allocLabels, labDn)) {
                                  onRequestMergeJobChoice?.({ direction: 'next', segIdx })
                                  return
                                }
                                patchClusterAction({
                                  type: 'removeSegmentMergeWithNext',
                                  segIndex: segIdx,
                                  nowMs: nowTick,
                                  openLastCluster,
                                })
                              }}
                              style={{
                                padding: '1px 6px',
                                fontSize: '0.68rem',
                                border: '1px solid var(--border-strong)',
                                borderRadius: 4,
                                background: 'var(--surface)',
                                color: 'var(--text-muted)',
                                cursor: mergeDownBlockTitle ? 'not-allowed' : 'pointer',
                                opacity: mergeDownBlockTitle ? 0.55 : 1,
                              }}
                            >
                              Merge down
                            </button>
                          ) : null}
                        </span>
                      )
                    ) : null}
                    {showSegmentReject && !(compactMerge && showMergeControls) ? (
                      <button
                        type="button"
                        disabled={segmentRejectDisabled}
                        title="Reject this clock session"
                        aria-label="Reject session"
                        onClick={() => adjustRow && onRejectSession?.(adjustRow)}
                        style={{
                          flexShrink: 0,
                          padding: '0 4px',
                          border: 'none',
                          background: 'transparent',
                          cursor: segmentRejectDisabled ? 'not-allowed' : 'pointer',
                          color: 'var(--text-faint)',
                          fontSize: '1rem',
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div
              style={{
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {endEditable ? (
                <div style={{ ...FORM_ROW_GRID }}>
                  <label htmlFor={endInputId} style={FORM_LABEL_CELL}>
                    Ends at
                  </label>
                  <div style={{ minWidth: 0 }}>
                    <input
                      id={endInputId}
                      type={timeOnlyMode ? 'time' : 'datetime-local'}
                      step={timeOnlyMode ? 60 : undefined}
                      defaultValue={timeOnlyMode ? msToTimeLocalValue(b) : msToDatetimeLocalValue(b)}
                      key={`${clusterId}-e-${segIdx}-${b}-${timeOnlyMode ? 't' : 'dt'}`}
                      disabled={readOnlyView || saving || segmentTimeInputsReadOnly}
                      readOnly={readOnlyView || segmentTimeInputsReadOnly}
                      onBlur={(e) => {
                        if (readOnlyView || segmentTimeInputsReadOnly) return
                        const ms = timeOnlyMode
                          ? parseTimeOnAnchorDateToMs(anchorYmd, e.target.value)
                          : parseDatetimeLocalToMs(e.target.value)
                        if (ms == null) return
                        onCommitInnerBoundary(segIdx + 1, ms)
                      }}
                      style={DATETIME_INPUT_STYLE}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <div
              style={{
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <textarea
                value={split.notes[segIdx] ?? ''}
                onChange={(ev) => patchClusterAction({ type: 'setNote', index: segIdx, text: ev.target.value })}
                rows={2}
                readOnly={readOnlyView}
                disabled={readOnlyView || saving}
                placeholder="What were you working on?"
                style={{
                  width: '100%',
                  flex: 1,
                  minHeight: 44,
                  padding: '0.35rem 0.5rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  fontSize: '0.8125rem',
                  resize: 'vertical',
                }}
              />
            </div>
          </Fragment>
        )
      })}
    </div>
    <MyTimeSegmentMergeDirectionModal
      open={mergeDirectionModalSegIdx !== null}
      onClose={() => setMergeDirectionModalSegIdx(null)}
      mergeUpVisible={
        mergeDirectionModalSegIdx !== null && mergeDirectionModalSegIdx > 0
      }
      mergeDownVisible={
        mergeDirectionModalSegIdx !== null &&
        mergeDirectionModalSegIdx < split.boundaries.length - 2
      }
      disabled={saving}
      mergeUpBlocked={!!mergeDirUpBlockedTitle}
      mergeUpBlockedTitle={mergeDirUpBlockedTitle}
      mergeDownBlocked={!!mergeDirDownBlockedTitle}
      mergeDownBlockedTitle={mergeDirDownBlockedTitle}
      showReject={(() => {
        const k = mergeDirectionModalSegIdx
        if (k == null) return false
        const row = clockSessionRowForSegmentAssign(c, split, nowTick, k)
        return Boolean(
          !readOnlyView && onRejectSession && row && row.clocked_out_at && !saving,
        )
      })()}
      rejectDisabled={rejectSessionBusyId != null}
      onReject={() => {
        const k = mergeDirectionModalSegIdx
        if (k == null) return
        const row = clockSessionRowForSegmentAssign(c, split, nowTick, k)
        if (row?.clocked_out_at) void onRejectSession?.(row)
      }}
      onMergeUp={() => {
        const k = mergeDirectionModalSegIdx
        if (k == null) return
        const allocLabels = segmentAllocationLabelsForOverlap(c, split, nowTick, k, jobLabels, bidLabels)
        const labUp = segmentAllocationLabelsForOverlap(c, split, nowTick, k - 1, jobLabels, bidLabels)
        if (mergeAllocChoiceRequired(allocLabels, labUp)) {
          onRequestMergeJobChoice?.({ direction: 'prev', segIdx: k })
          return
        }
        patchClusterAction({
          type: 'removeSegmentMergeWithPrev',
          segIndex: k,
          nowMs: nowTick,
          openLastCluster: !lastS.clocked_out_at,
        })
      }}
      onMergeDown={() => {
        const k = mergeDirectionModalSegIdx
        if (k == null) return
        const allocLabels = segmentAllocationLabelsForOverlap(c, split, nowTick, k, jobLabels, bidLabels)
        const labDn = segmentAllocationLabelsForOverlap(c, split, nowTick, k + 1, jobLabels, bidLabels)
        if (mergeAllocChoiceRequired(allocLabels, labDn)) {
          onRequestMergeJobChoice?.({ direction: 'next', segIdx: k })
          return
        }
        patchClusterAction({
          type: 'removeSegmentMergeWithNext',
          segIndex: k,
          nowMs: nowTick,
          openLastCluster: !lastS.clocked_out_at,
        })
      }}
    />
    </Fragment>
  )
}
