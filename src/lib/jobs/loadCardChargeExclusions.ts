import { supabase } from '../supabase'
import { readCardChargeExclusions, readMercuryTxIdsLinkedToSupplyInvoices } from './cardChargeExclusionsReads'
import type { CardChargeExclusions } from './cardChargeAllocationFilter'

// The reads live in `cardChargeExclusionsReads.ts` with the client passed in (punch list #360, PR 4); this file binds
// the app's client for every reader in the app.

/** Mercury tx ids (among `txIds`) that carry a supply-house invoice link — the same purchase seen twice. */
export function fetchMercuryTxIdsLinkedToSupplyInvoices(txIds: readonly string[]): Promise<Set<string>> {
  return readMercuryTxIdsLinkedToSupplyInvoices(supabase, txIds)
}

/**
 * Loads the two lookups `cardChargeAllocationFilter` needs for a set of transactions (chunked + paged). Each lookup
 * degrades to "everything counts" when RLS hides its table.
 */
export function loadCardChargeExclusions(txIds: readonly string[]): Promise<CardChargeExclusions> {
  return readCardChargeExclusions(supabase, txIds)
}
