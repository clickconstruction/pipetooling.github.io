/**
 * Where the crew is, per job, for the Pipeline board (Where the Job Is, PR 3).
 *
 * One `list_job_crew_position` call for the board's job ids → a map the
 * Progress & payment cell reads (PR 4). Fail-soft: a missing RPC (client ahead
 * of the push), a role the RPC refuses, or any error = an empty map, and the
 * cell draws what it drew before. Re-fetched when the set of ids changes
 * (order-insensitive) and on `reload()`; the caller decides when the board
 * is visible.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { crewPositionsFromRpc, type JobCrewPosition, type JobCrewPositionRpcRow } from '../lib/jobs/jobCrewPosition'
import { todayYmdInAppTz } from '../utils/dateUtils'

const EMPTY: ReadonlyMap<string, JobCrewPosition> = new Map()

export function useJobCrewPositions(jobIds: ReadonlyArray<string>, enabled: boolean): { crewByJobId: ReadonlyMap<string, JobCrewPosition>; loading: boolean; reload: () => void } {
  const [crewByJobId, setCrewByJobId] = useState<ReadonlyMap<string, JobCrewPosition>>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const seq = useRef(0)
  const key = useMemo(() => [...new Set(jobIds)].sort().join(','), [jobIds])

  useEffect(() => {
    if (!enabled || key.length === 0) {
      setCrewByJobId(EMPTY)
      return
    }
    const mine = ++seq.current
    const ids = key.split(',')
    const todayYmd = todayYmdInAppTz()
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('list_job_crew_position', { p_job_ids: ids, p_today: todayYmd })
        if (cancelled || mine !== seq.current) return
        if (error) {
          setCrewByJobId(EMPTY)
          return
        }
        setCrewByJobId(crewPositionsFromRpc((data ?? []) as JobCrewPositionRpcRow[], todayYmd))
      } catch {
        if (!cancelled && mine === seq.current) setCrewByJobId(EMPTY)
      } finally {
        if (!cancelled && mine === seq.current) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, key, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { crewByJobId, loading, reload }
}
