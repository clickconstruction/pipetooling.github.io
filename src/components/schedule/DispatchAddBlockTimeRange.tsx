import { useCallback, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import {
  dispatchMinutesToFractionalSlotIndex,
  dispatchSlotIndexToMinutes,
  formatDispatchQuickTimeLabel,
  dispatchMinutesToHHmm,
  MAX_MIN,
  MIN_MIN,
} from '@/lib/dispatchAddBlockTime'
import { DOT_DRAG_SNAP_MINUTES, type BoundaryDot } from '@/lib/dayScheduleDotDrag'

const THUMB_PX = 22
const THUMB_HALF = THUMB_PX / 2

/** 04:00–20:00 Central in 30m steps: 8 AM, 12 PM, 4 PM slot indices (Dispatch modal grid). */
export const DISPATCH_ADD_BLOCK_ORIENTATION_MARKS: ReadonlyArray<{ slotIndex: number; label: string }> = [
  { slotIndex: 8, label: '8 AM' },
  { slotIndex: 16, label: '12 PM' },
  { slotIndex: 24, label: '4 PM' },
]

type RailWindow = { loSlotIndex: number; hiSlotIndex: number } | null | undefined

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/**
 * Forward map: slot index → fraction (0..1) along the visible track.
 *
 * - When `window` is `undefined` or `null`, the slot range
 *   `[0, slotCount - 1]` is mapped linearly across the whole track.
 * - When `window` is `{ loSlotIndex, hiSlotIndex }`, the slot range
 *   `[lo, hi]` is stretched edge-to-edge across the track so the User
 *   Review modal can magnify the active part of the day. Inputs are
 *   clamped to `[lo, hi]` so out-of-window slots collapse to the
 *   window edge (kept defensive — the User Review orchestrators only
 *   pass windows that contain every band they render).
 */
function slotToTrackT(slotIndex: number, slotCount: number, window: RailWindow): number {
  const maxIdx = Math.max(0, slotCount - 1)
  if (maxIdx === 0) return 0
  if (!window) {
    return clampInt(slotIndex / maxIdx, 0, 1)
  }
  const lo = Math.max(0, Math.min(window.loSlotIndex, maxIdx))
  const hi = Math.max(lo, Math.min(window.hiSlotIndex, maxIdx))
  if (hi === lo) return 0
  const clamped = Math.max(lo, Math.min(slotIndex, hi))
  return (clamped - lo) / (hi - lo)
}

/** Inverse of `slotToTrackT`: track fraction (0..1) → slot index. */
function trackTToSlotIndex(t: number, slotCount: number, window: RailWindow): number {
  const maxIdx = Math.max(0, slotCount - 1)
  if (maxIdx === 0) return 0
  const tt = clampInt(t, 0, 1)
  if (!window) {
    return clampInt(Math.round(tt * maxIdx), 0, maxIdx)
  }
  const lo = Math.max(0, Math.min(window.loSlotIndex, maxIdx))
  const hi = Math.max(lo, Math.min(window.hiSlotIndex, maxIdx))
  if (hi === lo) return lo
  return clampInt(Math.round(lo + tt * (hi - lo)), 0, maxIdx)
}

/**
 * Same horizontal position as range thumbs / occupied bands for a given slot.
 *
 * `window` is optional; default-undefined preserves existing Quickfill /
 * Schedule Dispatch callsites that don't rescale. User Review threads
 * `railTrimWindow` through so labels/bands land at their wall-time x in
 * the rescaled strip.
 */
export function dispatchAddBlockTrackThumbLeftPct(
  slotIndex: number,
  slotCount: number,
  window?: RailWindow,
): string {
  const maxIdx = Math.max(0, slotCount - 1)
  if (maxIdx === 0) return '50%'
  const t = slotToTrackT(slotIndex, slotCount, window)
  return `calc(${THUMB_HALF}px + (100% - ${THUMB_PX}px) * ${t})`
}

function clientXToSlotIndex(
  clientX: number,
  rect: DOMRect,
  slotCount: number,
  window: RailWindow,
): number {
  const maxIdx = Math.max(0, slotCount - 1)
  if (maxIdx === 0) return 0
  const usableW = rect.width - 2 * THUMB_HALF
  const usableLeft = rect.left + THUMB_HALF
  const t = usableW <= 0 ? 0 : clampInt((clientX - usableLeft) / usableW, 0, 1)
  return trackTToSlotIndex(t, slotCount, window)
}

/**
 * Linear map across the track to dispatch wall minutes (4:00–20:00).
 *
 * When `window` is provided the visible strip spans only
 * `[dispatchSlotIndexToMinutes(lo), dispatchSlotIndexToMinutes(hi)]`,
 * so a pointer at the right edge resolves to `hi`'s wall-time rather
 * than 8 PM. User Review strips are read-only so this is defensive
 * insurance against a future interactive caller threading a window.
 */
function clientXToDispatchMinutes(
  clientX: number,
  rect: DOMRect,
  slotCount: number,
  window: RailWindow,
): number {
  const usableW = rect.width - 2 * THUMB_HALF
  const usableLeft = rect.left + THUMB_HALF
  const t = usableW <= 0 ? 0 : clampInt((clientX - usableLeft) / usableW, 0, 1)
  if (!window) {
    return Math.round(MIN_MIN + t * (MAX_MIN - MIN_MIN))
  }
  const maxIdx = Math.max(0, slotCount - 1)
  if (maxIdx === 0) return MIN_MIN
  const lo = Math.max(0, Math.min(window.loSlotIndex, maxIdx))
  const hi = Math.max(lo, Math.min(window.hiSlotIndex, maxIdx))
  const loMin = dispatchSlotIndexToMinutes(lo)
  const hiMin = dispatchSlotIndexToMinutes(hi)
  return Math.round(loMin + t * (hiMin - loMin))
}

function thumbPixelX(
  startSlotIndex: number,
  endSlotIndex: number,
  slotCount: number,
  rect: DOMRect,
  window: RailWindow,
): {
  startX: number
  endX: number
  usableLeft: number
  usableW: number
} {
  const usableW = rect.width - 2 * THUMB_HALF
  const usableLeft = rect.left + THUMB_HALF
  const startT = slotToTrackT(startSlotIndex, slotCount, window)
  const endT = slotToTrackT(endSlotIndex, slotCount, window)
  return {
    startX: usableLeft + startT * usableW,
    endX: usableLeft + endT * usableW,
    usableLeft,
    usableW,
  }
}

export type DispatchOccupiedBand = {
  blockId: string
  label: string
  startSlotIndex: number
  endSlotIndex: number
  /** When set with `onOccupiedBandClick`, Quickfill can navigate to Schedule Dispatch for this job. */
  jobId?: string
}

/** Read-only strip under the rail (e.g. clock sessions); same slot geometry as occupied bands. */
export type DispatchSecondaryBand = {
  id: string
  startSlotIndex: number
  endSlotIndex: number
  label?: string
  /** One-line job + notes (ellipsis); full times stay in `label` / `title`. */
  displayLabel?: string
  /** Roster user for opening My Time (Quickfill). */
  sessionUserId?: string
}

/** Schedule blocks and clock-session strips use the same bar height and label size (Quickfill Schedule). */
const DISPATCH_TIMELINE_STRIP_BAR_HEIGHT_PX = 8
const DISPATCH_TIMELINE_STRIP_LABEL_FONT_SIZE = '0.65rem' as const

/** Space reserved below primary rail when secondary bands use bottom anchoring (no occupied blocks). */
const SECONDARY_STRIP_EXTRA_BASE_PX = 8
/** Extra height for session displayLabel row. */
const SECONDARY_STRIP_LABEL_ADDON_PX = 10
/** Rail is top: trackCenterTop (38 when occupied), marginTop -3, height 6 → lower edge at 41px. */
const SECONDARY_ANCHOR_TOP_BELOW_RAIL_OCCUPIED = 41

export type DispatchAddBlockTimeRangeProps = {
  slotCount: number
  startSlotIndex: number
  endSlotIndex: number
  onStartChange: (slotIndex: number) => void
  onEndChange: (slotIndex: number) => void
  formatAriaValue: (slotIndex: number) => string
  disabled?: boolean
  groupAriaLabel: string
  /** Tighter vertical padding below the track (e.g. Schedule job modal); default spacing unchanged in Dispatch. */
  compact?: boolean
  /** Existing blocks on this day (person); draggable when `onOccupiedAbsoluteStart` is set. */
  occupiedBands?: DispatchOccupiedBand[]
  /** While dragging an occupied band, parent applies overlap logic and updates drafts. */
  onOccupiedAbsoluteStart?: (blockId: string, desiredStartMin: number) => void
  /** When set without `onOccupiedAbsoluteStart`, occupied bands open the job (e.g. navigate to Schedule Dispatch). */
  onOccupiedBandClick?: (band: DispatchOccupiedBand) => void
  /** When false, 8 AM / 12 PM / 4 PM row below the track is omitted (e.g. shared header in Quickfill). */
  showOrientationLabels?: boolean
  /** When false, omits the light-blue fill and start/end thumbs (first-gap “new block” preview). Use for read-only schedule strips. */
  showProposedRange?: boolean
  /** Optional second layer below the gray rail (non-interactive), e.g. clock punches on Quickfill Schedule. */
  secondaryBands?: DispatchSecondaryBand[]
  /** When set, secondary bands are clickable (e.g. open My Time); use `stopPropagation` so the range control does not capture. */
  onSecondaryBandClick?: (band: DispatchSecondaryBand) => void
  /**
   * Day-view boundary dots at block edges (see lib/dayScheduleDotDrag). When
   * set with the drag callbacks, dots are draggable in 15-minute steps; a
   * `shared` dot (two touching blocks) also supports click-and-hold to
   * separate. Parent owns drafts/persistence.
   */
  boundaryDots?: BoundaryDot[]
  /** Live during a dot drag (and per keyboard nudge): parent resolves + drafts. */
  onBoundaryDotDrag?: (dot: BoundaryDot, targetMinutes: number) => void
  /** Pointer released after a dot drag: parent persists the draft. */
  onBoundaryDotDragEnd?: () => void
  /** Click-and-hold on a shared dot: parent separates the later block +15m. */
  onSharedDotSeparate?: (dot: Extract<BoundaryDot, { kind: 'shared' }>) => void
  /**
   * Clips the grey rail underlay to a slot fraction of the track.
   * - `undefined` (default): rail spans the full track (existing behavior).
   * - `null`: rail is hidden entirely (use for empty-view rows where no
   *   bands exist anywhere in the surrounding view).
   * - `{ loSlotIndex, hiSlotIndex }`: rail spans only that slot range.
   *
   * Bands, thumbs, proposed-range fill, orientation labels, and click
   * handlers are **not** affected — they stay on the full track so
   * wall-time x-coordinates remain consistent across rows that share a
   * trim window (used by the User Review modal to align per-day rails).
   */
  railTrimWindow?: { loSlotIndex: number; hiSlotIndex: number } | null
}

/**
 * Dual-thumb discrete range on one track. Slot indices 0 .. slotCount-1 map to caller’s wall times.
 * Track clicks use nearest-thumb rule (see pointer handler).
 */
export function DispatchAddBlockTimeRange({
  slotCount,
  startSlotIndex,
  endSlotIndex,
  onStartChange,
  onEndChange,
  formatAriaValue,
  disabled = false,
  groupAriaLabel,
  compact = false,
  occupiedBands,
  onOccupiedAbsoluteStart,
  onOccupiedBandClick,
  showOrientationLabels = true,
  showProposedRange = true,
  secondaryBands,
  onSecondaryBandClick,
  boundaryDots,
  onBoundaryDotDrag,
  onBoundaryDotDragEnd,
  onSharedDotSeparate,
  railTrimWindow,
}: DispatchAddBlockTimeRangeProps) {
  const regionRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  /** Which thumb is being dragged; nearest-thumb when dragging from track */
  const dragModeRef = useRef<'start' | 'end' | null>(null)
  const occDragRef = useRef<{
    blockId: string
    pointerId: number
    grabOffsetMin: number
  } | null>(null)
  const [activeThumb, setActiveThumb] = useState<'start' | 'end' | null>(null)
  /** Boundary-dot drag bookkeeping; long-press timer only arms on shared dots. */
  const dotDragRef = useRef<{
    key: string
    dot: BoundaryDot
    pointerId: number
    downX: number
    moved: boolean
    longPressFired: boolean
    timer: ReturnType<typeof setTimeout> | null
  } | null>(null)
  const [activeDotKey, setActiveDotKey] = useState<string | null>(null)

  const boundaryDotKey = (d: BoundaryDot): string =>
    d.kind === 'shared' ? `shared:${d.beforeBlockId}:${d.afterBlockId}` : `${d.kind}:${d.blockId}`

  const finishDotDrag = useCallback(
    (e: PointerEvent) => {
      const st = dotDragRef.current
      if (!st || st.pointerId !== e.pointerId) return
      if (st.timer != null) clearTimeout(st.timer)
      dotDragRef.current = null
      setActiveDotKey(null)
      const el = e.currentTarget as HTMLElement | null
      if (el?.hasPointerCapture(e.pointerId)) {
        try {
          el.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }
      if (!st.longPressFired) onBoundaryDotDragEnd?.()
    },
    [onBoundaryDotDragEnd],
  )

  const maxIdx = Math.max(0, slotCount - 1)
  const paintLo = Math.min(startSlotIndex, endSlotIndex)
  const paintHi = Math.max(startSlotIndex, endSlotIndex)
  const hasOccupied = (occupiedBands?.length ?? 0) > 0
  const hasSecondary = (secondaryBands?.length ?? 0) > 0
  const hasSecondaryDisplayLabel = Boolean(secondaryBands?.some((b) => Boolean(b.displayLabel?.trim())))
  const secondaryReservePx = hasSecondary
    ? SECONDARY_STRIP_EXTRA_BASE_PX + (hasSecondaryDisplayLabel ? SECONDARY_STRIP_LABEL_ADDON_PX : 0)
    : 0
  const trackH =
    (hasOccupied ? 50 : 36) +
    (hasSecondary && !hasOccupied ? secondaryReservePx : 0) +
    (hasSecondary && hasOccupied
      ? Math.max(
          0,
          SECONDARY_ANCHOR_TOP_BELOW_RAIL_OCCUPIED +
            (hasSecondaryDisplayLabel ? 13 : 0) +
            DISPATCH_TIMELINE_STRIP_BAR_HEIGHT_PX +
            2 -
            (hasOccupied ? 50 : 36),
        )
      : 0)
  const trackCenterTop = hasOccupied ? 38 : '50%'

  const clearDrag = useCallback((e: PointerEvent) => {
    dragModeRef.current = null
    occDragRef.current = null
    setActiveThumb(null)
    const el = regionRef.current
    if (el?.hasPointerCapture(e.pointerId)) {
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
  }, [])

  const applyDrag = useCallback(
    (e: PointerEvent, mode: 'start' | 'end') => {
      const el = trackRef.current
      if (!el || disabled) return
      const rect = el.getBoundingClientRect()
      const idx = clientXToSlotIndex(e.clientX, rect, slotCount, railTrimWindow)
      if (mode === 'start') onStartChange(idx)
      else onEndChange(idx)
    },
    [disabled, onEndChange, onStartChange, slotCount, railTrimWindow],
  )

  const onRegionPointerDown = (e: PointerEvent) => {
    if (disabled || e.button !== 0) return
    const track = trackRef.current
    const regionEl = regionRef.current
    if (!track || !regionEl) return

    const target = e.target as HTMLElement | null
    const occEl = target?.closest('[data-occupied-block]')
    const occId = occEl?.getAttribute('data-occupied-block')
    if (occId && onOccupiedAbsoluteStart && occupiedBands && !disabled) {
      const band = occupiedBands.find((b) => b.blockId === occId)
      if (!band) return
      const rect = track.getBoundingClientRect()
      const minuteAtDown = clientXToDispatchMinutes(e.clientX, rect, slotCount, railTrimWindow)
      const lo = Math.min(band.startSlotIndex, band.endSlotIndex)
      const blockStartMin = dispatchSlotIndexToMinutes(lo)
      const grabOffsetMin = minuteAtDown - blockStartMin
      occDragRef.current = {
        blockId: occId,
        pointerId: e.pointerId,
        grabOffsetMin,
      }
      regionEl.setPointerCapture(e.pointerId)
      onOccupiedAbsoluteStart(occId, minuteAtDown - grabOffsetMin)
      e.preventDefault()
      e.stopPropagation()
      return
    }

    const thumbEl = target?.closest('[data-thumb]')
    const dataThumb = thumbEl?.getAttribute('data-thumb')

    let mode: 'start' | 'end'
    if (dataThumb === 'start' || dataThumb === 'end') {
      mode = dataThumb
    } else {
      // Nearest thumb along the track (pixel space)
      const rect = track.getBoundingClientRect()
      const { startX, endX } = thumbPixelX(startSlotIndex, endSlotIndex, slotCount, rect, railTrimWindow)
      const x = e.clientX
      mode = Math.abs(x - startX) <= Math.abs(x - endX) ? 'start' : 'end'
    }

    dragModeRef.current = mode
    setActiveThumb(mode)
    regionEl.setPointerCapture(e.pointerId)
    applyDrag(e, mode)
  }

  const onRegionPointerMove = (e: PointerEvent) => {
    if (disabled) return
    const occ = occDragRef.current
    if (occ && occ.pointerId === e.pointerId && onOccupiedAbsoluteStart && trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect()
      const minuteNow = clientXToDispatchMinutes(e.clientX, rect, slotCount, railTrimWindow)
      onOccupiedAbsoluteStart(occ.blockId, minuteNow - occ.grabOffsetMin)
      return
    }
    if (dragModeRef.current === null) return
    applyDrag(e, dragModeRef.current)
  }

  const thumbLeftPct = (idx: number): string =>
    dispatchAddBlockTrackThumbLeftPct(idx, slotCount, railTrimWindow)

  const fillStyle = (): CSSProperties => {
    if (maxIdx === 0) {
      return { display: 'none' }
    }
    const loT = slotToTrackT(paintLo, slotCount, railTrimWindow)
    const hiT = slotToTrackT(paintHi, slotCount, railTrimWindow)
    const spanT = hiT - loT
    if (spanT <= 0) {
      return { display: 'none' }
    }
    return {
      position: 'absolute' as const,
      left: `calc(${THUMB_HALF}px + (100% - ${THUMB_PX}px) * ${loT})`,
      width: `calc((100% - ${THUMB_PX}px) * ${spanT})`,
      top: trackCenterTop,
      height: 6,
      marginTop: -3,
      borderRadius: 3,
      background: '#93c5fd',
      pointerEvents: 'none',
      zIndex: 2,
    }
  }

  const railStyle: CSSProperties = (() => {
    if (railTrimWindow === null) {
      return { display: 'none' }
    }
    // Under the rescale, `{ lo, hi }` makes the visible strip *be* the
    // window, so the rail spans full track width either way. Edge-clipping
    // here would double-trim.
    return {
      position: 'absolute',
      top: trackCenterTop,
      height: 6,
      marginTop: -3,
      borderRadius: 3,
      background: 'var(--bg-200)',
      pointerEvents: 'none',
      zIndex: 0,
      left: THUMB_HALF,
      right: THUMB_HALF,
    }
  })()

  const thumbStyle = (which: 'start' | 'end', idx: number): CSSProperties => ({
    position: 'absolute',
    left: thumbLeftPct(idx),
    top: trackCenterTop,
    transform: 'translate(-50%, -50%)',
    width: THUMB_PX,
    height: THUMB_PX,
    borderRadius: 999,
    border: '2px solid #2563eb',
    background: 'var(--surface)',
    padding: 0,
    cursor: disabled ? 'not-allowed' : 'grab',
    zIndex: activeThumb === which ? 5 : which === 'end' ? 4 : 3,
    touchAction: 'none',
    boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
  })

  const onThumbKeyDown = (which: 'start' | 'end', e: KeyboardEvent) => {
    if (disabled) return
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const delta = e.key === 'ArrowRight' ? 1 : -1
    const cur = which === 'start' ? startSlotIndex : endSlotIndex
    const next = clampInt(cur + delta, 0, maxIdx)
    if (next === cur) return
    if (which === 'start') onStartChange(next)
    else onEndChange(next)
  }

  const orientationMarks = (() => {
    if (maxIdx === 0) return []
    const baseFiltered = DISPATCH_ADD_BLOCK_ORIENTATION_MARKS.filter((m) => m.slotIndex <= maxIdx)
    if (!railTrimWindow) return baseFiltered
    const lo = Math.max(0, Math.min(railTrimWindow.loSlotIndex, maxIdx))
    const hi = Math.max(lo, Math.min(railTrimWindow.hiSlotIndex, maxIdx))
    return baseFiltered.filter((m) => m.slotIndex >= lo && m.slotIndex <= hi)
  })()

  return (
    <div
      ref={regionRef}
      role="group"
      aria-label={groupAriaLabel}
      onPointerDown={onRegionPointerDown}
      onPointerMove={onRegionPointerMove}
      onPointerUp={clearDrag}
      onPointerCancel={clearDrag}
      style={{
        position: 'relative',
        width: '100%',
        paddingTop: compact ? 6 : 10,
        paddingBottom: compact ? (showOrientationLabels ? 4 : 2) : showOrientationLabels ? 10 : 8,
        touchAction: 'none',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <div ref={trackRef} style={{ position: 'relative', width: '100%', height: trackH }}>
        {occupiedBands?.map((b) => {
          const lo = Math.min(b.startSlotIndex, b.endSlotIndex)
          const hi = Math.max(b.startSlotIndex, b.endSlotIndex)
          const loT = slotToTrackT(lo, slotCount, railTrimWindow)
          const hiT = slotToTrackT(hi, slotCount, railTrimWindow)
          const spanT = Math.max(0, hiT - loT)
          const canDrag = Boolean(onOccupiedAbsoluteStart) && !disabled
          const canClickOccupied = Boolean(onOccupiedBandClick) && !canDrag
          const occPointerEvents = canDrag || canClickOccupied ? 'auto' : 'none'
          const openOccupied = () => {
            const jid = b.jobId?.trim()
            if (jid) onOccupiedBandClick?.(b)
          }
          return (
            <div
              key={b.blockId}
              role={canClickOccupied ? 'button' : undefined}
              tabIndex={canClickOccupied ? 0 : undefined}
              aria-label={
                canClickOccupied
                  ? `Open ${b.label} on Schedule Dispatch`
                  : undefined
              }
              onPointerDown={
                canClickOccupied
                  ? (e) => {
                      e.stopPropagation()
                    }
                  : undefined
              }
              onClick={
                canClickOccupied
                  ? (e) => {
                      e.stopPropagation()
                      openOccupied()
                    }
                  : undefined
              }
              onKeyDown={
                canClickOccupied
                  ? (ev) => {
                      if (ev.key !== 'Enter' && ev.key !== ' ') return
                      ev.preventDefault()
                      openOccupied()
                    }
                  : undefined
              }
              style={{
                position: 'absolute',
                left: `calc(${THUMB_HALF}px + (100% - ${THUMB_PX}px) * ${loT})`,
                width: `calc((100% - ${THUMB_PX}px) * ${spanT})`,
                top: hasOccupied ? 14 : 0,
                height: hasOccupied ? 30 : 36,
                pointerEvents: occPointerEvents,
                zIndex: 1,
                cursor: canClickOccupied ? 'pointer' : undefined,
                border: 'none',
                padding: 0,
                background: 'transparent',
                display: 'block',
                textAlign: 'inherit',
                font: 'inherit',
              }}
            >
              <div
                data-occupied-block={b.blockId}
                role={canDrag ? 'button' : undefined}
                tabIndex={canDrag ? 0 : -1}
                aria-label={canDrag ? `${b.label}, existing block. Drag to reschedule.` : undefined}
                aria-hidden={canClickOccupied ? true : undefined}
                onKeyDown={(ev) => {
                  if (!canDrag) return
                  if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return
                  ev.preventDefault()
                  const loMin = dispatchSlotIndexToMinutes(lo)
                  const delta = ev.key === 'ArrowRight' ? 30 : -30
                  onOccupiedAbsoluteStart?.(b.blockId, loMin + delta)
                }}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 10,
                  height: DISPATCH_TIMELINE_STRIP_BAR_HEIGHT_PX,
                  borderRadius: 3,
                  background: '#fed7aa',
                  border: '1px solid #ea580c',
                  cursor: canDrag ? 'grab' : 'default',
                  boxSizing: 'border-box',
                  pointerEvents: canClickOccupied ? 'none' : undefined,
                }}
              />
              <div
                aria-hidden={canClickOccupied ? true : undefined}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  fontSize: DISPATCH_TIMELINE_STRIP_LABEL_FONT_SIZE,
                  fontWeight: 600,
                  color: 'var(--text-orange-800)',
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textAlign: 'center',
                  pointerEvents: canClickOccupied ? 'none' : undefined,
                }}
              >
                {b.label}
              </div>
            </div>
          )
        })}
        <div style={railStyle} />
        {showProposedRange ? <div style={fillStyle()} /> : null}
        {boundaryDots?.map((dot) => {
          const key = boundaryDotKey(dot)
          const isShared = dot.kind === 'shared'
          // Not gated on `disabled`: the Day view renders a read-only rail
          // (disabled) but editors still get live dots; parents simply omit
          // the handlers for read-only viewers.
          const canDragDot = Boolean(onBoundaryDotDrag)
          const t = slotToTrackT(
            dispatchMinutesToFractionalSlotIndex(dot.min),
            slotCount,
            railTrimWindow,
          )
          const isActive = activeDotKey === key
          const timeLabel = formatDispatchQuickTimeLabel(dispatchMinutesToHHmm(dot.min))
          const ariaLabel = isShared
            ? `Boundary between touching jobs at ${timeLabel}. Drag to move both; click and hold to separate.`
            : `${dot.kind === 'start' ? 'Start' : 'End'} of job at ${timeLabel}. Drag to adjust.`
          return (
            <button
              key={key}
              type="button"
              role="slider"
              aria-label={ariaLabel}
              aria-valuemin={MIN_MIN}
              aria-valuemax={MAX_MIN}
              aria-valuenow={dot.min}
              aria-valuetext={timeLabel}
              data-boundary-dot={key}
              onPointerDown={(e) => {
                if (!canDragDot || e.button !== 0) return
                e.stopPropagation()
                e.preventDefault()
                const st = {
                  key,
                  dot,
                  pointerId: e.pointerId,
                  downX: e.clientX,
                  moved: false,
                  longPressFired: false,
                  timer: null as ReturnType<typeof setTimeout> | null,
                }
                if (isShared && onSharedDotSeparate) {
                  st.timer = setTimeout(() => {
                    const cur = dotDragRef.current
                    if (!cur || cur.key !== key || cur.moved) return
                    cur.longPressFired = true
                    onSharedDotSeparate(dot as Extract<BoundaryDot, { kind: 'shared' }>)
                  }, 500)
                }
                dotDragRef.current = st
                setActiveDotKey(key)
                try {
                  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                } catch {
                  /* synthetic/lost pointer — drag still tracks via element handlers */
                }
              }}
              onPointerMove={(e) => {
                const st = dotDragRef.current
                if (!st || st.pointerId !== e.pointerId || st.longPressFired) return
                if (!st.moved && Math.abs(e.clientX - st.downX) < 5) return
                if (!st.moved) {
                  st.moved = true
                  if (st.timer != null) {
                    clearTimeout(st.timer)
                    st.timer = null
                  }
                }
                const track = trackRef.current
                if (!track || !onBoundaryDotDrag) return
                const rect = track.getBoundingClientRect()
                const minutes = clientXToDispatchMinutes(e.clientX, rect, slotCount, railTrimWindow)
                onBoundaryDotDrag(st.dot, minutes)
              }}
              onPointerUp={finishDotDrag}
              onPointerCancel={finishDotDrag}
              onKeyDown={(e) => {
                if (!canDragDot) return
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                e.preventDefault()
                e.stopPropagation()
                const delta = e.key === 'ArrowRight' ? DOT_DRAG_SNAP_MINUTES : -DOT_DRAG_SNAP_MINUTES
                onBoundaryDotDrag?.(dot, dot.min + delta)
                onBoundaryDotDragEnd?.()
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                left: `calc(${THUMB_HALF}px + (100% - ${THUMB_PX}px) * ${t})`,
                top: hasOccupied ? 28 : 18,
                transform: 'translate(-50%, -50%)',
                width: 26,
                height: 26,
                padding: 0,
                border: 'none',
                background: 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: canDragDot ? 'ew-resize' : 'default',
                touchAction: 'none',
                zIndex: isActive ? 7 : 6,
                pointerEvents: canDragDot ? 'auto' : 'none',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: isShared ? 16 : 12,
                  height: isShared ? 16 : 12,
                  borderRadius: 999,
                  background: '#ea580c',
                  border: '2px solid var(--surface)',
                  boxShadow: isShared
                    ? '0 0 0 2px #ea580c, 0 1px 2px rgba(0,0,0,0.25)'
                    : '0 1px 2px rgba(0,0,0,0.25)',
                  boxSizing: 'border-box',
                }}
              />
              {isActive ? (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    bottom: 24,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: 'var(--text-orange-800)',
                    background: 'var(--surface)',
                    border: '1px solid #ea580c',
                    borderRadius: 4,
                    padding: '0.05rem 0.3rem',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}
                >
                  {timeLabel}
                </span>
              ) : null}
            </button>
          )
        })}
        {orientationMarks.length > 0 ? (
          <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {orientationMarks.map(({ slotIndex }) => (
              <div
                key={slotIndex}
                style={{
                  position: 'absolute',
                  left: thumbLeftPct(slotIndex),
                  top: trackCenterTop,
                  width: 2,
                  height: 6,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: 1,
                  background: '#9ca3af',
                  zIndex: 1,
                }}
              />
            ))}
          </div>
        ) : null}
        {showProposedRange ? (
          <>
            <button
              type="button"
              data-thumb="start"
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-valuemin={0}
              aria-valuemax={maxIdx}
              aria-valuenow={startSlotIndex}
              aria-valuetext={formatAriaValue(startSlotIndex)}
              aria-label="Start time, 30-minute steps"
              disabled={disabled}
              onKeyDown={(e) => onThumbKeyDown('start', e)}
              onFocus={() => setActiveThumb('start')}
              onBlur={() => setActiveThumb((a) => (a === 'start' ? null : a))}
              style={thumbStyle('start', startSlotIndex)}
            />
            <button
              type="button"
              data-thumb="end"
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-valuemin={0}
              aria-valuemax={maxIdx}
              aria-valuenow={endSlotIndex}
              aria-valuetext={formatAriaValue(endSlotIndex)}
              aria-label="End time, 30-minute steps"
              disabled={disabled}
              onKeyDown={(e) => onThumbKeyDown('end', e)}
              onFocus={() => setActiveThumb('end')}
              onBlur={() => setActiveThumb((a) => (a === 'end' ? null : a))}
              style={thumbStyle('end', endSlotIndex)}
            />
          </>
        ) : null}
        {secondaryBands?.map((band) => {
          const lo = Math.min(band.startSlotIndex, band.endSlotIndex)
          const hi = Math.max(band.startSlotIndex, band.endSlotIndex)
          const loT = slotToTrackT(lo, slotCount, railTrimWindow)
          const hiT = slotToTrackT(hi, slotCount, railTrimWindow)
          const spanT = Math.max(0, hiT - loT)
          const shellStyle = {
            position: 'absolute' as const,
            left: `calc(${THUMB_HALF}px + (100% - ${THUMB_PX}px) * ${loT})`,
            width: `calc((100% - ${THUMB_PX}px) * ${spanT})`,
            ...(hasOccupied
              ? { top: SECONDARY_ANCHOR_TOP_BELOW_RAIL_OCCUPIED, bottom: 'auto' as const }
              : { top: 'auto' as const, bottom: 0 }),
            zIndex: 1,
          }
          const labelEl =
            band.displayLabel?.trim() !== '' ? (
              <div
                aria-hidden
                style={{
                  fontSize: DISPATCH_TIMELINE_STRIP_LABEL_FONT_SIZE,
                  fontWeight: 600,
                  color: '#0f766e',
                  lineHeight: 1.1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: 0,
                }}
              >
                {band.displayLabel}
              </div>
            ) : null
          const barEl = (
            <div
              style={{
                height: DISPATCH_TIMELINE_STRIP_BAR_HEIGHT_PX,
                borderRadius: 3,
                background: '#5eead4',
                border: '1px solid #0d9488',
                boxSizing: 'border-box',
                pointerEvents: 'none',
              }}
            />
          )
          if (onSecondaryBandClick) {
            return (
              <button
                key={band.id}
                type="button"
                title={band.label}
                aria-label={band.label ?? band.displayLabel ?? 'Clock session'}
                onPointerDown={(e) => {
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  onSecondaryBandClick(band)
                }}
                style={{
                  ...shellStyle,
                  margin: 0,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {labelEl}
                {barEl}
              </button>
            )
          }
          return (
            <div key={band.id} title={band.label} aria-hidden style={shellStyle}>
              {labelEl}
              {barEl}
            </div>
          )
        })}
      </div>
      {showOrientationLabels && orientationMarks.length > 0 ? (
        <div
          aria-hidden
          style={{
            position: 'relative',
            width: '100%',
            height: compact ? 12 : 14,
            marginTop: compact ? 0 : -2,
            pointerEvents: 'none',
          }}
        >
          {orientationMarks.map(({ slotIndex, label }) => (
            <span
              key={slotIndex}
              style={{
                position: 'absolute',
                left: thumbLeftPct(slotIndex),
                transform: 'translateX(-50%)',
                fontSize: '0.65rem',
                color: 'var(--text-faint)',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
