import { supabase } from '../supabase'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { fetchAccountingBucketByTxId } from '../overheadPartsBucketLoader'
import { EMPTY_CARD_CHARGE_EXCLUSIONS, type CardChargeExclusions } from './cardChargeAllocationFilter'

/** Mercury tx ids (among `txIds`) that carry a supply-house invoice link — the same purchase seen twice. */
export async function fetchMercuryTxIdsLinkedToSupplyInvoices(txIds: readonly string[]): Promise<Set<string>> {
  if (txIds.length === 0) return new Set()
  const rows = (await fetchAllRowsChunkedIn(
    [...txIds],
    (chunk, from, to) =>
      supabase
        .from('mercury_transaction_supply_house_invoice_links')
        .select('mercury_transaction_id')
        .in('mercury_transaction_id', chunk)
        .order('id')
        .range(from, to),
    'mercury invoice links by tx',
  )) as Array<{ mercury_transaction_id: string }>
  return new Set(rows.map((r) => r.mercury_transaction_id))
}

/**
 * Loads the two lookups `cardChargeAllocationFilter` needs for a set of
 * transactions (chunked + paged). Each lookup degrades to "everything counts"
 * when RLS hides its table — a role that can't read buckets or links still sees
 * gross card charges rather than nothing.
 */
export async function loadCardChargeExclusions(txIds: readonly string[]): Promise<CardChargeExclusions> {
  if (txIds.length === 0) return EMPTY_CARD_CHARGE_EXCLUSIONS
  const [bucketByTxId, invoiceLinkedTxIds] = await Promise.all([
    fetchAccountingBucketByTxId(txIds).catch(() => new Map<string, string>()),
    fetchMercuryTxIdsLinkedToSupplyInvoices(txIds).catch(() => new Set<string>()),
  ])
  return { bucketByTxId, invoiceLinkedTxIds }
}
