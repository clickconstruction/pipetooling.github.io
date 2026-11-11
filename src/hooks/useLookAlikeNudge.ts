import { useCallback, useEffect, useState } from 'react'

import { loadLookAlikeNeed } from '../lib/research/lookAlikeIo'
import type { LookAlikeNeed } from '../lib/research/lookAlikeWorklist'

/**
 * The Needs you line *names on permits look like a customer* (punch list #307): the numbers on
 * Builders' **Looks like a customer** chips, added up over every city the pull reads, by the
 * function the chip itself counts with (`cityLookAlikes`). The host gates it to the people who
 * may answer on a name and to the Dashboard. Counting a city is Builders' own read, which is
 * heavy, so a count is remembered by this browser for half an hour and forgotten when an answer
 * is saved: most opens of the Dashboard read nothing. Null while disabled, loading, when no name
 * waits, when the reads fail, and before the answers table is on the database. Asks again on
 * window focus, which reads only the cities whose count has gone stale.
 */
export function useLookAlikeNudge(enabled: boolean): LookAlikeNeed | null {
  const [need, setNeed] = useState<LookAlikeNeed | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setNeed(null)
      return
    }
    try {
      setNeed(await loadLookAlikeNeed())
    } catch {
      // The line is a reminder: a read that fails shows no line, and Builders shows the failure itself.
      setNeed(null)
    }
  }, [enabled])

  useEffect(() => {
    void load()
    if (!enabled) return
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load, enabled])

  return need
}
