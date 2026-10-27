import { useEffect, useState } from 'react'

const NARROW_MQ = '(max-width: 640px)'

/** Matches clock session tables and other mobile layouts at 640px. */
export function useNarrowViewport640(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(NARROW_MQ).matches
  )
  useEffect(() => {
    // No matchMedia (a test page, an old browser): wide, and nothing to listen to.
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(NARROW_MQ)
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return narrow
}
