import { Fragment, useMemo, type CSSProperties } from 'react'
import {
  AssignSessionJobPopover,
  type AssignSessionJobPopoverSession,
} from '../clock-sessions/AssignSessionJobPopover'
import {
  clockSessionRowForSegmentAssign,
  mergeAllocChoiceRequired,
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
  color: '#6b7280',
}

const FORM_LABEL_CELL: CSSProperties = {
  fontSize: '0.68rem',
  fontWeight: 500,
  color: '#6b7280',
  textAlign: 'right',
  paddingRight: 6,
  lineHeight: 1.25,
}

/** Same typography as Span range text (right column meta, e.g. duration). */
const FORM_SPAN_VALUE_TEXT: CSSProperties = {
  color: '#374151',
  fontVariantNumeric: 'tabular-nums',
  fontSize: '0.75rem',
  minWidth: 0,
}

const DATETIME_INPUT_STYLE: CSSProperties = {
  padding: '0.2rem 0.35rem',
  border: '1px solid #d1d5db',
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
  onAssignJobSaved: () => void
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
}: MyTimeDayClusterFormProps) {
  const timeOnlyMode = denverSameCalendarDay(t0, t1)
  const anchorYmd = anchorDateYmdFromClusterStart(t0)

  const joinTargets = useMemo(() => internalRowJoinMs(c, nowTick), [c, nowTick])

  const blockHeader = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, paddingTop: 2 }}>
      <span
        style={{
          fontSize: '0.68rem',
          fontWeight: 500,
          color: '#6b7280',
          lineHeight: 1.15,
          textAlign: 'left',
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
          textAlign: 'left',
        }}
      >
        {formatDenverBlockDateHeader(t0, t1)}
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
            color: '#9ca3af',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.15,
            textAlign: 'left',
          }}
        >
          {formatDenverTimeOnly(t0)} – {formatDenverTimeOnly(t1)}
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
    <div
      className="myTimeDaySessionRow myTimeDayClusterFormGrid"
      style={{
        flex: `${Math.max(1, flexW * 12)} 0 auto`,
        minHeight: 100,
        padding: '0.5rem 0',
        borderBottom: '1px solid #f3f4f6',
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
        const endInputId = `my-time-${clusterId}-seg-${segIdx}-end`
        const openLastCluster = !lastS.clocked_out_at

        const spanRangeText = openLast
          ? denverSameCalendarDay(a, b)
            ? `${formatDenverTimeOnly(a)} – Open · ${formatDenverTimeOnly(b)} (now)`
            : `${formatDenverDateTimeShort(a)} – Open · ${formatDenverTimeOnly(b)} (now)`
          : denverSameCalendarDay(a, b)
            ? formatDenverTimeRangeSameDay(a, b)
            : `${formatDenverDateTimeShort(a)} – ${formatDenverDateTimeShort(b)}`

        const adjustRow = clockSessionRowForSegmentAssign(c, split, nowTick, segIdx)
        const changeAssignTargetRow = showSingleAssignedChange ? adjustRow : null
        const spanAndDurText = `${spanRangeText} [${formatDurationMs(dur)}]`
        const spanAdjustClickable = Boolean(onAdjustTimes && adjustRow && !saving)
        const showSegmentReject =
          Boolean(onRejectSession && adjustRow && adjustRow.clocked_out_at && !saving)
        const segmentRejectDisabled = Boolean(rejectSessionBusyId != null)

        return (
          <Fragment key={`seg-form-${clusterId}-${segIdx}`}>
            {segIdx > 0 ? <div className="myTimeDayClusterFormSegmentDivider" aria-hidden /> : null}
            <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
              <div
                className="myTimeDayFormSpanFullRowInner"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  minWidth: 0,
                  marginBottom: 6,
                }}
              >
                <span
                  className="myTimeDayFormSpanLabel"
                  style={{
                    ...FORM_LABEL_CELL,
                    width: '6.5rem',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                >
                  Span
                </span>
                <div
                  className="myTimeDaySegmentOptionBRow"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'nowrap',
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: 6,
                    }}
                  >
                    {spanAdjustClickable ? (
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
                          fontSize: FORM_SPAN_VALUE_TEXT.fontSize,
                          fontVariantNumeric: FORM_SPAN_VALUE_TEXT.fontVariantNumeric,
                          margin: 0,
                        }}
                      >
                        {spanAndDurText}
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
                        {spanAndDurText}
                      </span>
                    )}
                    {split.boundaries.length > 2 && !saving ? (
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
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      justifyContent: 'center',
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
                        justifyContent: 'center',
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
                      ) : multiAlloc ? (
                        <div
                          role="group"
                          aria-label="Multiple distinct job or bid assignments overlap this time range"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                            width: '100%',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 600,
                              color: '#92400e',
                              lineHeight: 1.2,
                              textAlign: 'center',
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
                              justifyContent: 'center',
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
                                  background: '#fffbeb',
                                  color: '#92400e',
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
                              border: '1px solid #e5e7eb',
                              background: '#f9fafb',
                              color: '#374151',
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
                                border: '1px solid #e5e7eb',
                                background: '#f9fafb',
                                color: '#374151',
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
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                    }}
                  >
                    {showSegmentReject ? (
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
                          color: '#9ca3af',
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
                minHeight: 52,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {canSplitThis ? (
                <div style={{ ...FORM_ROW_GRID, marginTop: 6 }}>
                  <span style={FORM_LABEL_CELL} />
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
                      justifySelf: 'start',
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      background: 'white',
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Split
                  </button>
                </div>
              ) : null}
              {endEditable ? (
                <div style={{ ...FORM_ROW_GRID, marginTop: 6 }}>
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
                      disabled={saving}
                      onBlur={(e) => {
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
          </Fragment>
        )
      })}
    </div>
  )
}
