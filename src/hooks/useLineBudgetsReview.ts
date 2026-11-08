import { useCallback, useEffect, useState } from 'react'
import { lineBudgetsReview, type LineBudgetsReview } from '../lib/needsYou/lineBudgetsReview'
import { lineBudgetsReviewIo, type LineBudgetsReviewIo } from '../lib/needsYou/lineBudgetsReviewIo'
import { readLineBudgetSettings } from '../lib/jobs/lineBudgetSettingsStore'
import { LINE_BUDGET_SETTINGS_CHANGED_EVENT } from '../lib/jobs/lineBudgetSettingsStore'
import { JOB_BUDGET_CHANGED_EVENT } from './useJobBudget'

/**
 * The owner's weekly review of the assumed lines (punch list #234, PR 1c): the Needs you line's
 * figures and the window's rows from one read, so the two agree. Null while it reads and on a
 * refused read, so the card stays quiet. Reads again on `reload` (the window's stamp), when a
 * baseline lands and when the company split moves.
 */
export function useLineBudgetsReview(enabled: boolean, io: LineBudgetsReviewIo = lineBudgetsReviewIo): { review: LineBudgetsReview | null; reload: () => void } {
  const [review, setReview] = useState<LineBudgetsReview | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!enabled) {
      setReview(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const now = new Date().toISOString()
        const { jobs, fixtures } = await io.fetchSources(now)
        if (!cancelled) setReview(lineBudgetsReview(jobs, fixtures, readLineBudgetSettings(), now))
      } catch {
        if (!cancelled) setReview(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, io, tick])
  useEffect(() => {
    window.addEventListener(JOB_BUDGET_CHANGED_EVENT, reload)
    window.addEventListener(LINE_BUDGET_SETTINGS_CHANGED_EVENT, reload)
    return () => {
      window.removeEventListener(JOB_BUDGET_CHANGED_EVENT, reload)
      window.removeEventListener(LINE_BUDGET_SETTINGS_CHANGED_EVENT, reload)
    }
  }, [reload])

  return { review, reload }
}
