import { useState, useEffect } from 'react'

const MOBILE_MQ = '(max-width: 640px)'

/** A phone-width screen, the app's 640 px line. No matchMedia (a test page, an old browser): wide, and nothing to listen to. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(MOBILE_MQ).matches
  )
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(MOBILE_MQ)
    const handler = () => setIsMobile(mql.matches)
    handler()
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return isMobile
}
