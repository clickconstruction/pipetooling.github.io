import { useEffect, useState } from 'react'
import type { ChecklistCostEstimate } from '../lib/checklistCostEstimate'
import {
  CHECKLIST_COST_CHANGED_EVENT,
  cachedChecklistCostEstimates,
  ensureChecklistCostEstimatesLoaded,
} from '../lib/checklistCostStore'

/**
 * Live map of costKey → estimate (dev-only cost system). Pass `enabled: false`
 * for non-dev viewers so no query fires — RLS would blank it anyway. Re-renders
 * whenever any estimate is saved or removed anywhere on the page.
 */
export function useChecklistCostEstimates(enabled: boolean): Record<string, ChecklistCostEstimate> {
  const [estimates, setEstimates] = useState<Record<string, ChecklistCostEstimate>>(() =>
    cachedChecklistCostEstimates(),
  )
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const refresh = () => {
      if (!cancelled) setEstimates(cachedChecklistCostEstimates())
    }
    window.addEventListener(CHECKLIST_COST_CHANGED_EVENT, refresh)
    ensureChecklistCostEstimatesLoaded().then(refresh, () => {
      /* load failure: chips stay empty; the next mount retries */
    })
    return () => {
      cancelled = true
      window.removeEventListener(CHECKLIST_COST_CHANGED_EVENT, refresh)
    }
  }, [enabled])
  return estimates
}
