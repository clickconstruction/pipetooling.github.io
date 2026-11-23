import { useState, type CSSProperties, type ReactNode } from 'react'
import { useSwipeRow } from '../people/useSwipeRow'
import { SWIPE_AWAY_ARMED, SWIPE_AWAY_REST, SWIPE_AWAY_SETTLE_AT, SWIPE_AWAY_STRIP_WIDTH, swipeAwayArmed, swipeAwayPressName } from '../../lib/swipeAway'

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
  radius = 0,
  children,
}: {
  /** The act: the strip's words and the word press's. */
  label: string
  /** The row's name, for the press's accessible name. */
  name: string
  onAway: () => void
  swipe: boolean
  /** The corner of the row's box, so the strip under it is clipped to the same shape. */
  radius?: number
  children: (press: ReactNode) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const drag = useSwipeRow({
    actionsWidth: SWIPE_AWAY_STRIP_WIDTH,
    swipeOpen: open,
    enabled: swipe,
    settleAt: SWIPE_AWAY_SETTLE_AT,
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

  const armed = swipeAwayArmed(drag.dragging, drag.offset)
  return (
    <div data-swipe-away-row style={{ position: 'relative', overflow: 'clip', borderRadius: radius }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: SWIPE_AWAY_STRIP_WIDTH, display: 'flex' }}>
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
            textAlign: 'right',
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
        {...drag.handlers}
        // A drag must not also press the row under it.
        onClickCapture={(e) => {
          if (drag.suppressClick.current) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        style={{
          position: 'relative',
          transform: `translateX(${drag.offset}px)`,
          transition: drag.dragging ? 'none' : 'transform 160ms ease-out',
          touchAction: 'pan-y',
          userSelect: 'none',
        }}
      >
        {children(null)}
      </div>
    </div>
  )
}
