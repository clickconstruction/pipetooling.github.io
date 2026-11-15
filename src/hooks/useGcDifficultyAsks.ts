import { useCallback, useEffect, useState } from 'react'
import type { GcDifficultyOpenAsk } from '../lib/bids/gcDifficultyAsk'
import { GC_DIFFICULTY_ASKS_CHANGED_EVENT, supabaseGcDifficultyAskIo, type GcDifficultyAskIo } from '../lib/bids/gcDifficultyAskIo'
import { GC_DIFFICULTY_CHANGED_EVENT } from '../lib/bids/gcDifficultyRatingIo'

const NONE: readonly GcDifficultyOpenAsk[] = []
const DEFAULT_IO = supabaseGcDifficultyAskIo()

/**
 * The asks open for the person signed in (punch list #357, PR 5): the jobs they are the master on that reached
 * Ready to bill with a GC nobody has rated since. A failed read gives none: the ask is a nudge, and no screen waits
 * on it. It reads again when an ask is settled and when any GC is rated, since a rating answers its GC's asks.
 */
export function useGcDifficultyAsks(enabled: boolean, io: GcDifficultyAskIo = DEFAULT_IO): { asks: readonly GcDifficultyOpenAsk[]; io: GcDifficultyAskIo; reload: () => void } {
  const [asks, setAsks] = useState<readonly GcDifficultyOpenAsk[]>(NONE)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) {
      setAsks(NONE)
      return
    }
    let live = true
    io.loadOpen()
      .then((rows) => {
        if (live) setAsks(rows)
      })
      .catch(() => {
        if (live) setAsks(NONE)
      })
    return () => {
      live = false
    }
  }, [enabled, io, tick])

  useEffect(() => {
    if (!enabled) return
    window.addEventListener(GC_DIFFICULTY_ASKS_CHANGED_EVENT, reload)
    window.addEventListener(GC_DIFFICULTY_CHANGED_EVENT, reload)
    return () => {
      window.removeEventListener(GC_DIFFICULTY_ASKS_CHANGED_EVENT, reload)
      window.removeEventListener(GC_DIFFICULTY_CHANGED_EVENT, reload)
    }
  }, [enabled, reload])

  return { asks, io, reload }
}
