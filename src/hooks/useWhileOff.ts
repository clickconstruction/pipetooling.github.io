import { useCallback, useEffect, useState } from 'react'
import type { WhatWaited } from '../lib/messages/whatWaited'

/**
 * While you were off (v2.6060, punch list #141 PR 4): the Needs you line that lists the pushes the person's own Push me
 * hours held (`messages/whatWaited.ts` over `whatWaitedIo.ts`), beside `useTodaysSends` and built the same way. The
 * reads load on demand, only when the line is on, so the Dashboard's own chunk does not grow. Null while off, loading,
 * for any time, or when nothing waited. Refetches on window focus like the neighbouring nudges.
 */
export function useWhileOff(enabled: boolean, userId: string | undefined): { need: WhatWaited | null; reload: () => void } {
  const [need, setNeed] = useState<WhatWaited | null>(null)
  const load = useCallback(async () => {
    if (!enabled || !userId) {
      setNeed(null)
      return
    }
    try {
      const { loadWhatWaited } = await import('../lib/messages/whatWaitedIo')
      setNeed(await loadWhatWaited(userId, new Date().toISOString()))
    } catch {
      setNeed(null)
    }
  }, [enabled, userId])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])
  return { need, reload: () => void load() }
}
