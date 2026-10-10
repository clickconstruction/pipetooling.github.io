import { useCallback, useEffect, useState } from 'react'

import type { GcNeedsYou } from '../lib/gc/needsYou'
import { todayYmdInAppTz } from '../utils/dateUtils'

/**
 * GC mode: Follow up's count for the Dashboard's Needs you (Helper 6, after door 2; everyone we wait on since the Board's
 * B2b-ii-b). The GC kernels and reads load on demand, only when the line is on, so the Dashboard's own chunk does not
 * grow. `money`: the reader is on the money team, so the read takes our contract's sends as GC projects does. Null while
 * off, loading, or when nobody waits on us. Refetches on window focus like the neighbouring nudges.
 */
export function useGcFollowUpNeeds(enabled: boolean, money: boolean): GcNeedsYou | null {
  const [needs, setNeeds] = useState<GcNeedsYou | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setNeeds(null)
      return
    }
    try {
      const { loadGcFollowUpNeeds } = await import('../lib/gc/followUpNeedsIo')
      setNeeds(await loadGcFollowUpNeeds(todayYmdInAppTz(), { money }))
    } catch {
      setNeeds(null)
    }
  }, [enabled, money])
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
