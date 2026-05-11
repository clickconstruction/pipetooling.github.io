import type { Database } from '../types/database'
import { mercuryRowPassesSortingStartDate } from './bankingSortingConfig'

export type TallyLinkedMercuryRow = Database['public']['Functions']['list_my_linked_mercury_transactions_for_tally']['Returns'][number]
type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

export type TallyJobSplitEntry = { jobId: string; label: string }

export function tallyUniqueJobSplitEntries(jobSplits: TallyLinkedMercuryRow['job_splits']): TallyJobSplitEntry[] {
  if (!Array.isArray(jobSplits)) return []
  const seen = new Set<string>()
  const out: TallyJobSplitEntry[] = []
  for (const item of jobSplits) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const id = typeof o.job_id === 'string' ? o.job_id : null
    if (!id || seen.has(id)) continue
    seen.add(id)
    const hn = typeof o.hcp_number === 'string' ? o.hcp_number : ''
    const jn = typeof o.job_name === 'string' ? o.job_name : ''
    const label = `${hn} · ${jn}`.trim() || id
    out.push({ jobId: id, label })
  }
  return out
}

/** Matches Job Tally unlinked scope: no parsed job_splits and no jobs_summary string. */
export function tallyRowHasJobAllocations(row: TallyLinkedMercuryRow): boolean {
  return tallyUniqueJobSplitEntries(row.job_splits).length > 0 || !!row.jobs_summary?.trim()
}

export function mercuryTxRowFromTallyRpc(row: TallyLinkedMercuryRow): MercuryTxRow {
  const posted = row.posted_at ?? new Date().toISOString()
  return {
    id: row.mercury_transaction_id,
    amount: row.amount,
    counterparty_id: null,
    counterparty_name: row.counterparty_name ?? null,
    created_at: posted,
    currency: row.currency ?? 'USD',
    dashboard_link: null,
    external_memo: null,
    kind: '—',
    mercury_account_id: row.mercury_account_id ?? '',
    mercury_category: null,
    mercury_id: row.mercury_id ?? '',
    note: row.note ?? null,
    posted_at: row.posted_at,
    raw: row.raw ?? null,
    status: '—',
    synced_at: posted,
  }
}

/** Unlinked rows optional org floor on `posted_at` (same rule as Job Tally transactions tab). */
export function filterTallyRowsToUnlinkedWithOptionalMinPosted(
  rows: TallyLinkedMercuryRow[],
  minPostedYmd: string | null,
): TallyLinkedMercuryRow[] {
  return rows.filter((r) => {
    if (minPostedYmd != null && minPostedYmd !== '' && !mercuryRowPassesSortingStartDate(r.posted_at, minPostedYmd)) {
      return false
    }
    return !tallyRowHasJobAllocations(r)
  })
}
