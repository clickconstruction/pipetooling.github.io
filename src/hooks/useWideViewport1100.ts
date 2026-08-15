import { useEffect, useState } from 'react'

const WIDE_MQ = '(min-width: 1100px)'

/**
 * Wide-desktop gate for optional row enrichments (the Pipeline "Job activity"
 * box): true only when the viewport is at least 1100px (v2.1670 — owner
 * wanted the box at much smaller viewports than the original 1440). Mirrors useNarrowViewport640.
 */
export function useWideViewport1100(): boolean {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(WIDE_MQ).matches
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(WIDE_MQ)
    const sync = () => setWide(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return wide
}
