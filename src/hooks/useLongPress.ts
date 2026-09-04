import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, SyntheticEvent } from 'react'

export const LONG_PRESS_MS = 450
const MOVE_TOLERANCE_PX = 10

/**
 * Press-and-hold that fires ON RELEASE after `ms` (the Quick Assign pattern —
 * opening mid-hold would put the new surface under the finger and the release
 * would hit it). A finger that travels more than `MOVE_TOLERANCE_PX` is a
 * scroll, not a press; pointercancel (native gesture mid-hold) clears it too.
 * `consumeLongPress()` guards the click that trails a press so the tap action
 * doesn't also run. Spread `handlers` on the element; the element should set
 * `WebkitTouchCallout: 'none'` / `userSelect: 'none'` so iOS doesn't open its
 * own menu during the hold.
 */
export function useLongPress(
  onLongPress: () => void,
  opts: { ms?: number; disabled?: boolean } = {},
): {
  handlers: {
    onPointerDown: (e: ReactPointerEvent) => void
    onPointerMove: (e: ReactPointerEvent) => void
    onPointerUp: () => void
    onPointerLeave: () => void
    onPointerCancel: () => void
    onContextMenu: (e: SyntheticEvent) => void
  }
  consumeLongPress: () => boolean
} {
  const ms = opts.ms ?? LONG_PRESS_MS
  const startRef = useRef<{ at: number; x: number; y: number } | null>(null)
  const firedRef = useRef(false)

  const clear = () => {
    startRef.current = null
  }

  return {
    handlers: {
      onPointerDown: (e) => {
        firedRef.current = false
        if (opts.disabled || e.button !== 0) {
          clear()
          return
        }
        startRef.current = { at: Date.now(), x: e.clientX, y: e.clientY }
      },
      onPointerMove: (e) => {
        const s = startRef.current
        if (!s) return
        if (Math.abs(e.clientX - s.x) > MOVE_TOLERANCE_PX || Math.abs(e.clientY - s.y) > MOVE_TOLERANCE_PX) clear()
      },
      onPointerUp: () => {
        const s = startRef.current
        clear()
        if (s && Date.now() - s.at >= ms) {
          firedRef.current = true
          onLongPress()
        }
      },
      onPointerLeave: clear,
      onPointerCancel: clear,
      onContextMenu: (e) => {
        if (!opts.disabled) e.preventDefault()
      },
    },
    consumeLongPress: () => {
      if (firedRef.current) {
        firedRef.current = false
        return true
      }
      return false
    },
  }
}
