import type { Database } from '../types/database'
import { mercuryRowPassesSortingStartDate, type BankingSortingConfigV1 } from './bankingSortingConfig'
import { mercuryDebitCardIdFromRaw } from './mercuryRawDebitCard'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

/** Minimal split row for counting job-linked rows (matches MercuryJobSplit shape for length checks). */
type AllocSplitForCount = { job_id: string; amount: number }

function textContainsAnyInsensitive(haystack: string | null | undefined, patterns: string[]): boolean {
  const h = (haystack ?? '').toLowerCase()
  return patterns.some((p) => p.length > 0 && h.includes(p.toLowerCase()))
}

export function filterMercuryRowsForSorting(rows: MercuryTxRow[], cfg: BankingSortingConfigV1): MercuryTxRow[] {
  const xc = cfg.excludeCounterpartyContains ?? []
  const xn = cfg.excludeNoteContains ?? []
  return rows.filter((r) => {
    if (cfg.kinds.length > 0 && !cfg.kinds.includes(r.kind)) return false
    if (cfg.accountIds.length > 0 && !cfg.accountIds.includes(r.mercury_account_id)) return false
    if (cfg.debitCardIds.length > 0) {
      const debitId = mercuryDebitCardIdFromRaw(r.raw)
      if (debitId === null || !cfg.debitCardIds.includes(debitId)) return false
    }
    if (!mercuryRowPassesSortingStartDate(r.posted_at, cfg.startDateYmd)) return false
    if (textContainsAnyInsensitive(r.counterparty_name, xc)) return false
    if (textContainsAnyInsensitive(r.note, xn)) return false
    return true
  })
}

export function mercuryRowIncompleteForSorting(
  row: MercuryTxRow,
  personIdByTxId: Map<string, string | null>,
  userIdByTxId: Map<string, string | null>,
  allocationsByTxId: Map<string, AllocSplitForCount[]>,
): boolean {
  const uid = userIdByTxId.get(row.id) ?? null
  const pid = personIdByTxId.get(row.id) ?? null
  const hasPerson = uid != null || pid != null
  const hasJobSplit = (allocationsByTxId.get(row.id) ?? []).length > 0
  return !hasPerson || !hasJobSplit
}

export function filterMercuryRowsIncompleteForSorting(
  rows: MercuryTxRow[],
  personIdByTxId: Map<string, string | null>,
  userIdByTxId: Map<string, string | null>,
  allocationsByTxId: Map<string, AllocSplitForCount[]>,
): MercuryTxRow[] {
  return rows.filter((r) => mercuryRowIncompleteForSorting(r, personIdByTxId, userIdByTxId, allocationsByTxId))
}

export function countSortingUnmatched(
  filtered: MercuryTxRow[],
  personIdByTxId: Map<string, string | null>,
  userIdByTxId: Map<string, string | null>,
  allocationsByTxId: Map<string, AllocSplitForCount[]>,
): { withoutPerson: number; withoutJobSplit: number } {
  let withoutPerson = 0
  let withoutJobSplit = 0
  for (const r of filtered) {
    const uid = userIdByTxId.get(r.id) ?? null
    const pid = personIdByTxId.get(r.id) ?? null
    const hasPerson = uid != null || pid != null
    const hasJobSplit = (allocationsByTxId.get(r.id) ?? []).length > 0
    if (!hasPerson) withoutPerson += 1
    if (!hasJobSplit) withoutJobSplit += 1
  }
  return { withoutPerson, withoutJobSplit }
}
