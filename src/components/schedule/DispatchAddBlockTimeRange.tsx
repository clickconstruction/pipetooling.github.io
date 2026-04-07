import { useCallback, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'

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

export type DispatchAddBlockTimeRangeProps = {
  slotCount: number
  startSlotIndex: number
  endSlotIndex: number
  onStartChange: (slotIndex: number) => void
  onEndChange: (slotIndex: number) => void
  formatAriaValue: (slotIndex: number) => string
  disabled?: boolean
  groupAriaLabel: string
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
}: DispatchAddBlockTimeRangeProps) {
  const regionRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  /** Which thumb is being dragged; nearest-thumb when dragging from track */
  const dragModeRef = useRef<'start' | 'end' | null>(null)
  const [activeThumb, setActiveThumb] = useState<'start' | 'end' | null>(null)

  const maxIdx = Math.max(0, slotCount - 1)
  const paintLo = Math.min(startSlotIndex, endSlotIndex)
  const paintHi = Math.max(startSlotIndex, endSlotIndex)

  const clearDrag = useCallback((e: PointerEvent) => {
    dragModeRef.current = null
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
    if (disabled || dragModeRef.current === null) return
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
      top: '50%',
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
    top: '50%',
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
    top: '50%',
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
        paddingTop: 10,
        paddingBottom: 10,
        touchAction: 'none',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <div ref={trackRef} style={{ position: 'relative', width: '100%', height: 36 }}>
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
                  top: 'calc(50% + 3px)',
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
            height: 14,
            marginTop: -2,
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
