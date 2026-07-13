import { Fragment, useEffect, useState, type CSSProperties } from 'react'
import {
  AssignSessionJobPopover,
  type AssignSessionJobPopoverSession,
  type AssignSessionJobSavedPatch,
} from '../clock-sessions/AssignSessionJobPopover'
import type { UnifiedSearchResult } from '../../utils/unifiedJobBidSearch'
import type { DispatchScheduledJobForAssign } from '../../lib/jobScheduleBlocks'
import {
  clockSessionRowForSegmentAssign,
  clusterHasMultipleAllocations,
  mergeAllocChoiceRequired,
  myTimeMergePersistBlockTitle,
  NO_JOB_BID_LINKED_LABEL,
  segmentAllocationLabelsForOverlap,
  unassignedSessionIdsOverlappingSegment,
} from '../../lib/myTimeDaySavePlan'
import {
  cloneSplitState,
  internalRowJoinMs,
  type DayEditorSession,
  type SplitAction,
  type SplitEditorState,
} from '../../lib/myTimeDayTimeline'
import {
  denverHourMarksBetween,
  denverSameCalendarDay,
  formatDenverBlockDateHeader,
  formatDenverDateTimeShort,
  formatDenverBlockWeekdayHeader,
  formatDenverTimeOnly,
  formatDenverTimeRangeSameDay,
} from '../../utils/dateUtils'
import { ForceClockOutIcon } from '../icons/ForceClockOutIcon'
import { MyTimeSegmentMergeDirectionModal } from './MyTimeSegmentMergeDirectionModal'
import { useMyTimeCompactMergeMedia } from './useMyTimeCompactMergeMedia'

function formatDurationMs(ms: number): string {
  const h = ms / 3600000
  return h % 1 === 0 ? `${h.toFixed(1)} h` : `${h.toFixed(2)} h`
}

export type MyTimeDayClusterVisualProps = {
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
  setStripEl: (el: HTMLDivElement | null) => void
  onStripPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onStripKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
  onStartDrag: (index: number, ev: React.PointerEvent<HTMLButtonElement>, undo: SplitEditorState) => void
  onFocusHandle: (index: number) => void
  patchClusterAction: (action: SplitAction) => void
  setAssignBulk: (v: { sessionIds: string[]; label: string } | null) => void
  onAssignJobSaved: (patch?: AssignSessionJobSavedPatch) => void
  resolveAssignSession?: (segIdx: number) => Promise<AssignSessionJobPopoverSession | null>
  onRequestMergeJobChoice?: (payload: { direction: 'prev' | 'next'; segIdx: number }) => void
  onForceClockOut?: (session: DayEditorSession) => void
  onAdjustTimes?: (session: DayEditorSession) => void
  onRejectSession?: (session: DayEditorSession) => void | Promise<void>
  rejectSessionBusyId?: string | null
  /** Dashboard clock preview: strip and actions non-interactive. */
  readOnlyView?: boolean
  /** Strip-origin My Time: show “Salaried” under bottom time next to the vertical strip. */
  salariedStripFooterLabel?: boolean
  dispatchScheduleAssigneeUserId?: string
  dispatchScheduleWorkDateYmd?: string
  draftLocalJobBidAssign?: (
    target: AssignSessionJobPopoverSession,
    selection: UnifiedSearchResult | null,
  ) => void
  /** Day editor: show "Apply Schedule %" on the unassigned popover (day has no job-linked sessions). */
  showApplyScheduleProportions?: boolean
  onApplyScheduleProportions?: (picks: DispatchScheduledJobForAssign[]) => void
  /** False for the last cluster in the day timeline: no bottom separator under the final block. */
  showClusterBottomDivider?: boolean
}

export function MyTimeDayClusterVisual({
  clusterId,
  c,
  lastS,
  split,
  t0,
  t1,
  span,
  flexW,
  nowTick,
  saving,
  jobLabels,
  bidLabels,
  setStripEl,
  onStripPointerDown,
  onStripKeyDown,
  onStartDrag,
  onFocusHandle,
  patchClusterAction,
  setAssignBulk,
  onAssignJobSaved,
  resolveAssignSession,
  onRequestMergeJobChoice,
  onForceClockOut,
  onAdjustTimes,
  onRejectSession,
  rejectSessionBusyId = null,
  readOnlyView = false,
  salariedStripFooterLabel = false,
  dispatchScheduleAssigneeUserId,
  dispatchScheduleWorkDateYmd,
  draftLocalJobBidAssign,
  showApplyScheduleProportions = false,
  onApplyScheduleProportions,
  showClusterBottomDivider = true,
}: MyTimeDayClusterVisualProps) {
  const openLastCluster = !lastS.clocked_out_at
  const compactMerge = useMyTimeCompactMergeMedia()
  const [mergeDirectionModalSegIdx, setMergeDirectionModalSegIdx] = useState<number | null>(null)

  useEffect(() => {
    if (saving) setMergeDirectionModalSegIdx(null)
  }, [saving])

  const mergeDirUpBlockedTitle =
    mergeDirectionModalSegIdx != null && mergeDirectionModalSegIdx > 0
      ? myTimeMergePersistBlockTitle(
          c,
          split,
          nowTick,
          openLastCluster,
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
          openLastCluster,
          'next',
          mergeDirectionModalSegIdx,
        )
      : undefined

  return (
    <Fragment>
    <div
      className="myTimeDaySessionRow"
      style={{
        flex: `${Math.max(1, flexW * 12)} 0 auto`,
        minHeight: 100,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: compactMerge ? 5 : 10,
        padding: '0.5rem 0',
        borderBottom: showClusterBottomDivider ? '2px solid var(--border-strong)' : 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: compactMerge ? 'flex-start' : 'center',
          alignSelf: 'stretch',
          flexShrink: 0,
          gap: 4,
          minHeight: 0,
          maxWidth: compactMerge ? 'min-content' : undefined,
        }}
      >
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 500,
            color: 'var(--text-muted)',
            lineHeight: 1.15,
            textAlign: compactMerge ? 'left' : 'center',
            pointerEvents: 'none',
            maxWidth: compactMerge ? '6.25rem' : '8.5rem',
          }}
        >
          {formatDenverBlockWeekdayHeader(t0, t1)}
        </span>
        <span
          style={{
            fontSize: '0.65rem',
            color: 'var(--text-faint)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.15,
            textAlign: compactMerge ? 'left' : 'center',
            pointerEvents: 'none',
          }}
        >
          {formatDenverTimeOnly(t0)}
        </span>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
            flex: 1,
            minHeight: 88,
            minWidth: 0,
            alignSelf: compactMerge ? 'flex-start' : 'stretch',
            gap: compactMerge ? 2 : 4,
          }}
        >
          <div
            className="myTimeDayStripHourGutter"
            style={{
              position: 'relative',
              width: compactMerge ? '1.5rem' : '2.25rem',
              flexShrink: 0,
              pointerEvents: 'none',
            }}
            aria-hidden
          >
            {denverHourMarksBetween(t0, t1).map(({ ms: hourMs, label: hourLabel }) => (
              <span
                key={`hour-${clusterId}-${hourMs}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: `${((hourMs - t0) / span) * 100}%`,
                  transform: 'translateY(-50%)',
                  fontSize: '0.62rem',
                  color: 'var(--text-faint)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                  textAlign: 'right',
                  paddingRight: 1,
                }}
              >
                {hourLabel}
              </span>
            ))}
          </div>
          <div
            ref={setStripEl}
            className="myTimeDayVerticalStrip"
            role="slider"
            aria-label={
              clusterHasMultipleAllocations(c)
                ? `Adjust focus boundaries for ${formatDenverBlockDateHeader(t0, t1)}, ${formatDenverTimeOnly(t0)} to ${formatDenverTimeOnly(t1)}; multiple job or bid links`
                : `Adjust focus boundaries for ${formatDenverBlockDateHeader(t0, t1)}, ${formatDenverTimeOnly(t0)} to ${formatDenverTimeOnly(t1)}`
            }
            tabIndex={readOnlyView ? -1 : 0}
            onPointerDown={readOnlyView ? undefined : onStripPointerDown}
            onKeyDown={readOnlyView ? undefined : onStripKeyDown}
            style={{
              width: 32,
              flex: 1,
              minHeight: 88,
              position: 'relative',
              background: 'var(--bg-200)',
              borderRadius: 8,
              touchAction: readOnlyView ? undefined : 'none',
              cursor: readOnlyView ? 'default' : 'crosshair',
              pointerEvents: readOnlyView ? 'none' : undefined,
            }}
          >
            {internalRowJoinMs(c, nowTick).map((refMs) => {
              const pctRef = ((refMs - t0) / span) * 100
              return (
                <span
                  key={`ref-${clusterId}-${refMs}`}
                  title="Original row boundary (job or bid may change here)"
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: `${pctRef}%`,
                    height: 0,
                    borderTop: '2px dashed #94a3b8',
                    transform: 'translateY(-1px)',
                    pointerEvents: 'none',
                    zIndex: 1,
                  }}
                />
              )
            })}
            {split.boundaries.map((ms, bi) => {
              const pct = ((ms - t0) / span) * 100
              const isEnd = bi === split.boundaries.length - 1
              const isStart = bi === 0
              if (isStart) {
                return (
                  <span
                    key={`m-${bi}`}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: `${pct}%`,
                      height: 2,
                      background: '#4b5563',
                      transform: 'translateY(-1px)',
                      pointerEvents: 'none',
                    }}
                  />
                )
              }
              if (isEnd) {
                return (
                  <span
                    key={`m-${bi}`}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: `${pct}%`,
                      height: 2,
                      background: '#4b5563',
                      transform: 'translateY(-1px)',
                      pointerEvents: 'none',
                    }}
                  />
                )
              }
              const canDrag = bi > 0 && bi < split.boundaries.length - 1
              return (
                <button
                  key={`h-${bi}`}
                  type="button"
                  className="myTimeBoundaryHandle"
                  data-boundary-handle
                  tabIndex={0}
                  aria-label={`Boundary at ${formatDenverDateTimeShort(ms)}`}
                  disabled={readOnlyView || !canDrag || saving}
                  onPointerDown={(ev) => {
                    if (readOnlyView || !canDrag) return
                    ev.stopPropagation()
                    ev.preventDefault()
                    onFocusHandle(bi)
                    onStartDrag(bi, ev, cloneSplitState(split))
                  }}
                  onClick={(ev) => ev.stopPropagation()}
                  onFocus={() => onFocusHandle(bi)}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: `${pct}%`,
                    width: 24,
                    minHeight: 28,
                    marginLeft: -12,
                    marginTop: -14,
                    borderRadius: 4,
                    border: '2px solid #1d4ed8',
                    background: '#3b82f6',
                    cursor: canDrag && !saving ? 'grab' : 'default',
                    padding: 0,
                    zIndex: 3,
                    touchAction: 'none',
                  }}
                />
              )
            })}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: compactMerge ? 'flex-start' : 'center',
            gap: 4,
            maxWidth: compactMerge ? undefined : '9rem',
            alignSelf: compactMerge ? 'flex-start' : undefined,
          }}
        >
          <span
            style={{
              fontSize: '0.65rem',
              color: 'var(--text-faint)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.15,
              textAlign: compactMerge ? 'left' : 'center',
              pointerEvents: 'none',
            }}
          >
            {formatDenverTimeOnly(t1)}
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
                flexShrink: 0,
                verticalAlign: 'middle',
              }}
            >
              <ForceClockOutIcon />
            </button>
          ) : null}
        </div>
        {salariedStripFooterLabel ? (
          <span
            style={{
              fontSize: '0.65rem',
              color: 'var(--text-faint)',
              fontWeight: 500,
              lineHeight: 1.15,
              textAlign: compactMerge ? 'left' : 'center',
              pointerEvents: 'none',
              alignSelf: compactMerge ? 'flex-start' : undefined,
            }}
          >
            Salaried
          </span>
        ) : null}
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minHeight: 88,
          alignSelf: 'stretch',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            gap: 4,
            minHeight: 0,
          }}
        >
          {split.boundaries.slice(0, -1).map((_, segIdx) => {
            const a = split.boundaries[segIdx]!
            const b = split.boundaries[segIdx + 1]!
            const dur = b - a
            const flexGrow = Math.max(0.35, dur / span)
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
            const adjustRow = clockSessionRowForSegmentAssign(c, split, nowTick, segIdx)
            const changeAssignTargetRow = showSingleAssignedChange ? adjustRow : null
            const visualSpanAndDur = `${segmentAssignLabel} [${formatDurationMs(dur)}]`
            const visualSpanAdjustClickable = Boolean(
              !readOnlyView && onAdjustTimes && adjustRow && !saving,
            )
            const showSegmentReject = Boolean(
              !readOnlyView && onRejectSession && adjustRow && adjustRow.clocked_out_at && !saving,
            )
            const segmentRejectDisabled = Boolean(rejectSessionBusyId != null)
            const showMergeControls = split.boundaries.length > 2 && !readOnlyView && !saving
            const mergeUpBlockTitle =
              segIdx > 0
                ? myTimeMergePersistBlockTitle(c, split, nowTick, openLastCluster, 'prev', segIdx)
                : undefined
            const mergeDownBlockTitle =
              segIdx < split.boundaries.length - 2
                ? myTimeMergePersistBlockTitle(c, split, nowTick, openLastCluster, 'next', segIdx)
                : undefined
            const visualSpanDurText: CSSProperties = {
              fontSize: '0.75rem',
              color: 'var(--text-faint)',
              fontVariantNumeric: 'tabular-nums',
            }
            return (
              <div
                key={`seg-${clusterId}-${segIdx}`}
                style={{
                  flex: `${flexGrow} 1 auto`,
                  minHeight: 52,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  className="myTimeDaySegmentOptionBRow"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    minWidth: 0,
                    flexWrap: compactMerge ? 'wrap' : 'nowrap',
                    gap: 6,
                    marginBottom: compactMerge ? 4 : 6,
                  }}
                >
                  <div
                    className="myTimeDayVisualSegTimeCol"
                    style={{
                      flex: compactMerge ? '1 1 auto' : 1,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: 6,
                    }}
                  >
                    {visualSpanAdjustClickable ? (
                      <button
                        type="button"
                        className="myTimeDaySpanAdjustLink"
                        disabled={saving}
                        aria-label="Adjust clock-in and clock-out for this segment"
                        onClick={() => adjustRow && onAdjustTimes?.(adjustRow)}
                        style={{
                          flex: '1 1 auto',
                          minWidth: 0,
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textAlign: 'left',
                          fontSize: visualSpanDurText.fontSize,
                          fontVariantNumeric: visualSpanDurText.fontVariantNumeric,
                          margin: 0,
                        }}
                      >
                        {visualSpanAndDur}
                      </button>
                    ) : (
                      <span
                        style={{
                          ...visualSpanDurText,
                          flex: '1 1 auto',
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {visualSpanAndDur}
                      </span>
                    )}
                  </div>
                  <div
                    className="myTimeDayVisualSegJobCol"
                    style={{
                      flex: compactMerge ? '1 1 100%' : 1,
                      minWidth: 0,
                      display: 'flex',
                      justifyContent: compactMerge ? 'flex-start' : 'center',
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
                        justifyContent: compactMerge ? 'flex-start' : 'center',
                      }}
                    >
                      {showSingleUnassignedAssign && unassignedIds.length === 1 ? (
                        singleAssignRow ? (
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
                            alignItems: compactMerge ? 'flex-start' : 'center',
                            gap: 4,
                            width: '100%',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 600,
                              color: 'var(--text-amber-800)',
                              lineHeight: 1.2,
                              textAlign: compactMerge ? 'left' : 'center',
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
                              justifyContent: compactMerge ? 'flex-start' : 'center',
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
                    className="myTimeDayVisualSegActionsCol"
                    style={{
                      flex: compactMerge ? '0 0 auto' : 1,
                      minWidth: 0,
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 4,
                      rowGap: 4,
                    }}
                  >
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
            )
          })}
        </div>
      </div>
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
          openLastCluster,
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
          openLastCluster,
        })
      }}
    />
    </Fragment>
  )
}
