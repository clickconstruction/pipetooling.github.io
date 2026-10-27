import { useCallback, useEffect, useState } from 'react'

import type { LowRatingsNeed } from '../lib/ratings/ratingsOffice'

/**
 * The review ask's Needs you line (v2.5946, punch list #185 PR 4): the answers at three stars or fewer that nobody has
 * called, inside thirty days, with the first one's job named. Built like `useCustomerMessagesCounts`: the reads load on
 * demand, only when the line is on, and refetch on window focus. Null while off, loading, or when none waits.
 */
export function useLowRatings(enabled: boolean): { need: LowRatingsNeed; jobWord: string | null } | null {
  const [low, setLow] = useState<{ need: LowRatingsNeed; jobWord: string | null } | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setLow(null)
      return
    }
    try {
      const [{ supabaseRatingsOfficeIo }, { lowRatingsNeed }] = await Promise.all([import('../lib/ratings/ratingsOfficeIo'), import('../lib/ratings/ratingsOffice')])
      const io = supabaseRatingsOfficeIo()
      const need = lowRatingsNeed(await io.lowOwed())
      if (!need) {
        setLow(null)
        return
      }
      const jobId = need.first?.jobId ?? null
      setLow({ need, jobWord: need.count === 1 && jobId ? await io.jobWord(jobId) : null })
    } catch {
      setLow(null)
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
  return low
}
