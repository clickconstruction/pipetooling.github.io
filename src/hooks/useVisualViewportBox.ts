import { useEffect, useState } from 'react'
import type { VisualViewportBox } from '../lib/tasks/taskWindowFrame'

function read(): VisualViewportBox | null {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  if (!vv || !vv.height) return null
  return { height: vv.height, offsetTop: vv.offsetTop ?? 0 }
}

/**
 * The part of the page that shows: its height, and how far the keyboard has slid it down the page.
 *
 * `useVisualViewportHeight` hears a resize only. An iPhone also slides the visual viewport when the field that
 * takes the keyboard sits where the keyboard will be, and says so with a scroll, so this one hears both. Null
 * where the VisualViewport API is missing (jsdom, very old browsers).
 */
export function useVisualViewportBox(): VisualViewportBox | null {
  const [box, setBox] = useState<VisualViewportBox | null>(read)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const next = read()
      setBox((prev) => (prev && next && prev.height === next.height && prev.offsetTop === next.offsetTop ? prev : next))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return box
}
