import { useEffect, useState } from 'react'

/**
 * Live height of the visual viewport — the on-screen area NOT covered by the
 * software keyboard. Mobile modals that pin to the top of the screen size
 * themselves with this so they contract when the keyboard opens and expand
 * back when it closes (plain vh/dvh units ignore the keyboard on iOS).
 * Returns null where the VisualViewport API is unavailable (jsdom, very old
 * browsers) — callers fall back to a CSS unit like '100dvh'.
 */
export function useVisualViewportHeight(): number | null {
  const [height, setHeight] = useState<number | null>(
    () => (typeof window !== 'undefined' && window.visualViewport?.height) || null,
  )
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setHeight(vv.height)
    update()
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [])
  return height
}
