/**
 * Materials on site on the Needs you card (punch list #209, v2.6728): the two facts the office reads
 * across every job with a box — the boxes not counted in 14 days, and the material that walked away
 * this week with its money. Pure: each job's summary in (`jobMaterialsSummary`), the card's figures
 * out. The jobs sort so the one worth opening first is first: the most money walked away, then the
 * most boxes due a count.
 */
export type MaterialsJobFacts = {
  jobId: string
  /** The live boxes due a count (`JobMaterialsSummary.stale.length`). */
  stale: number
  /** The short counts and Can't find presses of the last seven days. */
  missingLines: number
  /** Their money at the parts book's price, 0 where nothing is priced. */
  missingMoneyWeek: number
}

export type MaterialsNeeds = {
  staleBoxes: number
  staleJobs: number
  /** The job with the most boxes due, for the line's door when one job holds them all. */
  staleJobId: string | null
  missingLines: number
  missingMoneyWeek: number
  missingJobs: number
  /** The job losing the most money, for the line's door when one job holds it all. */
  missingJobId: string | null
}

export function materialsNeeds(jobs: ReadonlyArray<MaterialsJobFacts>): MaterialsNeeds {
  const stale = jobs.filter((j) => j.stale > 0).sort((a, b) => b.stale - a.stale)
  const missing = jobs.filter((j) => j.missingLines > 0).sort((a, b) => b.missingMoneyWeek - a.missingMoneyWeek || b.missingLines - a.missingLines)
  return {
    staleBoxes: stale.reduce((n, j) => n + j.stale, 0),
    staleJobs: stale.length,
    staleJobId: stale.length === 1 ? stale[0]!.jobId : null,
    missingLines: missing.reduce((n, j) => n + j.missingLines, 0),
    missingMoneyWeek: missing.reduce((n, j) => n + j.missingMoneyWeek, 0),
    missingJobs: missing.length,
    missingJobId: missing.length === 1 ? missing[0]!.jobId : null,
  }
}

/** The desk, or the one job's page when every line of the fact is on one job. */
export function materialsNeedsHref(jobId: string | null): string {
  return jobId ? `/jobs?tab=materials&job=${encodeURIComponent(jobId)}` : '/jobs?tab=materials'
}
