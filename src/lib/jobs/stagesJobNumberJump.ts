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

export function findJobsByNumber<T extends JobNumberJumpCandidate>(jobs: T[], digitsRaw: string): T[] {
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
