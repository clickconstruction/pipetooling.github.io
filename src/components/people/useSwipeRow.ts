import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { classifySwipe, swipeOffset, swipeSettles } from '../../lib/people/usersTabPhone'

/**
 * The left swipe of a phone directory row (v2.3185), lifted out of `UsersTabPhoneRow` in v2.6863 so the Away
 * rows slide over their strip of presses the same way. A touch that moves sideways drags the row over the
 * strip and settles open or shut; a touch that moves up or down scrolls as usual. The parent owns which row
 * is open. `suppressClick` is true for the tick after a drag, so the row's own tap does not fire with it.
 * `settleAt` is how far the row must travel to settle the other way, a third of the strip when it is not
 * given: the swipe-away rows of the Dashboard ask for more (v2.8349, punch list #426).
 *
 * Since v2.8603 a row may slide the other way: `side: 'right'` puts the strip on the row's left and mirrors
 * the drag, for the Dashboard's put-away rows. `mayStart` lets the caller refuse a touch by where it lands
 * (the phone's own Back at the screen's left edge), and `wrongWay` says when a touch has gone against the
 * row's way far enough for `onWrongWay` to answer it, once a touch. The rest of that touch moves nothing.
 * A caller that passes none of them gets the left swipe as it was.
 */
export function useSwipeRow({
  actionsWidth,
  swipeOpen,
  onSwipeChange,
  enabled,
  settleAt,
  side = 'left',
  mayStart,
  wrongWay,
  onWrongWay,
}: {
  actionsWidth: number
  swipeOpen: boolean
  onSwipeChange: (open: boolean) => void
  enabled: boolean
  settleAt?: number
  side?: 'left' | 'right'
  mayStart?: (clientX: number) => boolean
  wrongWay?: (dx: number, startX: number) => boolean
  onWrongWay?: () => void
}) {
  /** A right row is the left row in a mirror: the kernel reads the drag turned round, and the offset is turned back. */
  const turn = side === 'right' ? -1 : 1
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const axis = useRef<'horizontal' | 'vertical' | 'undecided'>('undecided')
  /** True once this touch went the wrong way and was answered: it moves nothing after that. */
  const spent = useRef(false)
  const [dragX, setDragX] = useState<number | null>(null)
  const suppressClick = useRef(false)

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!enabled) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (mayStart && !mayStart(e.clientX)) return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    axis.current = 'undecided'
    spent.current = false
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (axis.current === 'undecided') {
      axis.current = classifySwipe(dx, dy)
      if (axis.current === 'horizontal') {
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* jsdom / older browsers */
        }
      }
    }
    if (axis.current !== 'horizontal' || spent.current) return
    if (!swipeOpen && wrongWay?.(dx, s.x)) {
      spent.current = true
      setDragX(null)
      onWrongWay?.()
      return
    }
    setDragX(turn * swipeOffset(turn * dx, actionsWidth, swipeOpen))
  }
  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    if (axis.current === 'horizontal') {
      const dx = e.clientX - s.x
      if (!spent.current) onSwipeChange(swipeSettles(turn * dx, actionsWidth, swipeOpen, settleAt))
      suppressClick.current = true
      setTimeout(() => {
        suppressClick.current = false
      }, 0)
    }
    start.current = null
    axis.current = 'undecided'
    setDragX(null)
  }

  return {
    /** Where the row sits: mid-drag, open over the strip, or shut. */
    offset: dragX ?? (swipeOpen ? turn * -actionsWidth : 0),
    dragging: dragX != null,
    suppressClick,
    handlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag },
  }
}
