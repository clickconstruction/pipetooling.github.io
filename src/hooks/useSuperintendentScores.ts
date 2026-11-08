import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatErrorMessage } from '../utils/errorHandling'
import { parseScoreRead, type ScoreRead } from '../lib/people/superintendentScores'
import { JOB_BUDGET_CHANGED_EVENT } from './useJobBudget'

/**
 * The scoreboard's read (punch list #234, PR 4): `superintendent_scores` for a period, parsed. The
 * database does the arithmetic and lets out only what the caller may see; a superintendent's own
 * read carries his rows and his bonus, no wage. Re-reads on `reload` and when a baseline lands.
 */
export function useSuperintendentScores(args: { fromYmd: string; toYmd: string; jobIds?: readonly string[] | null; enabled?: boolean }): { read: ScoreRead | null; loading: boolean; error: string | null; reload: () => void } {
  const { fromYmd, toYmd, jobIds = null, enabled = true } = args
  const [read, setRead] = useState<ScoreRead | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])
  const idsKey = jobIds ? jobIds.join(',') : ''

  useEffect(() => {
    if (!enabled || !fromYmd || !toYmd) {
      setRead(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const { data, error: err } = await supabase.rpc('superintendent_scores' as never, { p_from: fromYmd, p_to: toYmd, p_job_ids: jobIds && jobIds.length ? [...jobIds] : null } as never)
        if (err) throw err
        if (!cancelled) {
          setRead(parseScoreRead(data))
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the ids ride their joined key
  }, [enabled, fromYmd, toYmd, idsKey, tick])
  useEffect(() => {
    window.addEventListener(JOB_BUDGET_CHANGED_EVENT, reload)
    return () => window.removeEventListener(JOB_BUDGET_CHANGED_EVENT, reload)
  }, [reload])

  return { read, loading, error, reload }
}
