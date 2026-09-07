/**
 * Sub Labor ledger's job-name lookup (useSubLaborLedger), keyed by jobs_ledger
 * id — the sheet's `job_ledger_id` (v2.3065). The number-keyed map this
 * replaced had to key both HCP and click numbers and still lost sheets whose
 * text did not match; the link has neither problem.
 */
export type SubLaborLedgerNameRow = { id: string; job_name?: string | null }

export function buildLaborJobNamesById(rows: readonly SubLaborLedgerNameRow[]): Record<string, string> {
  const names: Record<string, string> = {}
  for (const j of rows) {
    const name = (j.job_name ?? '').trim()
    if (!name || !j.id || j.id in names) continue
    names[j.id] = name
  }
  return names
}
