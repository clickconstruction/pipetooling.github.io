import { useCallback, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { dispatchSlotIndexToMinutes, MAX_MIN, MIN_MIN } from '@/lib/dispatchAddBlockTime'

const THUMB_PX = 22
const THUMB_HALF = THUMB_PX / 2

/** 04:00–20:00 Central in 30m steps: 8 AM, 12 PM, 4 PM slot indices (Dispatch modal grid). */
const ORIENTATION_MARKS: ReadonlyArray<{ slotIndex: number; label: string }> = [
  { slotIndex: 8, label: '8 AM' },
  { slotIndex: 16, label: '12 PM' },
  { slotIndex: 24, label: '4 PM' },
]

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
}

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
  const trackH = hasOccupied ? 50 : 36
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

  const thumbLeftPct = (idx: number): string => {
    if (maxIdx === 0) return '50%'
    const t = idx / maxIdx
    return `calc(${THUMB_HALF}px + (100% - ${THUMB_PX}px) * ${t})`
  }

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
    maxIdx > 0 ? ORIENTATION_MARKS.filter((m) => m.slotIndex <= maxIdx) : []

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
        paddingBottom: compact ? 4 : 10,
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
          return (
            <div
              key={b.blockId}
              style={{
                position: 'absolute',
                left: `calc(${THUMB_HALF}px + (100% - ${THUMB_PX}px) * ${loT})`,
                width: `calc((100% - ${THUMB_PX}px) * ${spanT})`,
                top: hasOccupied ? 14 : 0,
                height: hasOccupied ? 30 : 36,
                pointerEvents: canDrag ? 'auto' : 'none',
                zIndex: 1,
              }}
            >
              <div
                data-occupied-block={b.blockId}
                role="button"
                tabIndex={canDrag ? 0 : -1}
                aria-label={`${b.label}, existing block. Drag to reschedule.`}
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
                  height: 8,
                  borderRadius: 3,
                  background: '#fed7aa',
                  border: '1px solid #ea580c',
                  cursor: canDrag ? 'grab' : 'default',
                  boxSizing: 'border-box',
                }}
              />
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: '#9a3412',
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textAlign: 'center',
                }}
              >
                {b.label}
              </div>
            </div>
          )
        })}
        <div style={railStyle} />
        <div style={fillStyle()} />
        {orientationMarks.length > 0 ? (
          <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {orientationMarks.map(({ slotIndex }) => (
              <div
                key={slotIndex}
                style={{
                  position: 'absolute',
                  left: thumbLeftPct(slotIndex),
                  top: hasOccupied ? 'calc(38px + 3px)' : 'calc(50% + 3px)',
                  width: 2,
                  height: 9,
                  transform: 'translateX(-50%)',
                  borderRadius: 1,
                  background: '#9ca3af',
                  zIndex: 1,
                }}
              />
            ))}
          </div>
        ) : null}
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
      </div>
      {orientationMarks.length > 0 ? (
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
