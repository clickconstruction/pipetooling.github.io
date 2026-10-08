import { useCallback, useEffect, useState } from 'react'

import type { GcFollowUpNeeds } from '../lib/gc/followUpNeeds'
import { todayYmdInAppTz } from '../utils/dateUtils'

/**
 * GC mode: Follow up's count for the Dashboard's Needs you (Helper 6, after door 2). The GC
 * kernels and reads load on demand, only when the line is on, so the Dashboard's own chunk does
 * not grow. Null while off, loading, or when nobody waits on a call. Refetches on window focus
 * like the neighbouring nudges.
 */
export function useGcFollowUpNeeds(enabled: boolean): GcFollowUpNeeds | null {
  const [needs, setNeeds] = useState<GcFollowUpNeeds | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setNeeds(null)
      return
    }
    try {
      const { loadGcFollowUpNeeds } = await import('../lib/gc/followUpNeedsIo')
      setNeeds(await loadGcFollowUpNeeds(todayYmdInAppTz()))
    } catch {
      setNeeds(null)
    }
  }, [enabled])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])
  return needs
}
