import { formatBidLedgerDocTitle, type LedgerPrefixMap } from '../ledgerDisplayPrefixes'

/** The Edit/New Job form's linked-bid label payload (subset of the bid row). */
export type JobFormLinkedBidSummary = {
  project_name: string | null
  bid_number: string | null
  service_type_id?: string | null
}

/**
 * Label for the job form's linked-bid line ("Linked: …") and the bid-summary
 * backfill effect: prefixed doc title when the bid has a number, else the bare
 * project name, else "Untitled".
 */
export function formatJobFormBidLinkTitle(
  prefixMap: LedgerPrefixMap,
  summary: JobFormLinkedBidSummary | null,
): string {
  if (!summary) return ''
  const name = (summary.project_name ?? '').trim() || 'Untitled'
  const n = summary.bid_number != null && String(summary.bid_number).trim() !== '' ? String(summary.bid_number).trim() : null
  return n ? formatBidLedgerDocTitle(prefixMap, summary.service_type_id ?? null, n, name) : name
}
