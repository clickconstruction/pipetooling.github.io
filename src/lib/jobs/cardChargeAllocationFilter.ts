/**
 * The ONE rule for which Mercury job allocations count as a job's "card
 * charges" — shared by the Jobs bulk card-charge map, the per-job detail /
 * print rows, and the post-save one-job refresh (journey-map Phase 4, Tier-1
 * #3(c); the #3b recheck found the three paths applying different exclusions).
 *
 * - **Internal Transfers** (drag-sort bucket `internal_transfer`) are money
 *   moving between the org's own accounts, not a cost — excluded outright,
 *   the same exclusion People → Overhead applies (v2.2692).
 * - **Supply-house-invoice-linked** charges are the same purchase the invoice
 *   allocation already counts. They stay in the gross card total (so the
 *   detail rows still sum to the card) and are tracked separately so Job
 *   Summary's parts cost can count them once (`Jobs.tsx`, v2.2692).
 *
 * Pure — the lookups arrive pre-loaded (`loadCardChargeExclusions`), so the
 * rule is unit-testable and every caller sees identical numbers.
 */

export type CardChargeAllocationLike = {
  mercury_transaction_id: string
  amount: number
}

export type CardChargeExclusions = {
  /** Mercury tx id → accounting bucket key (`fetchAccountingBucketByTxId`); absent = counts. */
  bucketByTxId: ReadonlyMap<string, string>
  /** Mercury tx ids carrying at least one supply-house invoice link. */
  invoiceLinkedTxIds: ReadonlySet<string>
}

/** "Everything counts, nothing is linked" — what a caller uses when RLS hides the lookups. */
export const EMPTY_CARD_CHARGE_EXCLUSIONS: CardChargeExclusions = {
  bucketByTxId: new Map(),
  invoiceLinkedTxIds: new Set(),
}

/** Bucket key that removes an allocation from every card-charge number. */
export const CARD_CHARGE_EXCLUDED_BUCKET = 'internal_transfer' as const

/** True when the allocation counts toward the job's card charges (not an Internal Transfer). */
export function cardChargeAllocationCounts(row: CardChargeAllocationLike, exclusions: CardChargeExclusions): boolean {
  return exclusions.bucketByTxId.get(row.mercury_transaction_id) !== CARD_CHARGE_EXCLUDED_BUCKET
}

/** True when the allocation's transaction is also linked to a supply-house invoice. */
export function cardChargeAllocationIsInvoiceLinked(
  row: CardChargeAllocationLike,
  exclusions: CardChargeExclusions,
): boolean {
  return exclusions.invoiceLinkedTxIds.has(row.mercury_transaction_id)
}

export type CardChargeSummary<T> = {
  /** Rows that count (Internal Transfers removed), in input order. */
  counted: T[]
  /** job id → gross card charges (abs amounts, invoice-linked included). */
  chargesByJobId: Map<string, number>
  /** job id → the slice of `chargesByJobId` that is also invoice-linked. */
  invoiceLinkedByJobId: Map<string, number>
}

/** Applies the rule across many jobs' rows (the Jobs bulk card-charge map). */
export function summarizeCardChargeAllocations<T extends CardChargeAllocationLike & { job_id: string }>(
  rows: readonly T[],
  exclusions: CardChargeExclusions,
): CardChargeSummary<T> {
  const counted: T[] = []
  const chargesByJobId = new Map<string, number>()
  const invoiceLinkedByJobId = new Map<string, number>()
  for (const row of rows) {
    if (!cardChargeAllocationCounts(row, exclusions)) continue
    counted.push(row)
    const usd = Math.abs(Number(row.amount))
    chargesByJobId.set(row.job_id, (chargesByJobId.get(row.job_id) ?? 0) + usd)
    if (cardChargeAllocationIsInvoiceLinked(row, exclusions)) {
      invoiceLinkedByJobId.set(row.job_id, (invoiceLinkedByJobId.get(row.job_id) ?? 0) + usd)
    }
  }
  return { counted, chargesByJobId, invoiceLinkedByJobId }
}

/** Applies the rule to ONE job's rows (post-save refresh): gross card charges + the invoice-linked slice. */
export function sumCardChargeAllocationsForJob(
  rows: readonly CardChargeAllocationLike[],
  exclusions: CardChargeExclusions,
): { charges: number; invoiceLinked: number } {
  let charges = 0
  let invoiceLinked = 0
  for (const row of rows) {
    if (!cardChargeAllocationCounts(row, exclusions)) continue
    const usd = Math.abs(Number(row.amount))
    charges += usd
    if (cardChargeAllocationIsInvoiceLinked(row, exclusions)) invoiceLinked += usd
  }
  return { charges, invoiceLinked }
}
