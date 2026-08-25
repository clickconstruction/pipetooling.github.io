import { useEffect, useState } from 'react'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { computeJobFollowupQueue } from '../lib/jobs/jobFollowupQueue'
import {
  fetchJobFollowupCandidates,
  fetchJobFollowupReviews,
  fetchJobFollowupSettings,
} from '../lib/jobs/jobFollowupStore'

/**
 * Outstanding follow-up count for the Pipeline's Follow-ups button (v2.2307):
 * the same queue math as the deck (stage-quiet thresholds, "Looks fine" rests,
 * snoozes), riding the store's shared 5-minute candidates cache — opening the
 * deck later force-refreshes that cache, this badge never does. Returns null
 * until loaded (render nothing). Bump `refreshKey` to recount (the tab does it
 * when the deck closes, so working the queue visibly shrinks the number).
 */
export function useJobFollowupQueueCount(refreshKey: number): number | null {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
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
        setCount(computeJobFollowupQueue(candidates, reviews, settings, todayYmd).length)
      } catch {
        // Badge is a nicety — on failure just show the plain button.
        if (!cancelled) setCount(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return count
}
