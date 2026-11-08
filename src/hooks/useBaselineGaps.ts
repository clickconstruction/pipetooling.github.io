import { useCallback, useEffect, useState } from 'react'
import { JOB_KIND_CHANGED_EVENT } from '../lib/jobs/jobKindWrite'
import { JOB_BUDGET_CHANGED_EVENT } from './useJobBudget'
import { projectsWithNoBaseline } from '../lib/needsYou/fillInBaselines'
import { baselineFillInIo, type BaselineFillInIo } from '../lib/needsYou/fillInBaselinesIo'

export type BaselineGaps = { count: number }

/**
 * The working projects with no hours baseline (punch list #234, PR 1a): the Needs you line's count,
 * the deck's own candidates read by the same kernel, so the line and the deck agree. Null while it
 * reads and on a refused read, so the card stays quiet. Reads again when a baseline or a kind lands
 * anywhere in the app.
 */
export function useBaselineGaps(enabled: boolean, io: Pick<BaselineFillInIo, 'fetchCandidates'> = baselineFillInIo): { gaps: BaselineGaps | null } {
  const [gaps, setGaps] = useState<BaselineGaps | null>(null)

  const load = useCallback(async () => {
    if (!enabled) {
      setGaps(null)
      return
    }
    try {
      const { jobs, fixtures, budgets } = await io.fetchCandidates()
      setGaps({ count: projectsWithNoBaseline(jobs, fixtures, budgets).length })
    } catch {
      setGaps(null)
    }
  }, [enabled, io])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onChanged = () => void load()
    window.addEventListener(JOB_BUDGET_CHANGED_EVENT, onChanged)
    window.addEventListener(JOB_KIND_CHANGED_EVENT, onChanged)
    return () => {
      window.removeEventListener(JOB_BUDGET_CHANGED_EVENT, onChanged)
      window.removeEventListener(JOB_KIND_CHANGED_EVENT, onChanged)
    }
  }, [load])

  return { gaps }
}
