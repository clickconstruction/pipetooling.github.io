/**
 * Sub-labor sheets grouped by the job they are on — the sheet's `job_ledger_id` link (v2.3055),
 * never its `job_number` text, which is display only since 20260914240000. Job Summary and the
 * Billing tab still joined on the number until v2.3838, so a job with no HCP number, a renumbered
 * job, two jobs sharing a number, or a hand-linked sheet whose typed number differs got the wrong
 * sub cost. A sheet with no link belongs to no job.
 */
export function subLaborSheetsByJobId<T extends { job_ledger_id?: string | null }>(sheets: readonly T[]): Map<string, T[]> {
  const byJob = new Map<string, T[]>()
  for (const sheet of sheets) {
    const jobId = sheet.job_ledger_id
    if (!jobId) continue
    const list = byJob.get(jobId)
    if (list) list.push(sheet)
    else byJob.set(jobId, [sheet])
  }
  return byJob
}
