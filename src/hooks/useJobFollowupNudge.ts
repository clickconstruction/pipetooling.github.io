import { useEffect, useMemo, useState } from 'react'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import {
  computeJobFollowupQueue,
  jobFollowupStageCounts,
  type JobFollowupStage,
} from '../lib/jobs/jobFollowupQueue'
import {
  fetchJobFollowupCandidates,
  fetchJobFollowupReviews,
  fetchJobFollowupSettings,
} from '../lib/jobs/jobFollowupStore'

/**
 * Job Follow-Up Mode queue size + stage breakdown (v2.2487): the fetch+compute
 * the dashboard banner ran inline, extracted so the Needs You card and the
 * Quickfill station read the same data. Count is null while loading, 0 on
 * error — a loading source contributes no Needs You item, an errored one
 * reports an empty queue (matching the banner it replaces).
 */
export function useJobFollowupNudge(enabled: boolean): {
  count: number | null
  stageCounts: Record<JobFollowupStage, number> | null
} {
  const [count, setCount] = useState<number | null>(null)
  const [counts, setCounts] = useState<Record<JobFollowupStage, number> | null>(null)
  const todayYmd = useMemo(() => calendarYmdInAppTzFromIso(new Date().toISOString()), [])

  useEffect(() => {
    if (!enabled) {
      setCount(null)
      setCounts(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [cands, revs, sets] = await Promise.all([
          fetchJobFollowupCandidates(todayYmd),
          fetchJobFollowupReviews(),
          fetchJobFollowupSettings(),
        ])
        if (cancelled) return
        const queue = computeJobFollowupQueue(cands, revs, sets, todayYmd)
        setCount(queue.length)
        setCounts(jobFollowupStageCounts(queue))
      } catch {
        if (!cancelled) {
          setCount(0)
          setCounts(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, todayYmd])

  return { count, stageCounts: counts }
}
