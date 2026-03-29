import { Fragment, useMemo, type CSSProperties } from 'react'
import { AssignSessionJobPopover } from '../clock-sessions/AssignSessionJobPopover'
import {
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
  onSaved: () => void
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
  onSaved,
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
        {!lastS.clocked_out_at ? ' (open)' : ''}
      </span>
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
        const endInputId = `my-time-${clusterId}-seg-${segIdx}-end`

        const spanRangeText = openLast
          ? denverSameCalendarDay(a, b)
            ? `${formatDenverTimeOnly(a)} – Open · ${formatDenverTimeOnly(b)} (now)`
            : `${formatDenverDateTimeShort(a)} – Open · ${formatDenverTimeOnly(b)} (now)`
          : denverSameCalendarDay(a, b)
            ? formatDenverTimeRangeSameDay(a, b)
            : `${formatDenverDateTimeShort(a)} – ${formatDenverDateTimeShort(b)}`

        return (
          <Fragment key={`seg-form-${clusterId}-${segIdx}`}>
            {segIdx > 0 ? <div className="myTimeDayClusterFormSegmentDivider" aria-hidden /> : null}
            <div
              style={{
                minHeight: 52,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={FORM_ROW_GRID}>
                <span style={FORM_LABEL_CELL}>Span</span>
                <span style={FORM_SPAN_VALUE_TEXT}>{spanRangeText}</span>
              </div>
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
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: 6,
                  minWidth: 0,
                }}
              >
                <span style={FORM_SPAN_VALUE_TEXT}>[{formatDurationMs(dur)}]</span>
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
                        onSaved={onSaved}
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
                    allocLabels.map((label, li) => (
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
                    ))
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
          </Fragment>
        )
      })}
    </div>
  )
}
