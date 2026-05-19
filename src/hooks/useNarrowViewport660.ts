import { useEffect, useState } from 'react'

const NARROW_MQ = '(max-width: 660px)'

/** Matches Dashboard subcontractor Ready to Bill layout for narrow viewports up to 660px. */
export function useNarrowViewport660(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(NARROW_MQ).matches
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(NARROW_MQ)
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return narrow
}
