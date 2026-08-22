/**
 * Office-only job shortcuts under the globe modal's live preview (v2.2054):
 * match the statement's bill rows (public payload — job NUMBERS only, no ids
 * by design) to the office's own jobs_ledger rows, yielding one Edit-Job
 * chip per job. Pure kernel; the modal does the two fetches.
 */

export type StatementBillPick = {
  jobNumber: string
  serviceTag?: string | null
  amount: number
}

export type StatementJobPick = {
  id: string
  hcp_number: string | null
  click_number: string | null
}

export type StatementJobLink = {
  jobId: string
  jobNumber: string
  serviceTag: string | null
  /** Sum of the job's open statement rows — a job can carry several bills. */
  amount: number
}

/**
 * One chip per job, in statement order, amounts summed across a job's bills.
 * Bills whose number matches no office job (or has no number) are skipped —
 * a chip that can't open Edit Job is worse than no chip.
 */
export function buildStatementJobLinks(
  bills: StatementBillPick[],
  jobs: StatementJobPick[],
): StatementJobLink[] {
  const jobByNumber = new Map<string, string>()
  for (const j of jobs) {
    const n = (j.hcp_number ?? '').trim() || (j.click_number ?? '').trim()
    if (n && !jobByNumber.has(n)) jobByNumber.set(n, j.id)
  }
  const out: StatementJobLink[] = []
  const byJobId = new Map<string, StatementJobLink>()
  for (const b of bills) {
    const n = (b.jobNumber ?? '').trim()
    if (!n) continue
    const jobId = jobByNumber.get(n)
    if (!jobId) continue
    const held = byJobId.get(jobId)
    if (held) {
      held.amount = Math.round((held.amount + b.amount) * 100) / 100
      continue
    }
    const link: StatementJobLink = {
      jobId,
      jobNumber: n,
      serviceTag: b.serviceTag ?? null,
      amount: b.amount,
    }
    byJobId.set(jobId, link)
    out.push(link)
  }
  return out
}
