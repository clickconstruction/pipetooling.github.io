import type { Database } from '../types/database'
import { parseTallyJobSplitsJson } from './tallyJobSplits'

type TallyLinkedMercuryRow = Database['public']['Functions']['list_my_linked_mercury_transactions_for_tally']['Returns'][number]

function pushPart(parts: string[], v: string | null | undefined): void {
  if (typeof v !== 'string') return
  const t = v.trim()
  if (t !== '') parts.push(t)
}

/** Lowercased, space-joined string for substring search (counterparty, note, jobs, splits, tx id, amount). */
export function buildTallyLinkedMercuryRowSearchHaystack(
  row: TallyLinkedMercuryRow,
  jobLabelById: Record<string, string>,
): string {
  const parts: string[] = []
  pushPart(parts, row.counterparty_name)
  pushPart(parts, row.note)
  pushPart(parts, row.tally_user_note)
  pushPart(parts, row.jobs_summary)
  pushPart(parts, row.mercury_transaction_id)
  if (typeof row.amount === 'number' && Number.isFinite(row.amount)) parts.push(String(row.amount))

  const parsed = parseTallyJobSplitsJson(row.job_splits)
  for (const s of parsed) {
    pushPart(parts, jobLabelById[s.job_id])
    pushPart(parts, s.note)
  }

  const raw = row.job_splits
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      pushPart(parts, typeof o.hcp_number === 'string' ? o.hcp_number : undefined)
      pushPart(parts, typeof o.job_name === 'string' ? o.job_name : undefined)
      pushPart(parts, typeof o.note === 'string' ? o.note : undefined)
    }
  }

  return parts.join(' ').toLowerCase()
}

/** `queryLower` must be trim + toLowerCase; empty means no filter (caller should skip filtering). */
export function tallyLinkedMercuryRowMatchesSearch(
  row: TallyLinkedMercuryRow,
  queryLower: string,
  jobLabelById: Record<string, string>,
): boolean {
  if (queryLower === '') return true
  return buildTallyLinkedMercuryRowSearchHaystack(row, jobLabelById).includes(queryLower)
}

export function filterTallyLinkedMercuryRowsBySearchQuery(
  rows: TallyLinkedMercuryRow[],
  queryRaw: string,
  jobLabelById: Record<string, string>,
): TallyLinkedMercuryRow[] {
  const q = queryRaw.trim().toLowerCase()
  if (q === '') return rows
  return rows.filter((r) => tallyLinkedMercuryRowMatchesSearch(r, q, jobLabelById))
}
