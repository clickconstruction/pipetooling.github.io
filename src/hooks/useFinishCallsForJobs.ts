import { useEffect, useMemo, useState } from 'react'
import type { FinishCall } from '../lib/jobMode/finishCall'
import { loadFinishCallsForJobs } from '../lib/jobMode/finishCallIo'

const EMPTY: ReadonlyMap<string, FinishCall[]> = new Map()

/**
 * What the crew said about each job's finish, by job (punch list #396, PR 3c): the Projects board's read of
 * `job_finish_calls`, so the office sees a superintendent's own day beside the plan.
 *
 * A read that fails leaves the board as it was. The line is an addition to a card that reads whole without it,
 * so no error is drawn for it.
 */
export function useFinishCallsForJobs(jobIds: readonly string[]): ReadonlyMap<string, FinishCall[]> {
  const key = useMemo(() => [...jobIds].sort().join(','), [jobIds])
  const [state, setState] = useState<{ key: string; byJob: ReadonlyMap<string, FinishCall[]> }>({ key: '', byJob: EMPTY })
  useEffect(() => {
    if (!key) return
    let alive = true
    loadFinishCallsForJobs(key.split(',')).then(
      (byJob) => {
        if (alive) setState({ key, byJob })
      },
      () => {
        if (alive) setState({ key, byJob: EMPTY })
      },
    )
    return () => {
      alive = false
    }
  }, [key])
  return state.key === key ? state.byJob : EMPTY
}
