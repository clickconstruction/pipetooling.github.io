import { useEffect, useState } from 'react'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { computeJobFollowupQueue } from '../lib/jobs/jobFollowupQueue'
import { fetchJobFollowupCandidates, fetchJobFollowupReviews, fetchJobFollowupSettings } from '../lib/jobs/jobFollowupStore'

const EMPTY: ReadonlyMap<string, number> = new Map()

/**
 * Quiet days per job from the follow-up queue (punch list #30, PR 2a): the phone Pipeline's
 * "quiet N d" chip. Same math and the same shared candidates cache as the Follow-ups badge
 * (`useJobFollowupQueueCount`); loads only while `enabled`, so the desktop never pays for it.
 * Empty until loaded, and empty on failure — the chip is a nicety.
 */
export function useJobFollowupQuietDays(enabled: boolean, refreshKey: number): ReadonlyMap<string, number> {
  const [byJob, setByJob] = useState<ReadonlyMap<string, number>>(EMPTY)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())
    void (async () => {
      try {
        const [candidates, reviews, settings] = await Promise.all([
          fetchJobFollowupCandidates(todayYmd),
          fetchJobFollowupReviews(),
          fetchJobFollowupSettings(),
        ])
        if (cancelled) return
        const next = new Map<string, number>()
        for (const e of computeJobFollowupQueue(candidates, reviews, settings, todayYmd)) next.set(e.job.id, e.quietDays)
        setByJob(next)
      } catch {
        if (!cancelled) setByJob(EMPTY)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, refreshKey])

  return byJob
}
