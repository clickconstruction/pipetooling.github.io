import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { StagesStageBar } from '../jobs/StagesStageBar'
import { pctFromTickLeft, tickLeftPct } from '../../lib/jobs/jobMoneyBar'
import type { ProgressPaymentView } from '../../lib/jobs/progressPaymentCell'

/**
 * The Percent complete card's bar as a slider (v2.5805, punch list #154). The bar is the
 * Pipeline's own (`StagesStageBar`, its dark tick where the job stands today, untouched); a
 * blue knob rides it at the number about to be saved. A press anywhere on the bar moves the
 * knob there, a drag follows the pointer, and the arrow keys walk it (Shift and the Page keys
 * by ten, Home and End to the ends). The place on the bar for a percent is `tickLeftPct`, the
 * Pipeline's; a pointer's place becomes a percent through its inverse, `pctFromTickLeft`, so
 * the knob and the tick always agree on where a number sits. The layer is a 44 px band over
 * the bar for a finger; `touch-action: pan-y` leaves the page's scroll alone.
 *
 * A job the view cannot draw a bar for (no bid, no lines) gets the bar alone and no knob; the
 * card's box still sets the number.
 */
export function QuickfillPercentBarSlider({
  view,
  pct,
  draft,
  onDraft,
  label,
  disabled = false,
}: {
  view: ProgressPaymentView
  /** Today's % on the job: the bar's own dark tick. */
  pct: number | null
  /** The number the knob sits on. */
  draft: number
  onDraft: (pct: number) => void
  /** The knob's accessible name. */
  label: string
  disabled?: boolean
}) {
  const layerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const slidable = view.mode !== 'nobid' && view.segments.length > 0

  const pctAt = (clientX: number): number => {
    const el = layerRef.current
    if (!el || !Number.isFinite(clientX)) return draft
    const r = el.getBoundingClientRect()
    if (!(r.width > 0)) return draft
    return Math.round(pctFromTickLeft(view.segments, ((clientX - r.left) / r.width) * 100))
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* jsdom and old engines: the drag still works while the pointer stays over the layer */
    }
    setDragging(true)
    onDraft(pctAt(e.clientX))
    e.currentTarget.focus({ preventScroll: true })
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || disabled) return
    onDraft(pctAt(e.clientX))
  }
  const endDrag = () => setDragging(false)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const step = e.shiftKey ? 10 : 1
    let next: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = draft + step
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = draft - step
    else if (e.key === 'PageUp') next = draft + 10
    else if (e.key === 'PageDown') next = draft - 10
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = 100
    if (next == null) return
    e.preventDefault()
    onDraft(Math.max(0, Math.min(100, next)))
  }

  const left = slidable ? tickLeftPct(view.segments, draft) : 0

  return (
    <div style={{ position: 'relative', minWidth: 0 }} data-percent-slider={slidable ? 'on' : 'off'}>
      <StagesStageBar view={view} pctComplete={pct} compact />
      {slidable ? (
        <div
          ref={layerRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={draft}
          aria-valuetext={`${draft}% done`}
          aria-disabled={disabled || undefined}
          title="Drag to set the % done"
          className={`qfPctSlider${dragging ? ' is-dragging' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
        >
          <span aria-hidden data-percent-knob className="qfPctKnob" style={{ left: `clamp(1px, ${left}%, calc(100% - 1px))` }} />
        </div>
      ) : null}
    </div>
  )
}

export default QuickfillPercentBarSlider
