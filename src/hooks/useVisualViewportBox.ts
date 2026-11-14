import { useEffect, useState } from 'react'
import type { VisualViewportBox } from '../lib/visibleBand'

function read(): VisualViewportBox | null {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  if (!vv || !vv.height) return null
  return { height: vv.height, offsetTop: vv.offsetTop ?? 0 }
}

/**
 * The part of the page that shows: its height, and how far the keyboard has slid it down the page.
 *
 * Plain vh and dvh units ignore the keyboard on an iPhone, so a window that must stay above it reads this. A
 * resize says the keyboard took or gave back room. A scroll says the page slid, which an iPhone does when the
 * field that takes the keyboard sits where the keyboard will be. The hook that heard only the resize
 * (`useVisualViewportHeight`) is gone: every window that read it now reads this (punch list #348). Null where
 * the VisualViewport API is missing (jsdom, very old browsers).
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
