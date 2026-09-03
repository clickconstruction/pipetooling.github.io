// One fuel classifier for every surface that splits card charges (People →
// Review, Jobs → Job Summary): the Banking "Fuel / Gas" accounting label wins;
// a transaction with no label yet falls back to the bank's own FuelAndGas
// category, so the split is honest before the label rule has been applied and
// the label can still override the bank when it is wrong. Pure.

import { mercuryCategoryFromColumn } from './accountingLabelRuleMatch'

export const FUEL_ACCOUNTING_BUCKET = 'fuel_gas' as const
export const FUEL_BANK_CATEGORY = 'FuelAndGas' as const

/**
 * @param bucket the transaction's accounting bucket key (`fetchAccountingBucketByTxId`), or undefined when unlabelled
 * @param category the raw `mercury_transactions.mercury_category` value (jsonb)
 */
export function isFuelCardCharge(bucket: string | null | undefined, category: unknown): boolean {
  if (bucket === FUEL_ACCOUNTING_BUCKET) return true
  if (bucket != null) return false
  return (mercuryCategoryFromColumn(category) ?? '').toLowerCase() === FUEL_BANK_CATEGORY.toLowerCase()
}

export type FuelSplitAllocationRow = {
  job_id: string
  amount: number | string | null
  mercury_transaction_id: string | null
}

/**
 * Sums |amount| of the fuel allocations per job. Always a slice of the plain
 * card-charge sum for the same rows, so parts − fuel never goes negative.
 */
export function sumFuelChargesByJob(
  rows: readonly FuelSplitAllocationRow[],
  bucketByTxId: ReadonlyMap<string, string>,
  categoryByTxId: ReadonlyMap<string, unknown>,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of rows) {
    if (!r.mercury_transaction_id) continue
    const bucket = bucketByTxId.get(r.mercury_transaction_id)
    if (!isFuelCardCharge(bucket, categoryByTxId.get(r.mercury_transaction_id))) continue
    const abs = Math.abs(Number(r.amount)) || 0
    if (abs <= 0) continue
    out.set(r.job_id, (out.get(r.job_id) ?? 0) + abs)
  }
  return out
}
