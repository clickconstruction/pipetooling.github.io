import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { classifySwipe, swipeOffset, swipeSettles } from '../../lib/people/usersTabPhone'

/**
 * The left swipe of a phone directory row (v2.3185), lifted out of `UsersTabPhoneRow` in v2.6863 so the Away
 * rows slide over their strip of presses the same way. A touch that moves sideways drags the row over the
 * strip and settles open or shut; a touch that moves up or down scrolls as usual. The parent owns which row
 * is open. `suppressClick` is true for the tick after a drag, so the row's own tap does not fire with it.
 */
export function useSwipeRow({ actionsWidth, swipeOpen, onSwipeChange, enabled }: { actionsWidth: number; swipeOpen: boolean; onSwipeChange: (open: boolean) => void; enabled: boolean }) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const axis = useRef<'horizontal' | 'vertical' | 'undecided'>('undecided')
  const [dragX, setDragX] = useState<number | null>(null)
  const suppressClick = useRef(false)

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!enabled) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    axis.current = 'undecided'
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
    if (axis.current !== 'horizontal') return
    setDragX(swipeOffset(dx, actionsWidth, swipeOpen))
  }
  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    if (axis.current === 'horizontal') {
      const dx = e.clientX - s.x
      onSwipeChange(swipeSettles(dx, actionsWidth, swipeOpen))
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
    offset: dragX ?? (swipeOpen ? -actionsWidth : 0),
    dragging: dragX != null,
    suppressClick,
    handlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag },
  }
}
