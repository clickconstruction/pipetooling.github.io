import type { JobLinkedEstimateForStages } from '@/types/jobWithDetails'

type Candidate = JobLinkedEstimateForStages & { updated_at: string | null }

/** Prefer customer_accepted (newest updated_at, then higher estimate_number); else newest updated_at. */
export function pickLinkedEstimateForStagesBanner(candidates: Candidate[]): JobLinkedEstimateForStages | null {
  if (candidates.length === 0) return null
  const accepted = candidates.filter((c) => c.status === 'customer_accepted')
  const pool = accepted.length > 0 ? accepted : candidates
  const best = pool.reduce((a, b) => {
    const au = a.updated_at ?? ''
    const bu = b.updated_at ?? ''
    if (au > bu) return a
    if (au < bu) return b
    return a.estimate_number >= b.estimate_number ? a : b
  })
  const { updated_at: _u, ...rest } = best
  return rest
}
