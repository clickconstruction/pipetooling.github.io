import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clampStripY,
  cloneSplitState,
  clusterStripRangeMs,
  finalizeInnerBoundaryMsForCluster,
  internalRowJoinMs,
  repairMixedClusterSplitForRowContainment,
  ROW_JOIN_SNAP_MS,
  sessionClusterId,
  snapTapMsToNearestJoin,
  splitReducer,
  stripDragYToMs,
  stripYToMs,
  type DayEditorSession,
  type SplitEditorState,
} from '../../lib/myTimeDayTimeline'
import type { useMyTimeSplitEditor } from './useMyTimeSplitEditor'

/** Ignore strip «tap» if the pointer moved more than this (avoids add-split on slight drags). */
const STRIP_TAP_MOVE_THRESHOLD_PX = 8

/** Applied to `document.body` while dragging a Visual split boundary (`grabbing` cursor, teardown). */
const MY_TIME_BOUNDARY_DRAG_BODY_CLASS = 'my-time-boundary-dragging'

type StripTapSession = {
  clusterId: string
  sessions: DayEditorSession[]
  startX: number
  startY: number
  cancelled: boolean
  pointerId: number
  stripEl: HTMLDivElement
}

export type UseMyTimeBoundaryGesturesInput = Pick<
  ReturnType<typeof useMyTimeSplitEditor>,
  'setSplitByCluster' | 'patchCluster' | 'applyInnerBoundaryDragMs' | 'splitByClusterRef' | 'sessionClustersRef' | 'nowTickRef'
> & {
  allowTimelineEdits: boolean
  saving: boolean
  nowTick: number
  sessionClusters: DayEditorSession[][]
  layoutMode: 'visual' | 'form'
}

/**
 * The My Time day editor's boundary gestures (map step 7b, `docs/MY_TIME_DAY_EDITOR_MODAL_ARCHITECTURE.md`
 * → region 4): the strip refs, the boundary drag (relative pointer delta, quirk 9) and its cancel, the
 * strip tap that adds a split, Alt/Option+click on the focused boundary (quirk 10), the Arrow-key
 * nudge, the layout-mode reset and the unmount teardown. Moved verbatim from
 * `DashboardMyTimeDayEditorModal`; it writes the split store only through the setters and refs
 * `useMyTimeSplitEditor` hands out.
 */
export function useMyTimeBoundaryGestures({
  allowTimelineEdits,
  saving,
  nowTick,
  sessionClusters,
  layoutMode,
  setSplitByCluster,
  patchCluster,
  applyInnerBoundaryDragMs,
  splitByClusterRef,
  sessionClustersRef,
  nowTickRef,
}: UseMyTimeBoundaryGesturesInput) {
  const stripRefs = useRef<Record<string, HTMLDivElement | null>>({})
  type DragCtx = {
    clusterId: string
    index: number
    pointerId: number
    captureEl: Element
    undo: SplitEditorState
    /** Strip-local Y at pointerdown (`clientY - strip.getBoundingClientRect().top`). Matches how the strip maps time to % top. */
    grabStripY: number
    /** Boundary ms at pointerdown (matches undo.boundaries[index]). */
    originBoundaryMs: number
  }
  const dragRef = useRef<DragCtx | null>(null)
  const stripTapSessionRef = useRef<StripTapSession | null>(null)
  const pointerMoveRef = useRef<(e: PointerEvent) => void>(() => {})
  const stripTapMoveRef = useRef<(e: PointerEvent) => void>(() => {})
  const stripTapEndRef = useRef<(e: PointerEvent) => void>(() => {})
  const [focusedHandle, setFocusedHandle] = useState<{ clusterId: string; index: number } | null>(null)
  const focusedHandleRef = useRef<{ clusterId: string; index: number } | null>(null)
  focusedHandleRef.current = focusedHandle

  const stableWindowPointerMove = useCallback((e: PointerEvent) => {
    pointerMoveRef.current(e)
  }, [])

  const stableStripTapMove = useCallback((e: PointerEvent) => {
    stripTapMoveRef.current(e)
  }, [])

  const stableStripTapEnd = useCallback((e: PointerEvent) => {
    stripTapEndRef.current(e)
  }, [])

  pointerMoveRef.current = (e: PointerEvent) => {
    const ctx = dragRef.current
    if (!ctx) return
    const { clusterId, index } = ctx
    const el = stripRefs.current[clusterId]
    const split = splitByClusterRef.current[clusterId]
    const c = sessionClustersRef.current.find((x) => sessionClusterId(x) === clusterId)
    if (!el || !split || !c?.length) return
    const rect = el.getBoundingClientRect()
    const ms = stripDragYToMs({
      y: e.clientY - rect.top,
      grabY: ctx.grabStripY,
      originMs: ctx.originBoundaryMs,
      height: rect.height,
      ...clusterStripRangeMs(c, nowTickRef.current),
    })
    applyInnerBoundaryDragMs(clusterId, index, ms)
  }

  stripTapMoveRef.current = (e: PointerEvent) => {
    const s = stripTapSessionRef.current
    if (!s || e.pointerId !== s.pointerId) return
    const dx = e.clientX - s.startX
    const dy = e.clientY - s.startY
    if (Math.hypot(dx, dy) > STRIP_TAP_MOVE_THRESHOLD_PX) s.cancelled = true
  }

  const cancelStripTapGesture = useCallback(() => {
    const s = stripTapSessionRef.current
    if (!s) return
    stripTapSessionRef.current = null
    try {
      s.stripEl.releasePointerCapture(s.pointerId)
    } catch {
      /* already released or unsupported */
    }
    window.removeEventListener('pointermove', stableStripTapMove)
    window.removeEventListener('pointerup', stableStripTapEnd)
    window.removeEventListener('pointercancel', stableStripTapEnd)
  }, [stableStripTapMove, stableStripTapEnd])

  const cancelStripTapGestureRef = useRef(cancelStripTapGesture)
  cancelStripTapGestureRef.current = cancelStripTapGesture

  stripTapEndRef.current = (e: PointerEvent) => {
    const s = stripTapSessionRef.current
    if (!s || e.pointerId !== s.pointerId) return
    const wasCancelled = s.cancelled
    const { clusterId, sessions } = s
    const stripEl = s.stripEl
    cancelStripTapGesture()

    if (saving) return
    if (wasCancelled) return

    const c = sessions
    const rect = stripEl.getBoundingClientRect()
    const ms = stripYToMs({
      y: e.clientY - rect.top,
      height: rect.height,
      ...clusterStripRangeMs(c, nowTick),
    })
    const joins = internalRowJoinMs(c, nowTick)
    const msSnap = snapTapMsToNearestJoin(ms, joins, ROW_JOIN_SNAP_MS)
    setSplitByCluster((prev) => {
      const cur = prev[clusterId]
      if (!cur) return prev
      let next = splitReducer(cur, { type: 'addSplitAt', ms: msSnap })
      next = repairMixedClusterSplitForRowContainment(c, next, nowTick)
      return { ...prev, [clusterId]: next }
    })
  }

  const endBoundaryDragListenersRef = useRef(() => {})
  /** Stable identity for window pointerup/pointercancel so add/removeEventListener always pairs; implementation via ref. */
  const stableBoundaryDragPointerUp = useCallback(() => {
    endBoundaryDragListenersRef.current()
  }, [])

  const endBoundaryDragListeners = useCallback(() => {
    const ctx = dragRef.current
    if (ctx) {
      try {
        ctx.captureEl.releasePointerCapture(ctx.pointerId)
      } catch {
        /* already released or unsupported */
      }
    }
    dragRef.current = null
    window.removeEventListener('pointermove', stableWindowPointerMove)
    window.removeEventListener('pointerup', stableBoundaryDragPointerUp)
    window.removeEventListener('pointercancel', stableBoundaryDragPointerUp)
    document.body.classList.remove(MY_TIME_BOUNDARY_DRAG_BODY_CLASS)

    if (!ctx) return
    const { clusterId, index } = ctx
    const split = splitByClusterRef.current[clusterId]
    const c = sessionClustersRef.current.find((x) => sessionClusterId(x) === clusterId)
    if (!split || !c?.length) return
    if (index <= 0 || index >= split.boundaries.length - 1) return

    const ms = split.boundaries[index]!
    const prevB = split.boundaries[index - 1]!
    const nextB = split.boundaries[index + 1]!
    const fin = finalizeInnerBoundaryMsForCluster(c, prevB, nextB, ms, nowTickRef.current)
    if (fin !== ms) {
      patchCluster(clusterId, { type: 'drag', index, ms: fin })
    }
  }, [patchCluster, stableBoundaryDragPointerUp, stableWindowPointerMove, nowTickRef, sessionClustersRef, splitByClusterRef])

  endBoundaryDragListenersRef.current = endBoundaryDragListeners

  useEffect(() => {
    cancelStripTapGestureRef.current()
    endBoundaryDragListenersRef.current()
    setFocusedHandle(null)
  }, [layoutMode])

  const cancelBoundaryDrag = useCallback(() => {
    const ctx = dragRef.current
    if (!ctx) return
    const { clusterId, undo } = ctx
    try {
      ctx.captureEl.releasePointerCapture(ctx.pointerId)
    } catch {
      /* */
    }
    dragRef.current = null
    window.removeEventListener('pointermove', stableWindowPointerMove)
    window.removeEventListener('pointerup', stableBoundaryDragPointerUp)
    window.removeEventListener('pointercancel', stableBoundaryDragPointerUp)
    document.body.classList.remove(MY_TIME_BOUNDARY_DRAG_BODY_CLASS)
    setSplitByCluster((prev) => {
      if (!prev[clusterId]) return prev
      return { ...prev, [clusterId]: cloneSplitState(undo) }
    })
    setFocusedHandle(null)
  }, [stableBoundaryDragPointerUp, stableWindowPointerMove, setSplitByCluster])

  const startDrag = useCallback(
    (clusterId: string, index: number, ev: React.PointerEvent<HTMLButtonElement>, undo: SplitEditorState) => {
      if (!allowTimelineEdits) return
      const stripEl = stripRefs.current[clusterId]
      if (!stripEl) return
      const captureEl = ev.currentTarget
      const rect0 = stripEl.getBoundingClientRect()
      const grabStripY = clampStripY(ev.clientY - rect0.top, rect0.height)
      dragRef.current = {
        clusterId,
        index,
        pointerId: ev.pointerId,
        captureEl,
        undo,
        grabStripY,
        originBoundaryMs: undo.boundaries[index]!,
      }
      try {
        captureEl.setPointerCapture(ev.pointerId)
      } catch {
        /* ignore */
      }
      document.body.classList.add(MY_TIME_BOUNDARY_DRAG_BODY_CLASS)
      window.addEventListener('pointermove', stableWindowPointerMove)
      window.addEventListener('pointerup', stableBoundaryDragPointerUp)
      window.addEventListener('pointercancel', stableBoundaryDragPointerUp)
    },
    [allowTimelineEdits, stableBoundaryDragPointerUp, stableWindowPointerMove]
  )

  const handleStripPointerDown = useCallback(
    (clusterId: string, c: DayEditorSession[], ev: React.PointerEvent<HTMLDivElement>) => {
      if (!allowTimelineEdits || saving) return
      if (!ev.isPrimary || ev.button !== 0) return
      if ((ev.target as HTMLElement).closest('button[data-boundary-handle]')) return

      if (stripTapSessionRef.current) {
        cancelStripTapGesture()
      }

      /** Alt/Option+click strip: move focused inner boundary to click Y. Plain click (and Shift+click) use add-split tap. */
      if (ev.altKey && !dragRef.current) {
        const fh = focusedHandleRef.current
        if (fh?.clusterId === clusterId) {
          const split = splitByClusterRef.current[clusterId]
          const idx = fh.index
          if (
            split &&
            idx > 0 &&
            idx < split.boundaries.length - 1
          ) {
            const stripEl = ev.currentTarget
            const rect = stripEl.getBoundingClientRect()
            const ms = stripYToMs({
              y: ev.clientY - rect.top,
              height: rect.height,
              ...clusterStripRangeMs(c, nowTickRef.current),
            })
            setSplitByCluster((prev) => {
              const s0 = prev[clusterId]
              if (!s0) return prev
              let next = splitReducer(s0, { type: 'drag', index: idx, ms })
              const msAt = next.boundaries[idx]!
              const prevB = next.boundaries[idx - 1]!
              const nextB = next.boundaries[idx + 1]!
              const fin = finalizeInnerBoundaryMsForCluster(c, prevB, nextB, msAt, nowTickRef.current)
              if (fin !== msAt) {
                next = splitReducer(next, { type: 'drag', index: idx, ms: fin })
              }
              return { ...prev, [clusterId]: next }
            })
            ev.preventDefault()
            return
          }
        }
      }

      const stripEl = ev.currentTarget
      stripTapSessionRef.current = {
        clusterId,
        sessions: c,
        startX: ev.clientX,
        startY: ev.clientY,
        cancelled: false,
        pointerId: ev.pointerId,
        stripEl,
      }
      try {
        stripEl.setPointerCapture(ev.pointerId)
      } catch {
        /* ignore */
      }
      window.addEventListener('pointermove', stableStripTapMove)
      window.addEventListener('pointerup', stableStripTapEnd)
      window.addEventListener('pointercancel', stableStripTapEnd)
    },
    [allowTimelineEdits, cancelStripTapGesture, saving, stableStripTapMove, stableStripTapEnd, nowTickRef, setSplitByCluster, splitByClusterRef]
  )

  useEffect(
    () => () => {
      const ctx = dragRef.current
      if (ctx) {
        try {
          ctx.captureEl.releasePointerCapture(ctx.pointerId)
        } catch {
          /* */
        }
      }
      dragRef.current = null
      window.removeEventListener('pointermove', stableWindowPointerMove)
      window.removeEventListener('pointerup', stableBoundaryDragPointerUp)
      window.removeEventListener('pointercancel', stableBoundaryDragPointerUp)
      document.body.classList.remove(MY_TIME_BOUNDARY_DRAG_BODY_CLASS)

      if (stripTapSessionRef.current) {
        const s = stripTapSessionRef.current
        stripTapSessionRef.current = null
        try {
          s.stripEl.releasePointerCapture(s.pointerId)
        } catch {
          /* */
        }
        window.removeEventListener('pointermove', stableStripTapMove)
        window.removeEventListener('pointerup', stableStripTapEnd)
        window.removeEventListener('pointercancel', stableStripTapEnd)
      }
    },
    [stableBoundaryDragPointerUp, stableStripTapEnd, stableStripTapMove, stableWindowPointerMove]
  )

  function handleStripKeyDown(clusterId: string, e: React.KeyboardEvent) {
    if (!allowTimelineEdits) return
    const fh = focusedHandle
    if (!fh || fh.clusterId !== clusterId) return
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const delta = (e.key === 'ArrowUp' ? -1 : 1) * 60 * 1000
    setSplitByCluster((prev) => {
      const split = prev[clusterId]
      if (!split) return prev
      const c = sessionClusters.find((x) => sessionClusterId(x) === clusterId)
      if (!c?.length) return prev
      let next = splitReducer(split, { type: 'nudge', index: fh.index, deltaMs: delta })
      const idx = fh.index
      if (idx > 0 && idx < next.boundaries.length - 1) {
        const ms = next.boundaries[idx]!
        const prevB = next.boundaries[idx - 1]!
        const nextB = next.boundaries[idx + 1]!
        const fin = finalizeInnerBoundaryMsForCluster(c, prevB, nextB, ms, nowTick)
        if (fin !== ms) {
          next = splitReducer(next, { type: 'drag', index: idx, ms: fin })
        }
      }
      return { ...prev, [clusterId]: next }
    })
  }

  return {
    stripRefs,
    dragRef,
    stripTapSessionRef,
    focusedHandle,
    setFocusedHandle,
    cancelStripTapGesture,
    cancelBoundaryDrag,
    startDrag,
    handleStripPointerDown,
    handleStripKeyDown,
  }
}
