import { useCallback, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { dispatchSlotIndexToMinutes, MAX_MIN, MIN_MIN } from '@/lib/dispatchAddBlockTime'

const THUMB_PX = 22
const THUMB_HALF = THUMB_PX / 2

/** 04:00–20:00 Central in 30m steps: 8 AM, 12 PM, 4 PM slot indices (Dispatch modal grid). */
export const DISPATCH_ADD_BLOCK_ORIENTATION_MARKS: ReadonlyArray<{ slotIndex: number; label: string }> = [
  { slotIndex: 8, label: '8 AM' },
  { slotIndex: 16, label: '12 PM' },
  { slotIndex: 24, label: '4 PM' },
]

/** Same horizontal position as range thumbs / occupied bands for a given slot (matches track inset). */
export function dispatchAddBlockTrackThumbLeftPct(slotIndex: number, slotCount: number): string {
  const maxIdx = Math.max(0, slotCount - 1)
  if (maxIdx === 0) return '50%'
  const t = slotIndex / maxIdx
  return `calc(${THUMB_HALF}px + (100% - ${THUMB_PX}px) * ${t})`
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function clientXToSlotIndex(clientX: number, rect: DOMRect, slotCount: number): number {
  const maxIdx = Math.max(0, slotCount - 1)
  if (maxIdx === 0) return 0
  const usableW = rect.width - 2 * THUMB_HALF
  const usableLeft = rect.left + THUMB_HALF
  const t = usableW <= 0 ? 0 : clampInt((clientX - usableLeft) / usableW, 0, 1)
  return clampInt(Math.round(t * maxIdx), 0, maxIdx)
}

/** Linear map across the track to dispatch wall minutes (4:00–20:00). */
function clientXToDispatchMinutes(clientX: number, rect: DOMRect): number {
  const usableW = rect.width - 2 * THUMB_HALF
  const usableLeft = rect.left + THUMB_HALF
  const t = usableW <= 0 ? 0 : clampInt((clientX - usableLeft) / usableW, 0, 1)
  return Math.round(MIN_MIN + t * (MAX_MIN - MIN_MIN))
}

function thumbPixelX(startSlotIndex: number, endSlotIndex: number, slotCount: number, rect: DOMRect): {
  startX: number
  endX: number
  usableLeft: number
  usableW: number
} {
  const maxIdx = Math.max(0, slotCount - 1)
  const usableW = rect.width - 2 * THUMB_HALF
  const usableLeft = rect.left + THUMB_HALF
  if (maxIdx === 0) {
    return { startX: usableLeft, endX: usableLeft, usableLeft, usableW }
  }
  return {
    startX: usableLeft + (startSlotIndex / maxIdx) * usableW,
    endX: usableLeft + (endSlotIndex / maxIdx) * usableW,
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
      const idx = clientXToSlotIndex(e.clientX, rect, slotCount)
      if (mode === 'start') onStartChange(idx)
      else onEndChange(idx)
    },
    [disabled, onEndChange, onStartChange, slotCount],
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
      const minuteAtDown = clientXToDispatchMinutes(e.clientX, rect)
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
      const { startX, endX } = thumbPixelX(startSlotIndex, endSlotIndex, slotCount, rect)
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
      const minuteNow = clientXToDispatchMinutes(e.clientX, rect)
      onOccupiedAbsoluteStart(occ.blockId, minuteNow - occ.grabOffsetMin)
      return
    }
    if (dragModeRef.current === null) return
    applyDrag(e, dragModeRef.current)
  }

  const thumbLeftPct = (idx: number): string => dispatchAddBlockTrackThumbLeftPct(idx, slotCount)

  const fillStyle = (): CSSProperties => {
    if (maxIdx === 0) {
      return { display: 'none' }
    }
    const loT = paintLo / maxIdx
    const spanT = (paintHi - paintLo) / maxIdx
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

  const railStyle: CSSProperties = {
    position: 'absolute',
    left: THUMB_HALF,
    right: THUMB_HALF,
    top: trackCenterTop,
    height: 6,
    marginTop: -3,
    borderRadius: 3,
    background: '#e5e7eb',
    pointerEvents: 'none',
    zIndex: 0,
  }

  const thumbStyle = (which: 'start' | 'end', idx: number): CSSProperties => ({
    position: 'absolute',
    left: thumbLeftPct(idx),
    top: trackCenterTop,
    transform: 'translate(-50%, -50%)',
    width: THUMB_PX,
    height: THUMB_PX,
    borderRadius: 999,
    border: '2px solid #2563eb',
    background: '#fff',
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

  const orientationMarks =
    maxIdx > 0 ? DISPATCH_ADD_BLOCK_ORIENTATION_MARKS.filter((m) => m.slotIndex <= maxIdx) : []

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
          const loT = maxIdx === 0 ? 0 : lo / maxIdx
          const spanT = maxIdx === 0 ? 0 : (hi - lo) / maxIdx
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
                  color: '#9a3412',
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
          const loT = maxIdx === 0 ? 0 : lo / maxIdx
          const spanT = maxIdx === 0 ? 0 : (hi - lo) / maxIdx
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
                color: '#9ca3af',
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
