import { useEffect, useState } from 'react'
import type { UserRole } from './useAuth'
import { loadMyTraining, loadTrainingCatalog } from '../lib/training/trainingIo'
import { personStandings } from '../lib/training/trainingState'
import { todayYmdInAppTz } from '../utils/dateUtils'

/**
 * How many required courses this person still has to do: the red rows of the Training card, counted by the same
 * `personStandings`. The short Job Mode page (punch list #384) says it on its door, since the card itself sits
 * behind the door. Reads only while `enabled`, and a read that fails or a catalog that is not there counts none:
 * the line is a nudge, as the card is.
 */
export function useTrainingCoursesOwed(userId: string | null | undefined, role: UserRole | null, enabled: boolean): number {
  const [owed, setOwed] = useState(0)
  useEffect(() => {
    if (!enabled || !userId) {
      setOwed(0)
      return
    }
    let alive = true
    Promise.all([loadTrainingCatalog(), loadMyTraining(userId)])
      .then(([catalog, mine]) => {
        if (!alive) return
        if (catalog.missing || mine.missing) return setOwed(0)
        setOwed(personStandings(catalog.policies, mine.passes, role, todayYmdInAppTz()).filter((s) => s.colour === 'red').length)
      })
      .catch(() => {
        if (alive) setOwed(0)
      })
    return () => {
      alive = false
    }
  }, [enabled, userId, role])
  return owed
}
