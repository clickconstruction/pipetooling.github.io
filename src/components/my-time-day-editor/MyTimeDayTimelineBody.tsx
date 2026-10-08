import { Fragment, useMemo, type ComponentProps } from 'react'
import {
  buildDayTimeline,
  CLOCK_OVERLAP_WARNING_EPS_MS,
  daySpanMs,
  getNextSessionClusterInTimeline,
  hasPairwiseClockIntervalOverlap,
  type DayEditorSession,
  type DayTimelineItem,
} from '../../lib/myTimeDayTimeline'
import { MyTimeDayClusterForm } from './MyTimeDayClusterForm'
import { MyTimeDayClusterVisual } from './MyTimeDayClusterVisual'
import { formatDurationMs } from './myTimeDayEditorDatetime'
import type { useMyTimeBoundaryGestures } from './useMyTimeBoundaryGestures'
import type { useMyTimeSplitEditor } from './useMyTimeSplitEditor'

type VisualProps = ComponentProps<typeof MyTimeDayClusterVisual>

export type MyTimeDayTimelineBodyProps = Pick<
  ReturnType<typeof useMyTimeSplitEditor>,
  'splitByCluster' | 'patchCluster' | 'commitInnerBoundary' | 'openMergeJobChoiceForCluster'
> &
  Pick<
    ReturnType<typeof useMyTimeBoundaryGestures>,
    'stripRefs' | 'handleStripPointerDown' | 'handleStripKeyDown' | 'startDrag' | 'setFocusedHandle'
  > & {
    myTimeCompactLayout: boolean
    /** Every cluster has its seeded split; until then the body says Loading editor…. */
    editorInitialized: boolean
    sortedSessions: DayEditorSession[]
    nowTick: number
    layoutMode: 'visual' | 'form'
    saving: boolean
    mergedJobLabels: Record<string, string>
    mergedBidLabels: Record<string, string>
    setAssignBulk: VisualProps['setAssignBulk']
    handleAssignJobSaved: VisualProps['onAssignJobSaved']
    resolveAssignSessionForSegment: (clusterId: string, segIdx: number) => ReturnType<NonNullable<VisualProps['resolveAssignSession']>>
    allowPunchTimeActions: boolean
    openForceClockOut: NonNullable<VisualProps['onForceClockOut']>
    openAdjustTimes: NonNullable<VisualProps['onAdjustTimes']>
    handleRejectSession: NonNullable<VisualProps['onRejectSession']>
    rejectSessionBusyId: VisualProps['rejectSessionBusyId']
    effectiveSubjectUserId: string | null
    dateStr: string
    /** Only its presence matters: the parent patches seeded sessions, so job picks stay local. */
    onPatchSeededSessionsJobBid?: unknown
    draftLocalJobBidAssign: NonNullable<VisualProps['draftLocalJobBidAssign']>
    showApplyScheduleProportions: boolean
    applyScheduleProportionsToCluster: (
      clusterId: string,
      picks: Parameters<NonNullable<VisualProps['onApplyScheduleProportions']>>[0],
    ) => Promise<void>
    showSalariedLabelUnderVisualStrip: boolean
    clockTimesReadOnly: boolean
    /** The + Add session gate: an editable, acknowledged day the modal reads itself, loaded. */
    effectiveEditable: boolean
    priorWeekGateActive: boolean
    sessionsProp: DayEditorSession[]
    sessionsLoading: boolean
    pendingAuthForFetch: boolean
    setAddDisjointOpen: (open: { defaultClockInIso: string; defaultClockOutIso: string } | null) => void
    computeAddDisjointDefaults: () => { defaultClockInIso: string; defaultClockOutIso: string }
  }

/**
 * The My Time day editor's timeline body (map step 8b, `docs/MY_TIME_DAY_EDITOR_MODAL_ARCHITECTURE.md`
 * → region 11): the scroll box with an Off clock strip for each gap, each cluster's overlap warning and
 * its Visual or Form editor, and the + Add session tail. Pure composition, moved verbatim from
 * `DashboardMyTimeDayEditorModal` with the timeline memos only it read; every prop keeps the shell's name.
 */
export function MyTimeDayTimelineBody({
  myTimeCompactLayout,
  editorInitialized,
  sortedSessions,
  nowTick,
  layoutMode,
  saving,
  splitByCluster,
  patchCluster,
  commitInnerBoundary,
  openMergeJobChoiceForCluster,
  stripRefs,
  handleStripPointerDown,
  handleStripKeyDown,
  startDrag,
  setFocusedHandle,
  mergedJobLabels,
  mergedBidLabels,
  setAssignBulk,
  handleAssignJobSaved,
  resolveAssignSessionForSegment,
  allowPunchTimeActions,
  openForceClockOut,
  openAdjustTimes,
  handleRejectSession,
  rejectSessionBusyId,
  effectiveSubjectUserId,
  dateStr,
  onPatchSeededSessionsJobBid,
  draftLocalJobBidAssign,
  showApplyScheduleProportions,
  applyScheduleProportionsToCluster,
  showSalariedLabelUnderVisualStrip,
  clockTimesReadOnly,
  effectiveEditable,
  priorWeekGateActive,
  sessionsProp,
  sessionsLoading,
  pendingAuthForFetch,
  setAddDisjointOpen,
  computeAddDisjointDefaults,
}: MyTimeDayTimelineBodyProps) {
  const timelineItems = useMemo(
    () => buildDayTimeline(sortedSessions, nowTick, { splitClustersWithPairwiseOverlap: true }),
    [sortedSessions, nowTick],
  )
  const { dayStartMs, dayEndMs } = useMemo(() => daySpanMs(sortedSessions, nowTick), [sortedSessions, nowTick])
  const totalDur = Math.max(1, dayEndMs - dayStartMs)

  return (
    <div
      className="myTimeDayTimelineScroll"
      style={{
        flex: 1,
        minWidth: 0,
        overflowX: 'hidden',
        overflowY: 'auto',
        minHeight: 260,
        maxHeight: 'min(65vh, 640px)',
        border: myTimeCompactLayout ? 'none' : '1px solid var(--border)',
        borderRadius: myTimeCompactLayout ? 0 : 8,
        padding: myTimeCompactLayout ? 4 : 8,
        display: 'flex',
        flexDirection: 'column',
        gap: myTimeCompactLayout ? 4 : 6,
      }}
    >
      {!editorInitialized ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading editor…</p>
      ) : (
        timelineItems.map((item: DayTimelineItem, idx: number) => {
          if (item.type === 'gap') {
            const flexW = Math.max(0.12, (item.endMs - item.startMs) / totalDur)
            return (
              <div
                key={`gap-${idx}-${item.startMs}`}
                className="myTimeDayGapStrip"
                style={{
                  flex: `${Math.max(0.35, flexW * 6)} 0 auto`,
                  minHeight: 32,
                  padding: '0.35rem 0.5rem',
                  borderRadius: 6,
                  background: 'repeating-linear-gradient(-45deg, var(--bg-muted), var(--bg-muted) 8px, var(--bg-page) 8px, var(--bg-page) 16px)',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                Off clock · {formatDurationMs(item.endMs - item.startMs)}
              </div>
            )
          }

          const c = item.sessions
          const lastS = c[c.length - 1]!
          const clusterId = item.clusterId
          const split = splitByCluster[clusterId]!
          const t0 = item.startMs
          const t1 = item.endMs
          const span = Math.max(1, t1 - t0)
          const flexW = (item.endMs - item.startMs) / totalDur
          const clusterIntervalOverlap = hasPairwiseClockIntervalOverlap(c, nowTick, CLOCK_OVERLAP_WARNING_EPS_MS)
          const nextClusterBlock = getNextSessionClusterInTimeline(timelineItems, idx)
          const formOverlapDividerBelow =
            nextClusterBlock != null &&
            hasPairwiseClockIntervalOverlap([...c, ...nextClusterBlock.sessions], nowTick, CLOCK_OVERLAP_WARNING_EPS_MS)
          const showClusterBottomDivider = idx !== timelineItems.length - 1

          return (
            <Fragment key={clusterId}>
              {clusterIntervalOverlap ? (
                <div
                  role="status"
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text-amber-800)',
                    background: 'var(--bg-amber-tint)',
                    border: '1px solid #f59e0b',
                    borderRadius: 6,
                    padding: '0.45rem 0.6rem',
                    marginBottom: 2,
                  }}
                >
                  <strong style={{ fontWeight: 600 }}>Overlapping clock times</strong>
                  {' — '}
                  adjust boundaries or close one session.
                </div>
              ) : null}
              {layoutMode === 'visual' ? (
                <MyTimeDayClusterVisual
                  clusterId={clusterId}
                  c={c}
                  lastS={lastS}
                  split={split}
                  t0={t0}
                  t1={t1}
                  span={span}
                  flexW={flexW}
                  nowTick={nowTick}
                  saving={saving}
                  jobLabels={mergedJobLabels}
                  bidLabels={mergedBidLabels}
                  setStripEl={(el) => {
                    stripRefs.current[clusterId] = el
                  }}
                  onStripPointerDown={(e) => handleStripPointerDown(clusterId, c, e)}
                  onStripKeyDown={(e) => handleStripKeyDown(clusterId, e)}
                  onStartDrag={(index, ev, undo) => startDrag(clusterId, index, ev, undo)}
                  onFocusHandle={(index) => setFocusedHandle({ clusterId, index })}
                  patchClusterAction={(action) => patchCluster(clusterId, action)}
                  setAssignBulk={setAssignBulk}
                  onAssignJobSaved={handleAssignJobSaved}
                  resolveAssignSession={(segIdx) =>
                    resolveAssignSessionForSegment(clusterId, segIdx)
                  }
                  onRequestMergeJobChoice={(payload) =>
                    openMergeJobChoiceForCluster(clusterId, payload)
                  }
                  onForceClockOut={allowPunchTimeActions && !saving ? openForceClockOut : undefined}
                  onAdjustTimes={allowPunchTimeActions && !saving ? openAdjustTimes : undefined}
                  onRejectSession={allowPunchTimeActions && !saving ? handleRejectSession : undefined}
                  rejectSessionBusyId={rejectSessionBusyId}
                  dispatchScheduleAssigneeUserId={effectiveSubjectUserId ?? undefined}
                  dispatchScheduleWorkDateYmd={dateStr}
                  draftLocalJobBidAssign={
                    onPatchSeededSessionsJobBid ? draftLocalJobBidAssign : undefined
                  }
                  showApplyScheduleProportions={showApplyScheduleProportions}
                  onApplyScheduleProportions={(picks) =>
                    void applyScheduleProportionsToCluster(clusterId, picks)
                  }
                  salariedStripFooterLabel={showSalariedLabelUnderVisualStrip}
                  showClusterBottomDivider={showClusterBottomDivider}
                />
              ) : (
                <MyTimeDayClusterForm
                  clusterId={clusterId}
                  c={c}
                  lastS={lastS}
                  split={split}
                  t0={t0}
                  t1={t1}
                  span={span}
                  flexW={flexW}
                  nowTick={nowTick}
                  saving={saving}
                  jobLabels={mergedJobLabels}
                  bidLabels={mergedBidLabels}
                  segmentTimeInputsReadOnly={clockTimesReadOnly}
                  patchClusterAction={(action) => patchCluster(clusterId, action)}
                  onCommitInnerBoundary={(boundaryIndex, ms) =>
                    commitInnerBoundary(clusterId, boundaryIndex, ms)
                  }
                  setAssignBulk={setAssignBulk}
                  onAssignJobSaved={handleAssignJobSaved}
                  resolveAssignSession={(segIdx) =>
                    resolveAssignSessionForSegment(clusterId, segIdx)
                  }
                  onRequestMergeJobChoice={(payload) =>
                    openMergeJobChoiceForCluster(clusterId, payload)
                  }
                  onForceClockOut={allowPunchTimeActions && !saving ? openForceClockOut : undefined}
                  onAdjustTimes={allowPunchTimeActions && !saving ? openAdjustTimes : undefined}
                  onRejectSession={allowPunchTimeActions && !saving ? handleRejectSession : undefined}
                  rejectSessionBusyId={rejectSessionBusyId}
                  dispatchScheduleAssigneeUserId={effectiveSubjectUserId ?? undefined}
                  dispatchScheduleWorkDateYmd={dateStr}
                  overlapDividerBelow={formOverlapDividerBelow}
                  showClusterBottomDivider={showClusterBottomDivider}
                  draftLocalJobBidAssign={
                    onPatchSeededSessionsJobBid ? draftLocalJobBidAssign : undefined
                  }
                  showApplyScheduleProportions={showApplyScheduleProportions}
                  onApplyScheduleProportions={(picks) =>
                    void applyScheduleProportionsToCluster(clusterId, picks)
                  }
                />
              )}
            </Fragment>
          )
        })
      )}
      {effectiveEditable &&
      allowPunchTimeActions &&
      !priorWeekGateActive &&
      sessionsProp.length === 0 &&
      !sessionsLoading &&
      !pendingAuthForFetch ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: -4,
          }}
        >
          <button
            type="button"
            title="Add a separate clock session to this day"
            aria-label="Add session"
            onClick={() => setAddDisjointOpen(computeAddDisjointDefaults())}
            disabled={saving}
            style={{
              padding: '0.2rem 0.6rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: 'var(--surface)',
              cursor: saving ? 'not-allowed' : 'pointer',
              color: 'var(--text-700)',
              fontSize: '0.75rem',
              lineHeight: 1.2,
            }}
          >
            + Add session
          </button>
        </div>
      ) : null}
    </div>
  )
}
