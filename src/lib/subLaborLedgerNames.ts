/**
 * Sub Labor ledger's number → job-name join (useSubLaborLedger): build the
 * lookup from get_jobs_ledger_by_hcp_numbers rows. The RPC deliberately
 * resolves click-only jobs (empty hcp, matching click_number — migration
 * 20260619140000), so both numbers must key the map — keying hcp_number alone
 * threw those rows away and their sheets rendered a bare number with no job
 * name (the same class of bug PeopleReviewTab fixed for its own map).
 * Guarded inserts so the first resolution of a duplicate number wins.
 */
export type SubLaborLedgerNameRow = {
  hcp_number?: string | null
  click_number?: string | null
  job_name?: string | null
}

export function buildLaborJobNamesByNumber(rows: readonly SubLaborLedgerNameRow[]): Record<string, string> {
  const names: Record<string, string> = {}
  for (const j of rows) {
    const name = (j.job_name ?? '').trim()
    if (!name) continue
    for (const num of [j.hcp_number, j.click_number]) {
      const key = (num ?? '').trim().toLowerCase()
      if (key && !(key in names)) names[key] = name
    }
  }
  return names
}
