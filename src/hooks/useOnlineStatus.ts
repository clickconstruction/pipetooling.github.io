import { useEffect, useState } from 'react'

/**
 * `navigator.onLine`, kept live by the browser's `online` / `offline` events
 * (v2.2861, J2-F3). `true` when the browser cannot tell — the flag only ever
 * proves offline, so callers pair it with the last error's class rather than
 * trusting it alone.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean' ? true : navigator.onLine,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}
