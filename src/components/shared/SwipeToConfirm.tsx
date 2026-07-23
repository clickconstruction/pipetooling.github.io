import { useRef, useState } from 'react'
import { SWIPE_CONFIRM_THRESHOLD } from '../../lib/dispatchPoOther'

/**
 * Slide-to-confirm (v2.955): drag the knob across the track to fire onConfirm;
 * anything short springs back. Built for one-handed phone use — pointer-capture
 * based, cancel-safe, and immune to accidental taps by construction.
 */
export default function SwipeToConfirm({ label, onConfirm, disabled }: { label: string; onConfirm: () => void; disabled?: boolean }) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startXRef = useRef(0)

  const KNOB = 44
  const maxTravel = () => Math.max(0, (trackRef.current?.clientWidth ?? 0) - KNOB - 8)

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return
    startXRef.current = e.clientX
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || disabled) return
    setDragX(Math.min(maxTravel(), Math.max(0, e.clientX - startXRef.current)))
  }

  function endDrag() {
    if (!dragging) return
    setDragging(false)
    const travel = maxTravel()
    if (travel > 0 && dragX >= travel * SWIPE_CONFIRM_THRESHOLD) {
      setDragX(travel)
      onConfirm()
    } else {
      setDragX(0)
    }
  }

  return (
    <div
      ref={trackRef}
      style={{
        position: 'relative',
        height: KNOB + 8,
        borderRadius: 999,
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border-strong)',
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          pointerEvents: 'none',
        }}
      >
        {label} →
      </div>
      <div
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((dragX / Math.max(1, maxTravel())) * 100)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          position: 'absolute',
          top: 4,
          left: 4 + dragX,
          width: KNOB,
          height: KNOB,
          borderRadius: '50%',
          background: '#2563eb',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.1rem',
          fontWeight: 700,
          cursor: disabled ? 'not-allowed' : 'grab',
          transition: dragging ? 'none' : 'left 0.15s ease-out',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }}
      >
        »
      </div>
    </div>
  )
}
