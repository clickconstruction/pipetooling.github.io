/**
 * The card-charge rule's two lookups, with the client passed in (punch list #360, PR 4), so a job's costs can be
 * read as the service role on the edge; `loadCardChargeExclusions.ts` binds the app's client.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { readAccountingBucketByTxId } from '../overheadPartsBucketReads'
import { EMPTY_CARD_CHARGE_EXCLUSIONS, type CardChargeExclusions } from './cardChargeAllocationFilter'

/** Mercury tx ids (among `txIds`) that carry a supply-house invoice link — the same purchase seen twice. */
export async function readMercuryTxIdsLinkedToSupplyInvoices(db: SupabaseClient<Database>, txIds: readonly string[]): Promise<Set<string>> {
  if (txIds.length === 0) return new Set()
  const rows = (await fetchAllRowsChunkedIn(
    [...txIds],
    (chunk, from, to) =>
      db
        .from('mercury_transaction_supply_house_invoice_links')
        .select('mercury_transaction_id')
        .in('mercury_transaction_id', chunk)
        .order('id')
        .range(from, to),
    'mercury invoice links by tx',
    { parallel: 4 },
  )) as Array<{ mercury_transaction_id: string }>
  return new Set(rows.map((r) => r.mercury_transaction_id))
}

/**
 * Loads the two lookups `cardChargeAllocationFilter` needs for a set of
 * transactions (chunked + paged). Each lookup degrades to "everything counts"
 * when RLS hides its table — a role that can't read buckets or links still sees
 * gross card charges rather than nothing.
 */
export async function readCardChargeExclusions(db: SupabaseClient<Database>, txIds: readonly string[]): Promise<CardChargeExclusions> {
  if (txIds.length === 0) return EMPTY_CARD_CHARGE_EXCLUSIONS
  const [bucketByTxId, invoiceLinkedTxIds] = await Promise.all([
    readAccountingBucketByTxId(db, txIds).catch(() => new Map<string, string>()),
    readMercuryTxIdsLinkedToSupplyInvoices(db, txIds).catch(() => new Set<string>()),
  ])
  return { bucketByTxId, invoiceLinkedTxIds }
}
