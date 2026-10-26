import { supabase } from './supabase'
import { readAccountingBucketByTxId, readOfficePartsUsdByDayExcludingInternalTransfer, type OfficePartsExcludingInternalTransferResult } from './overheadPartsBucketReads'
import type { OverheadPartsAccountingBucketKey } from './overheadPartsAccountingBuckets'

// The reads live in `overheadPartsBucketReads.ts` with the client passed in (v2.5880); this file binds the app's
// client for the Overhead tab, the pool snapshot, the job day ledger and the card charge exclusions.
export { collectMercuryTxIds, type OfficePartsExcludingInternalTransferResult } from './overheadPartsBucketReads'

/** Banking → Accounting drag-sort bucket per Mercury transaction id; tx ids with no assignment row are absent. */
export function fetchAccountingBucketByTxId(txIds: readonly string[]): Promise<Map<string, OverheadPartsAccountingBucketKey>> {
  return readAccountingBucketByTxId(supabase, txIds)
}

/**
 * The ONE way to build a window's office-parts overhead pool component: office-job materials by day, each Mercury
 * line's Banking → Accounting bucket, and the per-day sum EXCLUDING Internal Transfers (the #983 correctness rule).
 */
export function loadOfficePartsUsdByDayExcludingInternalTransfer(args: { officeJobLedgerId: string; startYmd: string; endYmd: string }): Promise<OfficePartsExcludingInternalTransferResult> {
  return readOfficePartsUsdByDayExcludingInternalTransfer(supabase, args)
}
