import { useCallback, useEffect, useState } from 'react'
import { formatErrorMessage } from '../utils/errorHandling'
import { loadZzTestJobIds } from '../lib/jobs/zzTestJobRows'
import { loadScorecard, type ScorecardRead } from '../lib/scorecard/loadScorecard'
import { fetchTeamScores } from '../lib/scorecard/teamScoresIo'
import { useAuth } from './useAuth'

/**
 * The scorecard's read (team scorecard, design spike 2026-11-15): the field score and the estimator score
 * over one window, the hurdle built from the same window's overhead and hours. Test jobs stay out, as on
 * the Bridge. Re-reads on `reload` and when the window changes. Since punch list #360 PR 4 the read is made by the
 * edge function `team-scores`; the browser makes it only while that function is not deployed.
 */
export function useScorecard(args: { windowDays: number; todayYmd: string; enabled?: boolean }): { read: ScorecardRead | null; /** Where the read was made: the edge function, or this browser while the function is not deployed. */ source: 'server' | 'browser' | null; loading: boolean; error: string | null; reload: () => void } {
  const { windowDays, todayYmd, enabled = true } = args
  const { user } = useAuth()
  const [read, setRead] = useState<ScorecardRead | null>(null)
  const [source, setSource] = useState<'server' | 'browser' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!enabled) {
      setRead(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        // #360 PR 4: the server makes the reads, so no wage comes to the browser. Only while the function is not
        // deployed does the page make them itself, as before, for the people the gate already lets read wages.
        const answer = await fetchTeamScores(windowDays)
        if (cancelled) return
        let r: ScorecardRead
        if (answer.kind === 'scores') {
          r = answer.read
        } else {
          const zz = await loadZzTestJobIds(user?.id ?? null)
          r = await loadScorecard({ windowDays, todayYmd, zzTestJobIds: zz, isCancelled: () => cancelled })
        }
        if (!cancelled) {
          setRead(r)
          setSource(answer.kind === 'scores' ? 'server' : 'browser')
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          if ((e as Error)?.message === 'cancelled') return
          setRead(null)
          setError(formatErrorMessage(e, 'The scores could not be read.'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, windowDays, todayYmd, user?.id, tick])

  return { read, source, loading, error, reload }
}
