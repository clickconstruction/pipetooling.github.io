import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useSwipeRow } from '../people/useSwipeRow'
import { prefersReducedMotion } from '../../lib/landOn'
import {
  SWIPE_AWAY_ARMED,
  SWIPE_AWAY_REST,
  SWIPE_AWAY_SETTLE_AT,
  SWIPE_AWAY_STRIP_WIDTH,
  SWIPE_SHOW_MS,
  swipeAwayArmed,
  swipeAwayPressName,
  swipeMayStart,
  swipeShowReach,
  swipeWrongWay,
  type SwipeAwaySide,
} from '../../lib/swipeAway'

/** The word press a desk draws, one size with the card's other presses. */
const WORD_PRESS: CSSProperties = {
  flexShrink: 0,
  minHeight: 44,
  padding: '0 0.8rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text-700)',
  fontFamily: 'inherit',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

/**
 * A row that is put away with a swipe to the left (punch list #426): My Bids' **Hide** and Recent
 * Reports' **Mark opened**, one gesture drawn once. The rule and its numbers are `swipeAway.ts`; the
 * drag is the hook People's phone rows use, `useSwipeRow`.
 *
 * `side="right"` is the way back (v2.8603): a put-away row slides right over a strip on its left,
 * **Show again** or **Mark unread**. A touch that starts in the screen's left edge is the phone's own
 * Back and does not move the row. A swipe the wrong way, on either kind of row, moves nothing away:
 * the row slides by itself to show its strip's word on the side it goes, then slides back. A person
 * who asked their device for less motion gets no such slide.
 *
 * `swipe` is true on a device held in the hand. The row then slides over a strip that names the act;
 * past the mark the strip turns blue and letting go calls `onAway`. The strip is a real button, always
 * in the accessibility tree, so Tab reaches it (the row slides aside to show it) and a screen reader
 * hears the act and the row's name. `swipe` false is a desk: a mouse cannot swipe, so the same act is
 * a word press, handed to the row to place.
 *
 * The row draws itself through `children`, which gets the word press (null while the row swipes).
 * The caller says what happened, with Undo, in its own words.
 */
export function SwipeAwayRow({
  label,
  name,
  onAway,
  swipe,
  side = 'left',
  radius = 0,
  children,
}: {
  /** The act: the strip's words and the word press's. */
  label: string
  /** The row's name, for the press's accessible name. */
  name: string
  onAway: () => void
  swipe: boolean
  /** The way the row travels: left to be put away, right to come back. */
  side?: SwipeAwaySide
  /** The corner of the row's box, so the strip under it is clipped to the same shape. */
  radius?: number
  children: (press: ReactNode) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  /** The row sliding by itself to show its strip: where it sits and how long the move there takes. Null at rest. */
  const [shown, setShown] = useState<{ offset: number; ms: number } | null>(null)
  const showTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const stopShow = useCallback(() => {
    showTimers.current.forEach(clearTimeout)
    showTimers.current = []
    setShown(null)
  }, [])
  useEffect(() => () => showTimers.current.forEach(clearTimeout), [])
  /** Slide out far enough to read the strip's word, hold, slide back. Never as far as the mark. */
  const showStrip = () => {
    if (prefersReducedMotion()) return
    stopShow()
    setShown({ offset: (side === 'right' ? 1 : -1) * swipeShowReach(label), ms: SWIPE_SHOW_MS.out })
    showTimers.current = [
      setTimeout(() => setShown({ offset: 0, ms: SWIPE_SHOW_MS.back }), SWIPE_SHOW_MS.out + SWIPE_SHOW_MS.hold),
      setTimeout(() => setShown(null), SWIPE_SHOW_MS.out + SWIPE_SHOW_MS.hold + SWIPE_SHOW_MS.back),
    ]
  }
  const drag = useSwipeRow({
    actionsWidth: SWIPE_AWAY_STRIP_WIDTH,
    swipeOpen: open,
    enabled: swipe,
    settleAt: SWIPE_AWAY_SETTLE_AT,
    side,
    mayStart: (clientX) => swipeMayStart(side, clientX),
    wrongWay: (dx, startX) => swipeWrongWay(side, dx, startX),
    onWrongWay: showStrip,
    // A row at rest that settles open was let go past the mark: that is the act. A row a key opened just closes or stays.
    onSwipeChange: (next) => {
      if (next && !open) onAway()
      else setOpen(next)
    },
  })
  const pressName = swipeAwayPressName(label, name)

  if (!swipe) {
    return (
      <>
        {children(
          <button type="button" onClick={onAway} aria-label={pressName} data-swipe-away-press style={WORD_PRESS}>
            {label}
          </button>,
        )}
      </>
    )
  }

  const armed = swipeAwayArmed(drag.dragging, drag.offset, side)
  // A finger on the row always wins: the row follows the drag, and a row showing its strip by itself goes back first.
  const offset = drag.dragging || !shown ? drag.offset : shown.offset
  // The strip is under the edge the row uncovers: a row that goes left shows it on its right.
  const stripEdge = side === 'right' ? 'left' : 'right'
  return (
    <div data-swipe-away-row={side} style={{ position: 'relative', overflow: 'clip', borderRadius: radius }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, [stripEdge]: 0, width: SWIPE_AWAY_STRIP_WIDTH, display: 'flex' }}>
        <button
          type="button"
          onClick={onAway}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          aria-label={pressName}
          data-swipe-away-strip={armed ? 'armed' : 'rest'}
          style={{
            width: '100%',
            border: 'none',
            background: armed ? SWIPE_AWAY_ARMED : SWIPE_AWAY_REST,
            color: '#ffffff',
            fontFamily: 'inherit',
            fontSize: '0.875rem',
            fontWeight: 700,
            textAlign: stripEdge,
            padding: '0 0.9rem',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          {label}
        </button>
      </div>
      <div
        data-swipe-away-slide
        data-swipe-away-showing={shown ? 'true' : undefined}
        {...drag.handlers}
        // A touch stops a row that is showing its strip by itself.
        onPointerDownCapture={stopShow}
        // A drag must not also press the row under it.
        onClickCapture={(e) => {
          if (drag.suppressClick.current) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        style={{
          position: 'relative',
          transform: `translateX(${offset}px)`,
          transition: drag.dragging ? 'none' : `transform ${shown ? shown.ms : 160}ms ease-out`,
          touchAction: 'pan-y',
          userSelect: 'none',
        }}
      >
        {children(null)}
      </div>
    </div>
  )
}
