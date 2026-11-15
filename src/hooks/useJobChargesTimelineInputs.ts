import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { readJobChargesTimelineInputs, type JobChargesTimelineInputs, type JobChargesTimelineJob } from '../lib/jobs/jobChargesTimelineReads'
import type { JobWithDetails } from '../types/jobWithDetails'

export type { JobChargesTimelineInputs, JobChargesTimelineJob } from '../lib/jobs/jobChargesTimelineReads'

export type JobChargesTimelineInputsState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; inputs: JobChargesTimelineInputs }

/**
 * One job's cost events, reports and payments (the hook's body, lifted out in v2.5046 so Bids → Bid
 * Costs → Bid vs actual loads each linked job exactly as its Costs tab does). Throws on a failed read. The reads
 * live in `lib/jobs/jobChargesTimelineReads.ts` with the client passed in (punch list #360, PR 4); this binds the app's.
 */
export function loadJobChargesTimelineInputs(job: JobChargesTimelineJob, includeTeamLabor: boolean): Promise<JobChargesTimelineInputs> {
  return readJobChargesTimelineInputs(supabase, job, includeTeamLabor)
}

/**
 * One job's cost events, reports and payments — the inputs the Cost Timeline
 * charts and, since v2.3189, the Burn section reads. Extracted from
 * `JobChargesTimelineStandalone` so the Costs tab fetches once for both.
 * Only this job's data (no org-wide scans): materials snapshot, reports,
 * sub-labor sheets by job link, per-job team labor (gated — when
 * `includeTeamLabor` is false the wage-derived fetch never runs), mileage
 * settings; payments / revenue / materials come from the job row.
 */
export function useJobChargesTimelineInputs(job: JobWithDetails, includeTeamLabor: boolean, enabled = true): JobChargesTimelineInputsState {
  const [state, setState] = useState<JobChargesTimelineInputsState>({ kind: 'loading' })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setState({ kind: 'loading' })
    void (async () => {
      try {
        const inputs = await loadJobChargesTimelineInputs(job, includeTeamLabor)
        if (!cancelled) setState({ kind: 'ready', inputs })
      } catch {
        if (!cancelled) setState({ kind: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [job.id, includeTeamLabor, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}
