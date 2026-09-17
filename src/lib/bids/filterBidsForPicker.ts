/**
 * The bid picker's search (Pricing train, Stage A — v2.3546): project name, address,
 * customer, GC/Builder — case-insensitive substring — or the bid number through
 * `bidNumberMatchesQuery`. A blank query returns the list untouched. Lifted verbatim from
 * the copy `BidsPricingTab` and `BidsLaborTab` each carried (twelve more tabs carry the
 * same lines; the shared picker component is the next step).
 */
import { bidNumberMatchesQuery, type LedgerPrefixMap } from '../ledgerDisplayPrefixes'

export type PickerBid = {
  project_name?: string | null
  address?: string | null
  customers?: { name?: string | null } | null
  bids_gc_builders?: { name?: string | null } | null
  bid_number?: string | null
  service_type_id?: string | null
}

export function filterBidsForPicker<T extends PickerBid>(bids: readonly T[], query: string, ledgerPrefixMap: LedgerPrefixMap): T[] {
  if (!query.trim()) return [...bids]
  const q = query.toLowerCase()
  return bids.filter(
    (b) =>
      (b.project_name?.toLowerCase().includes(q) ?? false) ||
      (b.address?.toLowerCase().includes(q) ?? false) ||
      (b.customers?.name?.toLowerCase().includes(q) ?? false) ||
      (b.bids_gc_builders?.name?.toLowerCase().includes(q) ?? false) ||
      bidNumberMatchesQuery(b, query, ledgerPrefixMap),
  )
}
