import { useCallback, useEffect, useState } from 'react'

import type { GcNeedsYou } from '../lib/gc/needsYou'

/**
 * GC mode: Follow up's count for the Dashboard's Needs you (Helper 6, after door 2): the people waiting on us, once a
 * person, the number Follow up's pill says (`follow_up_count`, v2.5289). The read loads on demand, only when the line is
 * on, so the Dashboard's own chunk does not grow. Null while off, loading, or when nobody waits on us. Refetches on window
 * focus like the neighbouring nudges.
 */
export function useGcFollowUpNeeds(enabled: boolean): GcNeedsYou | null {
  const [needs, setNeeds] = useState<GcNeedsYou | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setNeeds(null)
      return
    }
    try {
      const { loadGcFollowUpNeeds } = await import('../lib/gc/followUpNeedsIo')
      setNeeds(await loadGcFollowUpNeeds())
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
