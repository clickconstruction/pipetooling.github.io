import { useEffect, useState } from 'react'
import {
  EMPTY_REVIEW_OVERHEAD_RATES,
  loadReviewOverheadRates,
  type ReviewOverheadRates,
} from '../lib/people/loadReviewOverheadRates'

/**
 * The Review tab's 90-day overhead rates: loads once per signed-in dev, shows
 * `loading` while the scan runs, and resets to all-null — silently — when it
 * fails. Independent of the review period.
 */
export function useReviewOverheadRates(isDev: boolean, authUserId: string | undefined): ReviewOverheadRates {
  const [rates, setRates] = useState<ReviewOverheadRates>(EMPTY_REVIEW_OVERHEAD_RATES)

  useEffect(() => {
    if (!isDev || !authUserId) return
    let cancelled = false
    setRates((prev) => ({ ...prev, loading: true }))
    void (async () => {
      try {
        const loaded = await loadReviewOverheadRates({ isCancelled: () => cancelled })
        if (loaded && !cancelled) setRates(loaded)
      } catch {
        if (!cancelled) setRates(EMPTY_REVIEW_OVERHEAD_RATES)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isDev, authUserId])

  return rates
}
