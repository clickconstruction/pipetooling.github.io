import { useCallback, useEffect, useState } from 'react'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { IN_KIND_CHANGED_EVENT, inKindCreditsDue, type InKindCreditsDue, type InKindDealForDue } from '../lib/inKind/inKindCreditsDue'
import { loadInKindDealsForDue } from '../lib/inKind/inKindIo'

export interface InKindCreditsDueIo {
  loadDeals: () => Promise<InKindDealForDue[]>
}
const REAL_IO: InKindCreditsDueIo = { loadDeals: loadInKindDealsForDue }

/**
 * The months of in-kind credit nobody has entered (punch list #301, PR 3): the Needs you line's count and its door.
 * Null while it reads and on a refused read, so the card stays quiet. Reads again when a deal or a line changes
 * anywhere in the app.
 */
export function useInKindCreditsDue(enabled: boolean, io: InKindCreditsDueIo = REAL_IO): { credits: InKindCreditsDue | null } {
  const [credits, setCredits] = useState<InKindCreditsDue | null>(null)

  const load = useCallback(async () => {
    if (!enabled) {
      setCredits(null)
      return
    }
    try {
      setCredits(inKindCreditsDue(await io.loadDeals(), todayYmdInAppTz()))
    } catch {
      setCredits(null)
    }
  }, [enabled, io])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onChanged = () => void load()
    window.addEventListener(IN_KIND_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(IN_KIND_CHANGED_EVENT, onChanged)
  }, [load])

  return { credits }
}
