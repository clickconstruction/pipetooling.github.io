import type { OverheadPartsDetailLine } from './fetchOverheadOfficePartsByDay'

/**
 * Four-bucket accounting view used in the Field Total ($) / Hours modal's
 * Materials (field / non-office jobs) dropdown.
 *
 * The user-facing categorization the Field Total modal cares about is just
 * Fuel / Gas vs. COGS vs. Internal Transfers vs. Other; the underlying
 * Banking → Accounting tab exposes many more Schedule C labels (Supplies,
 * Repairs, Insurance, etc.). Anything that doesn't map to the three named
 * buckets falls into Other.
 *
 * Internal Transfers is a non-expense category — it represents money moving
 * between the org's own accounts and is **excluded from the Materials total**
 * shown in the modal header. The hard block in
 * `BankingMercuryDragSortTab` / `MercuryTransactionAllocationsModal` prevents
 * new transactions from ending up here, but legacy splits may still appear
 * so users can clean them up.
 */
export type OverheadPartsAccountingBucketKey =
  | 'fuel_gas'
  | 'cogs_part_iii'
  | 'internal_transfer'
  | 'other'

/** Stable, fixed display order across all renderers. */
export const OVERHEAD_PARTS_ACCOUNTING_BUCKET_ORDER: readonly OverheadPartsAccountingBucketKey[] = [
  'fuel_gas',
  'cogs_part_iii',
  'other',
  'internal_transfer',
]

export const OVERHEAD_PARTS_ACCOUNTING_BUCKET_LABEL: Record<
  OverheadPartsAccountingBucketKey,
  string
> = {
  fuel_gas: 'Fuel / Gas',
  cogs_part_iii: 'COGS',
  other: 'Other',
  internal_transfer: 'Internal Transfers',
}

/**
 * Bucket keys that count toward the Materials (cost) rollup. Internal
 * Transfers are excluded — they aren't an expense, they're money moving
 * between the org's own accounts.
 */
export function isMaterialsBucketKey(key: OverheadPartsAccountingBucketKey): boolean {
  return key !== 'internal_transfer'
}

/**
 * Classify a single overhead-parts line into the three accounting buckets.
 *
 * - Supply / tally lines have no Banking → Accounting label by design and
 *   always land in `'other'`.
 * - Mercury lines whose transaction has been assigned to the built-in
 *   `'fuel_gas'` or `'cogs_part_iii'` drag-sort labels land in the
 *   matching bucket.
 * - Mercury lines whose transaction has any other label, no label at all,
 *   or a missing `mercuryTransactionId` (older fetch results, RLS hiding
 *   the row, etc.) all land in `'other'` — this keeps the dropdown's
 *   total equal to the modal header total no matter what.
 */
export function bucketForOverheadPartsLine(
  line: OverheadPartsDetailLine,
  bucketByMercuryTxId: ReadonlyMap<string, OverheadPartsAccountingBucketKey>,
): OverheadPartsAccountingBucketKey {
  if (line.source !== 'mercury') return 'other'
  const txId = line.mercuryTransactionId
  if (!txId) return 'other'
  return bucketByMercuryTxId.get(txId) ?? 'other'
}

export type OverheadPartsAccountingSection = {
  key: OverheadPartsAccountingBucketKey
  label: string
  totalUsd: number
  lines: OverheadPartsDetailLine[]
}

/**
 * Group lines into the three accounting buckets in fixed display order.
 *
 * Returns all three buckets even when empty; callers decide whether to
 * skip rendering empty sections (the modal currently renders Fuel / Gas
 * and COGS even when empty, like the existing "always show bids with 0.0 hrs"
 * pattern in the overhead hours breakdown).
 */
export function bucketOverheadPartsLinesByAccountingLabel(
  lines: readonly OverheadPartsDetailLine[],
  bucketByMercuryTxId: ReadonlyMap<string, OverheadPartsAccountingBucketKey>,
): OverheadPartsAccountingSection[] {
  const grouped = new Map<OverheadPartsAccountingBucketKey, OverheadPartsDetailLine[]>()
  for (const k of OVERHEAD_PARTS_ACCOUNTING_BUCKET_ORDER) grouped.set(k, [])
  for (const line of lines) {
    const k = bucketForOverheadPartsLine(line, bucketByMercuryTxId)
    grouped.get(k)!.push(line)
  }
  return OVERHEAD_PARTS_ACCOUNTING_BUCKET_ORDER.map((key) => {
    const bucketLines = grouped.get(key) ?? []
    let totalUsd = 0
    for (const l of bucketLines) totalUsd += l.amountUsd
    return {
      key,
      label: OVERHEAD_PARTS_ACCOUNTING_BUCKET_LABEL[key],
      totalUsd,
      lines: bucketLines,
    }
  })
}

/**
 * Resolve a row from `mercury_drag_sort_labels.default_key` into the
 * four-bucket key, defaulting to `'other'`. Exposed for tests + for the
 * loader that builds the per-tx bucket map from joined RPC / query rows.
 */
export function overheadPartsAccountingBucketFromDefaultKey(
  defaultKey: string | null | undefined,
): OverheadPartsAccountingBucketKey {
  if (defaultKey === 'fuel_gas') return 'fuel_gas'
  if (defaultKey === 'cogs_part_iii') return 'cogs_part_iii'
  if (defaultKey === 'internal_transfers') return 'internal_transfer'
  return 'other'
}

/**
 * Sum of `totalUsd` across every section that counts toward Materials
 * (i.e. excludes the Internal Transfers bucket). Use this in place of the
 * raw upstream `partsUsdByDay` total when the bucket map is available so
 * the displayed Materials figure matches the breakdown shown below it.
 */
export function sumMaterialsTotalUsdExcludingInternalTransfer(
  sections: readonly OverheadPartsAccountingSection[],
): number {
  let total = 0
  for (const s of sections) {
    if (isMaterialsBucketKey(s.key)) total += s.totalUsd
  }
  return total
}
