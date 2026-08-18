/**
 * Stages "#" micro-search (v2.1135): pure matching + section routing for the
 * jump-to-job-number chip. Digits only, matched against BOTH job numbers (HCP
 * and C#): exact hits first (HCP before C#), then prefix hits, stable by input
 * order within each tier — so Enter on a partial number lands on the earliest
 * board row that starts with it.
 */

export type JobNumberJumpCandidate = {
  id: string
  status: string | null
  collections_at?: string | null
  hcp_number?: string | null
  click_number?: string | null
}

/** Matching needs only the two numbers — also reused by the Add-job-to-schedule picker's "#" mode. */
export function findJobsByNumber<T extends Pick<JobNumberJumpCandidate, 'hcp_number' | 'click_number'>>(
  jobs: T[],
  digitsRaw: string,
): T[] {
  const digits = (digitsRaw ?? '').replace(/\D/g, '')
  if (digits === '') return []
  const exact: T[] = []
  const prefix: T[] = []
  for (const job of jobs) {
    const hcp = (job.hcp_number ?? '').trim()
    const click = (job.click_number ?? '').trim()
    if (hcp === digits || click === digits) {
      exact.push(job)
      continue
    }
    if ((hcp !== '' && hcp.startsWith(digits)) || (click !== '' && click.startsWith(digits))) {
      prefix.push(job)
    }
  }
  return [...exact, ...prefix]
}

/**
 * Paid-fallback state for a jump that missed the loaded board (v2.1808).
 * The Paid in Full list is lazy, so a paid job's number isn't in memory until
 * `fetchPaidJobsIfNeeded` merges it. When Enter misses, the shell parks the
 * digits as a pending jump and re-runs this resolver as the cache updates:
 *
 *   - paid rows already merged for the current cache key → the miss is final
 *     (done, hit = whatever the fresh match finds — normally null).
 *   - paid fetch still loading → keep waiting (not done).
 *   - not merged and not loading (fetch failed or never started) → give up
 *     with the current match rather than spin forever.
 */
export function resolvePendingNumberJump<T extends Pick<JobNumberJumpCandidate, 'hcp_number' | 'click_number'>>(args: {
  jobs: T[]
  digits: string
  paidJobsLoading: boolean
  /** `paidJobsMergedForKey === jobsListDataKey && jobsListDataKey != null` — paid rows are in `jobs`. */
  paidMergedForCurrentKey: boolean
}): { done: false } | { done: true; matches: T[] } {
  const matches = findJobsByNumber(args.jobs, args.digits)
  // A hit is always final — no reason to keep the user waiting on the rest of
  // the paid fetch when the number already resolves.
  if (matches.length > 0) return { done: true, matches }
  if (args.paidMergedForCurrentKey) return { done: true, matches }
  if (args.paidJobsLoading) return { done: false }
  return { done: true, matches }
}

/**
 * Stages section-open key the job's row lives under. Unlike
 * stagesSectionKeyForJobStatus (stage-move destinations), this covers the
 * whole board: billed rows flagged collections_at sit in Collections, and
 * paid jobs in Paid in Full.
 */
export function stagesSectionKeyForJobRow(
  job: Pick<JobNumberJumpCandidate, 'status' | 'collections_at'>,
): 'waiting' | 'working' | 'readyToBill' | 'billed' | 'collections' | 'paid' | null {
  switch (job.status ?? 'working') {
    case 'waiting':
      return 'waiting'
    case 'working':
      return 'working'
    case 'ready_to_bill':
      return 'readyToBill'
    case 'billed':
      return job.collections_at != null ? 'collections' : 'billed'
    case 'paid':
      return 'paid'
    default:
      return null
  }
}
