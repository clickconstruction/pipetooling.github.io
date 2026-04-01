import type { CSSProperties } from 'react'
import {
  AssignSessionJobPopover,
  type AssignSessionJobPopoverSession,
} from '../clock-sessions/AssignSessionJobPopover'
import {
  clockSessionRowForSegmentAssign,
  clusterHasMultipleAllocations,
  mergeAllocChoiceRequired,
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
  onAssignJobSaved: () => void
  resolveAssignSession?: (segIdx: number) => Promise<AssignSessionJobPopoverSession | null>
  onRequestMergeJobChoice?: (payload: { direction: 'prev' | 'next'; segIdx: number }) => void
  onForceClockOut?: (session: DayEditorSession) => void
  onAdjustTimes?: (session: DayEditorSession) => void
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
}: MyTimeDayClusterVisualProps) {
  const openLastCluster = !lastS.clocked_out_at
  return (
    <div
      className="myTimeDaySessionRow"
      style={{
        flex: `${Math.max(1, flexW * 12)} 0 auto`,
        minHeight: 100,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 10,
        padding: '0.5rem 0',
        borderBottom: '1px solid #f3f4f6',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          alignSelf: 'stretch',
          flexShrink: 0,
          gap: 4,
          minHeight: 0,
        }}
      >
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 500,
            color: '#6b7280',
            lineHeight: 1.15,
            textAlign: 'center',
            pointerEvents: 'none',
            maxWidth: '8.5rem',
          }}
        >
          {formatDenverBlockWeekdayHeader(t0, t1)}
        </span>
        <span
          style={{
            fontSize: '0.65rem',
            color: '#9ca3af',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.15,
            textAlign: 'center',
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
            alignSelf: 'stretch',
            gap: 4,
          }}
        >
          <div
            className="myTimeDayStripHourGutter"
            style={{
              position: 'relative',
              width: '2.25rem',
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
                  color: '#9ca3af',
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
            tabIndex={0}
            onPointerDown={onStripPointerDown}
            onKeyDown={onStripKeyDown}
            style={{
              width: 32,
              flex: 1,
              minHeight: 88,
              position: 'relative',
              background: '#e5e7eb',
              borderRadius: 8,
              touchAction: 'none',
              cursor: 'crosshair',
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
                  disabled={!canDrag || saving}
                  onPointerDown={(ev) => {
                    if (!canDrag) return
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
            justifyContent: 'center',
            gap: 4,
            maxWidth: '9rem',
          }}
        >
          <span
            style={{
              fontSize: '0.65rem',
              color: '#9ca3af',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.15,
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            {formatDenverTimeOnly(t1)}
          </span>
          {onForceClockOut && !lastS.clocked_out_at ? (
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
                color: '#6b7280',
                lineHeight: 0,
                flexShrink: 0,
                verticalAlign: 'middle',
              }}
            >
              <ForceClockOutIcon />
            </button>
          ) : null}
        </div>
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
              !saving && allocLabels.length === 1 && allocLabels[0] === NO_JOB_BID_LINKED_LABEL
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
              !saving &&
              allocLabels.length === 1 &&
              allocLabels[0] !== NO_JOB_BID_LINKED_LABEL
            const adjustRow = clockSessionRowForSegmentAssign(c, split, nowTick, segIdx)
            const changeAssignTargetRow = showSingleAssignedChange ? adjustRow : null
            const visualSpanAndDur = `${segmentAssignLabel} [${formatDurationMs(dur)}]`
            const visualSpanAdjustClickable = Boolean(onAdjustTimes && adjustRow && !saving)
            const visualSpanDurText: CSSProperties = {
              fontSize: '0.75rem',
              color: '#9ca3af',
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
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 6,
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
                        fontSize: visualSpanDurText.fontSize,
                        fontVariantNumeric: visualSpanDurText.fontVariantNumeric,
                        margin: 0,
                      }}
                    >
                      {visualSpanAndDur}
                    </button>
                  ) : (
                    <span style={visualSpanDurText}>{visualSpanAndDur}</span>
                  )}
                  {split.boundaries.length > 2 && !saving ? (
                    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                      {segIdx > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
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
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            background: 'white',
                            color: '#6b7280',
                            cursor: 'pointer',
                          }}
                        >
                          Merge up
                        </button>
                      ) : null}
                      {segIdx < split.boundaries.length - 2 ? (
                        <button
                          type="button"
                          onClick={() => {
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
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            background: 'white',
                            color: '#6b7280',
                            cursor: 'pointer',
                          }}
                        >
                          Merge down
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 4,
                      alignItems: 'center',
                      minWidth: 0,
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
                            border: '1px solid #e5e7eb',
                            background: '#f9fafb',
                            color: '#374151',
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
                            background: '#eff6ff',
                            color: '#2563eb',
                            cursor: 'pointer',
                          }}
                        >
                          Add job or bid
                        </button>
                      </>
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
                              border: multiAlloc ? '1px solid #f59e0b' : '1px solid #e5e7eb',
                              background: multiAlloc ? '#fffbeb' : '#f9fafb',
                              color: multiAlloc ? '#92400e' : '#374151',
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {label}
                          </span>
                        ))}
                        {!multiAlloc && changeAssignTargetRow ? (
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
                          />
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
                <textarea
                  value={split.notes[segIdx] ?? ''}
                  onChange={(ev) => patchClusterAction({ type: 'setNote', index: segIdx, text: ev.target.value })}
                  rows={2}
                  disabled={saving}
                  placeholder="What were you working on?"
                  style={{
                    width: '100%',
                    flex: 1,
                    minHeight: 44,
                    padding: '0.35rem 0.5rem',
                    border: '1px solid #d1d5db',
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
  )
}
