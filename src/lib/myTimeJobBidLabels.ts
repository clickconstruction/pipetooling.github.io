/**
 * Job / bid labels of the My Time day editor: which ids of a day's sessions still have no label,
 * and what each label reads once its row is loaded. Pure — the two RPC reads live in
 * `useMyTimeJobBidLabels`.
 */
import {
  formatBidLedgerSummaryLine,
  formatJobLedgerSummaryLine,
  type LedgerPrefixMap,
} from './ledgerDisplayPrefixes'
import type { DayEditorSession } from './myTimeDayTimeline'

/** The columns of `get_jobs_ledger_by_ids` a label reads. */
export type MyTimeJobLabelRow = {
  id: string
  hcp_number: string
  click_number: string
  job_name: string
  job_address: string
  service_type_id: string | null
}

/** The columns of `get_bids_by_ids` a label reads. */
export type MyTimeBidLabelRow = {
  id: string
  bid_number: string
  project_name: string
  address: string
  service_type_id: string | null
}

/** The day's distinct job and bid ids that have no label yet (an empty label counts as none). */
export function missingJobBidLabelIds(
  sessions: ReadonlyArray<Pick<DayEditorSession, 'job_ledger_id' | 'bid_id'>>,
  jobLabels: Record<string, string>,
  bidLabels: Record<string, string>
): { needJobs: string[]; needBids: string[] } {
  const jobIds = [...new Set(sessions.map((s) => s.job_ledger_id).filter(Boolean))] as string[]
  const bidIds = [...new Set(sessions.map((s) => s.bid_id).filter(Boolean))] as string[]
  return {
    needJobs: jobIds.filter((id) => !jobLabels[id]),
    needBids: bidIds.filter((id) => !bidLabels[id]),
  }
}

/** What a job reads when its row did not come back, or the read failed. */
export function jobFallbackLabel(id: string): string {
  return `Job ${id.slice(0, 8)}…`
}

/** What a bid reads when its row did not come back, or the read failed. */
export function bidFallbackLabel(id: string): string {
  return `Bid ${id.slice(0, 8)}…`
}

/** One label per asked id: the ledger summary line of its row, or the fallback. */
export function jobLabelsForIds(
  ids: readonly string[],
  rows: readonly MyTimeJobLabelRow[],
  prefixMap: LedgerPrefixMap
): Record<string, string> {
  const byJobId = new Map(rows.map((j) => [j.id, j]))
  const next: Record<string, string> = {}
  for (const id of ids) {
    const j = byJobId.get(id)
    next[id] = j
      ? formatJobLedgerSummaryLine(prefixMap, j.service_type_id, j.hcp_number, j.job_name, j.job_address, j.click_number)
      : jobFallbackLabel(id)
  }
  return next
}

/** One label per asked id: the ledger summary line of its row, or the fallback. */
export function bidLabelsForIds(
  ids: readonly string[],
  rows: readonly MyTimeBidLabelRow[],
  prefixMap: LedgerPrefixMap
): Record<string, string> {
  const byBidId = new Map(rows.map((b) => [b.id, b]))
  const next: Record<string, string> = {}
  for (const id of ids) {
    const b = byBidId.get(id)
    next[id] = b
      ? formatBidLedgerSummaryLine(prefixMap, b.service_type_id, b.bid_number, b.project_name, b.address)
      : bidFallbackLabel(id)
  }
  return next
}
