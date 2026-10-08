import { useCallback, useEffect, useRef, useState } from 'react'
import {
  effectiveSegmentJobBid,
  myTimeClusterMergeBlockedUserMessage,
  myTimeClusterMergeWouldBlockPersist,
  segmentAllocationLabelsForOverlap,
} from '../../lib/myTimeDaySavePlan'
import { comparableSplit, sessionJobBidKey } from '../../lib/myTimeDayEditorDirty'
import {
  expandClustersSplitPairwiseOverlaps,
  finalizeInnerBoundaryMsForCluster,
  groupTimeContiguousSessionClusters,
  initialClusterSplitState,
  mergeSegmentNotes,
  sessionClusterId,
  splitReducer,
  type DayEditorSession,
  type SplitAction,
  type SplitEditorState,
} from '../../lib/myTimeDayTimeline'
import type { MergeJobAllocOption } from './MyTimeMergeSegmentsModal'
import type { useToastContext } from '../../contexts/ToastContext'

export type MergeJobChoiceState = {
  clusterId: string
  direction: 'prev' | 'next'
  segIdx: number
  openLastCluster: boolean
  upperJobLabel: string
  lowerJobLabel: string
  /** Segment merged into: above → upper, below → lower (matches Merge up / Merge down copy). */
  defaultJobChoice: Extract<MergeJobAllocOption, 'upper' | 'lower'>
  upperAlloc: { job_ledger_id: string | null; bid_id: string | null }
  lowerAlloc: { job_ledger_id: string | null; bid_id: string | null }
  initialMergedFocusNote: string
}

export type UseMyTimeSplitEditorInput = {
  sortedSessions: DayEditorSession[]
  /** Ids, times, approval and work date: the split store re-seeds only when this changes (quirk 3). */
  sessionsKey: string
  sessionClusters: DayEditorSession[][]
  nowTick: number
  allowTimelineEdits: boolean
  mergedJobLabels: Record<string, string>
  mergedBidLabels: Record<string, string>
  showToast: ReturnType<typeof useToastContext>['showToast']
}

/**
 * The My Time day editor's split store (map step 7a, `docs/MY_TIME_DAY_EDITOR_MODAL_ARCHITECTURE.md` →
 * region 4 and region 5): each cluster's `SplitEditorState`, the snapshot the dirty gate compares
 * against, the seed and open-session tick effects, `patchCluster` with its merge guard, the inner
 * boundary drag and commit, and the merge-segments job choice. Moved verbatim from
 * `DashboardMyTimeDayEditorModal`; the boundary gestures stay in the shell until step 7b and reach
 * the store through `setSplitByCluster` and the three refs this hook hands out.
 */
export function useMyTimeSplitEditor({
  sortedSessions,
  sessionsKey,
  sessionClusters,
  nowTick,
  allowTimelineEdits,
  mergedJobLabels,
  mergedBidLabels,
  showToast,
}: UseMyTimeSplitEditorInput) {
  const [splitByCluster, setSplitByCluster] = useState<Record<string, SplitEditorState>>({})
  const [initialSnapshot, setInitialSnapshot] = useState<Record<string, string>>({})
  /** Reset when `sessionsKey` changes; used so job-only edits still run persist on Close. */
  const initialJobBidBySessionIdRef = useRef<Record<string, string>>({})

  useEffect(() => {
    const now = Date.now()
    const next: Record<string, SplitEditorState> = {}
    const snap: Record<string, string> = {}
    const jobBid: Record<string, string> = {}
    const clusters = expandClustersSplitPairwiseOverlaps(
      groupTimeContiguousSessionClusters(sortedSessions),
      now,
    )
    for (const c of clusters) {
      const cid = sessionClusterId(c)
      next[cid] = initialClusterSplitState(c, now)
      const last = c[c.length - 1]!
      snap[cid] = comparableSplit(last, next[cid]!)
    }
    for (const s of sortedSessions) {
      jobBid[s.id] = sessionJobBidKey(s)
    }
    initialJobBidBySessionIdRef.current = jobBid
    setSplitByCluster(next)
    setInitialSnapshot(snap)
    // Only re-seed when ids/times/approval/work_date change (`sessionsKey`). Job/bid refresh uses a
    // new `sortedSessions` array ref and must not wipe in-editor splits.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read sortedSessions from render when sessionsKey changes
  }, [sessionsKey])

  useEffect(() => {
    setSplitByCluster((prev) => {
      let changed = false
      const next = { ...prev }
      const now = nowTick
      const clusters = expandClustersSplitPairwiseOverlaps(
        groupTimeContiguousSessionClusters(sortedSessions),
        now,
      )
      for (const c of clusters) {
        const last = c[c.length - 1]!
        if (!last.clocked_out_at) {
          const cid = sessionClusterId(c)
          if (next[cid]) {
            const updated = splitReducer(next[cid]!, { type: 'setLastBoundary', nowMs: now })
            if (JSON.stringify(updated) !== JSON.stringify(next[cid])) {
              next[cid] = updated
              changed = true
            }
          }
        }
      }
      return changed ? next : prev
    })
  }, [nowTick, sortedSessions])

  const patchCluster = useCallback(
    (clusterId: string, action: SplitAction) => {
      if (!allowTimelineEdits) return
      if (action.type === 'removeSegmentMergeWithPrev' || action.type === 'removeSegmentMergeWithNext') {
        const cur = splitByCluster[clusterId]
        const c = sessionClusters.find((x) => sessionClusterId(x) === clusterId)
        if (cur && c?.length && myTimeClusterMergeWouldBlockPersist(c, cur, action)) {
          showToast(myTimeClusterMergeBlockedUserMessage(c), 'error')
          return
        }
      }
      setSplitByCluster((prev) => {
        const cur = prev[clusterId]
        if (!cur) return prev
        return { ...prev, [clusterId]: splitReducer(cur, action) }
      })
    },
    [allowTimelineEdits, splitByCluster, sessionClusters, showToast],
  )

  const applyInnerBoundaryDragMs = useCallback(
    (clusterId: string, boundaryIndex: number, ms: number) => {
      if (!allowTimelineEdits) return
      const c = sessionClustersRef.current.find((x) => sessionClusterId(x) === clusterId)
      setSplitByCluster((prev) => {
        const cur = prev[clusterId]
        if (!cur || !c?.length) return prev
        let next = splitReducer(cur, { type: 'drag', index: boundaryIndex, ms })
        if (boundaryIndex <= 0 || boundaryIndex >= next.boundaries.length - 1) {
          return { ...prev, [clusterId]: next }
        }
        const msAt = next.boundaries[boundaryIndex]!
        const prevB = next.boundaries[boundaryIndex - 1]!
        const nextB = next.boundaries[boundaryIndex + 1]!
        const fin = finalizeInnerBoundaryMsForCluster(c, prevB, nextB, msAt, nowTickRef.current)
        if (fin !== msAt) {
          next = splitReducer(next, { type: 'drag', index: boundaryIndex, ms: fin })
        }
        return { ...prev, [clusterId]: next }
      })
    },
    [allowTimelineEdits],
  )

  const openMergeJobChoiceForCluster = useCallback(
    (clusterId: string, payload: { direction: 'prev' | 'next'; segIdx: number }) => {
      if (!allowTimelineEdits) return
      const c = sessionClusters.find((x) => sessionClusterId(x) === clusterId)
      const split = splitByCluster[clusterId]
      if (!c?.length || !split) return
      const lastS = c[c.length - 1]!
      const openLastCluster = !lastS.clocked_out_at
      const { direction, segIdx } = payload
      const upperSeg = direction === 'prev' ? segIdx - 1 : segIdx
      const lowerSeg = direction === 'prev' ? segIdx : segIdx + 1
      const upperAllocs = segmentAllocationLabelsForOverlap(
        c,
        split,
        nowTick,
        upperSeg,
        mergedJobLabels,
        mergedBidLabels
      )
      const lowerAllocs = segmentAllocationLabelsForOverlap(
        c,
        split,
        nowTick,
        lowerSeg,
        mergedJobLabels,
        mergedBidLabels
      )
      const upperJobLabel = upperAllocs.join(' · ')
      const lowerJobLabel = lowerAllocs.join(' · ')
      const upperAlloc = effectiveSegmentJobBid(c, split, nowTick, upperSeg)
      const lowerAlloc = effectiveSegmentJobBid(c, split, nowTick, lowerSeg)
      const notes = split.notes
      const initialMergedFocusNote =
        direction === 'prev'
          ? mergeSegmentNotes(notes[segIdx - 1] ?? '', notes[segIdx] ?? '')
          : mergeSegmentNotes(notes[segIdx + 1] ?? '', notes[segIdx] ?? '')
      const defaultJobChoice: Extract<MergeJobAllocOption, 'upper' | 'lower'> =
        direction === 'prev' ? 'upper' : 'lower'
      const mergeProbe: SplitAction =
        direction === 'prev'
          ? { type: 'removeSegmentMergeWithPrev', segIndex: segIdx, nowMs: nowTick, openLastCluster }
          : { type: 'removeSegmentMergeWithNext', segIndex: segIdx, nowMs: nowTick, openLastCluster }
      if (myTimeClusterMergeWouldBlockPersist(c, split, mergeProbe)) {
        showToast(myTimeClusterMergeBlockedUserMessage(c), 'error')
        return
      }
      setMergeJobChoice({
        clusterId,
        direction,
        segIdx,
        openLastCluster,
        upperJobLabel,
        lowerJobLabel,
        defaultJobChoice,
        upperAlloc,
        lowerAlloc,
        initialMergedFocusNote,
      })
    },
    [allowTimelineEdits, sessionClusters, splitByCluster, nowTick, mergedJobLabels, mergedBidLabels, showToast]
  )

  const confirmMergeJobChoice = useCallback((choice: MergeJobAllocOption, mergedFocusNote: string) => {
    const text = mergedFocusNote.trim()
    setMergeJobChoice((m) => {
      if (!m) return null
      const { clusterId, direction, segIdx, openLastCluster, upperAlloc, lowerAlloc } = m
      const mergeAction: SplitAction =
        direction === 'prev'
          ? {
              type: 'removeSegmentMergeWithPrev',
              segIndex: segIdx,
              nowMs: nowTick,
              openLastCluster,
            }
          : {
              type: 'removeSegmentMergeWithNext',
              segIndex: segIdx,
              nowMs: nowTick,
              openLastCluster,
            }
      const absorberIdx = direction === 'prev' ? segIdx - 1 : segIdx
      const picked =
        choice === 'upper'
          ? upperAlloc
          : choice === 'lower'
            ? lowerAlloc
            : { job_ledger_id: null as string | null, bid_id: null as string | null }
      setSplitByCluster((prev) => {
        const cur = prev[clusterId]
        if (!cur) return prev
        let next = splitReducer(cur, mergeAction)
        next = splitReducer(next, {
          type: 'setSegmentJobOverride',
          segIndex: absorberIdx,
          job_ledger_id: picked.job_ledger_id,
          bid_id: picked.bid_id,
        })
        next = splitReducer(next, { type: 'setNote', index: absorberIdx, text })
        return { ...prev, [clusterId]: next }
      })
      return null
    })
  }, [nowTick])

  const commitInnerBoundary = useCallback((clusterId: string, boundaryIndex: number, ms: number) => {
    if (!allowTimelineEdits) return
    setSplitByCluster((prev) => {
      const s0 = prev[clusterId]
      const c = sessionClustersRef.current.find((x) => sessionClusterId(x) === clusterId)
      if (!s0 || !c?.length) return prev
      if (boundaryIndex <= 0 || boundaryIndex >= s0.boundaries.length - 1) return prev
      let next = splitReducer(s0, { type: 'drag', index: boundaryIndex, ms })
      const msAt = next.boundaries[boundaryIndex]!
      const prevB = next.boundaries[boundaryIndex - 1]!
      const nextB = next.boundaries[boundaryIndex + 1]!
      const fin = finalizeInnerBoundaryMsForCluster(c, prevB, nextB, msAt, nowTickRef.current)
      if (fin !== msAt) {
        next = splitReducer(next, { type: 'drag', index: boundaryIndex, ms: fin })
      }
      return { ...prev, [clusterId]: next }
    })
  }, [allowTimelineEdits])

  const splitByClusterRef = useRef(splitByCluster)
  const sessionClustersRef = useRef(sessionClusters)
  const nowTickRef = useRef(nowTick)
  splitByClusterRef.current = splitByCluster
  sessionClustersRef.current = sessionClusters
  nowTickRef.current = nowTick
  const [mergeJobChoice, setMergeJobChoice] = useState<MergeJobChoiceState | null>(null)

  return {
    splitByCluster,
    setSplitByCluster,
    initialSnapshot,
    initialJobBidBySessionIdRef,
    patchCluster,
    applyInnerBoundaryDragMs,
    openMergeJobChoiceForCluster,
    confirmMergeJobChoice,
    commitInnerBoundary,
    mergeJobChoice,
    setMergeJobChoice,
    splitByClusterRef,
    sessionClustersRef,
    nowTickRef,
  }
}
