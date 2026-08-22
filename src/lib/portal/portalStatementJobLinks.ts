/**
 * Office-only bill rows under the globe modal's live preview (v2.2054;
 * statement-mirror rework v2.2064): match the statement's bill rows (public
 * payload — job NUMBERS only, no ids by design) to the office's own
 * jobs_ledger rows. ONE ROW PER BILL, in statement order with dates and pay
 * links, so the strip reads as the statement's mirror. Pure kernel; the
 * modal does the two fetches.
 */

export type StatementBillPick = {
  jobNumber: string
  serviceTag?: string | null
  amount: number
  billedOn?: string | null
  payUrl?: string | null
}

export type StatementJobPick = {
  id: string
  hcp_number: string | null
  click_number: string | null
}

export type StatementBillRow = {
  jobId: string
  jobNumber: string
  serviceTag: string | null
  amount: number
  billedOn: string | null
  payUrl: string | null
}

/**
 * One row per statement bill, statement order preserved (duplicated job
 * numbers included — that's what makes it a mirror). Bills whose number
 * matches no office job (or has no number) are skipped — a row that can't
 * open Edit Job is worse than no row.
 */
export function buildStatementBillRows(
  bills: StatementBillPick[],
  jobs: StatementJobPick[],
): StatementBillRow[] {
  const jobByNumber = new Map<string, string>()
  for (const j of jobs) {
    const n = (j.hcp_number ?? '').trim() || (j.click_number ?? '').trim()
    if (n && !jobByNumber.has(n)) jobByNumber.set(n, j.id)
  }
  const out: StatementBillRow[] = []
  for (const b of bills) {
    const n = (b.jobNumber ?? '').trim()
    if (!n) continue
    const jobId = jobByNumber.get(n)
    if (!jobId) continue
    out.push({
      jobId,
      jobNumber: n,
      serviceTag: b.serviceTag ?? null,
      amount: b.amount,
      billedOn: b.billedOn ?? null,
      payUrl: b.payUrl ?? null,
    })
  }
  return out
}
