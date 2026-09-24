/**
 * The Stage Plan's fetched inputs for every Working job on the Pipeline at
 * once (to-dos/stage-plan-residuals item 1): the jobs' stage windows, the sub
 * orders on those windows, and the orders' sheets — three paged, id-chunked
 * reads, the client-side twin of `loadGcStageInputs` in
 * supabase/functions/_shared/gcStages.ts. Line items, invoices and payments
 * ride the board rows already, so they are not fetched here.
 *
 * Returns null until the first fetch lands (the header keeps its formula
 * figure meanwhile) and after a failed read; re-fetches when the set of job
 * ids changes, keeping the last result on screen while the new one is out.
 * The fetch itself lives in `lib/jobs/fetchWorkingStagePlanInputs.ts` (v2.3809)
 * so `fetchStagesHeaderStats` can read the same rows.
 */
import { useEffect, useState } from 'react'
import { fetchWorkingStagePlanInputs } from '../lib/jobs/fetchWorkingStagePlanInputs'
import type { WorkingStageInputs } from '../lib/jobs/capableToBillPlan'

export { fetchWorkingStagePlanInputs }

/**
 * `enabled` false (the Working scope isn't loaded — the rows carry no line
 * items anyway) hands back null without a read.
 */
export function useWorkingStagePlanInputs(jobIds: readonly string[], enabled: boolean): WorkingStageInputs | null {
  const key = enabled ? [...new Set(jobIds)].sort().join(',') : null
  const [inputs, setInputs] = useState<WorkingStageInputs | null>(null)
  useEffect(() => {
    if (key == null) {
      setInputs(null)
      return
    }
    let cancelled = false
    void fetchWorkingStagePlanInputs(key === '' ? [] : key.split(','))
      .then((r) => {
        if (!cancelled) setInputs(r)
      })
      .catch((err: unknown) => {
        console.warn('[useWorkingStagePlanInputs] stage inputs unavailable — the header keeps its formula figure', err)
        if (!cancelled) setInputs(null)
      })
    return () => {
      cancelled = true
    }
  }, [key])
  return inputs
}
