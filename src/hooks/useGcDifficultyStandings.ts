import { useEffect, useState } from 'react'
import type { GcDifficultyStanding } from '../lib/bids/gcDifficultyRating'
import { GC_DIFFICULTY_CHANGED_EVENT, dropGcDifficultyStandings, loadGcDifficultyStandings } from '../lib/bids/gcDifficultyRatingIo'

const NONE: ReadonlyMap<string, GcDifficultyStanding> = new Map()

/**
 * Each rated GC's standing by customer id (punch list #357, PR 2), for the chip beside a GC's name on the Bid Board
 * and the Workbench. A failed read gives nothing: the chip is a reminder, and a screen never waits on it. It reads
 * again when a rating is saved.
 */
export function useGcDifficultyStandings(enabled: boolean): ReadonlyMap<string, GcDifficultyStanding> {
  const [standings, setStandings] = useState<ReadonlyMap<string, GcDifficultyStanding>>(NONE)
  useEffect(() => {
    if (!enabled) {
      setStandings(NONE)
      return
    }
    let live = true
    const read = () => {
      loadGcDifficultyStandings()
        .then((m) => {
          if (live) setStandings(m)
        })
        .catch(() => {
          if (live) setStandings(NONE)
        })
    }
    const onChanged = () => {
      dropGcDifficultyStandings()
      read()
    }
    read()
    window.addEventListener(GC_DIFFICULTY_CHANGED_EVENT, onChanged)
    return () => {
      live = false
      window.removeEventListener(GC_DIFFICULTY_CHANGED_EVENT, onChanged)
    }
  }, [enabled])
  return standings
}
