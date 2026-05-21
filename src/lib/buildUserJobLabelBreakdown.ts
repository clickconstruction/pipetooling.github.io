/**
 * Pure pivot for the User Review modal's Transactions section.
 *
 * Input rows come from the SECURITY DEFINER RPC `list_user_mercury_review_window`. The RPC returns one row per
 * (mercury_transaction, mercury_transaction_job_allocations) pair when allocations exist, and one row with
 * NULL allocation fields when the tx is unallocated.
 *
 * Output is shaped for direct rendering by `UserMercuryWindowSection`:
 *   - `grandTotal`: every distinct tx counted once; amount summed.
 *   - `totals.byUser` / `totals.byPerson`: same distinct-tx split by attribution source.
 *   - `unallocated`: bucket of txs with no allocation rows (full tx amount each).
 *   - `perJob`: list of jobs (sorted by |totalAmount| desc), each with `labelGroups` (per accounting label)
 *     and per-tx rows for drill-down.
 *
 * "Allocated" amounts in `perJob` come from `allocation_amount` (signed). Unallocated amounts are the full tx
 * `amount`. This mirrors how the Banking Sorting UI counts an attributed transaction.
 */

export const UNLABELED_GROUP_KEY = '__unlabeled__'
export const UNLABELED_GROUP_NAME = 'Unlabeled'

export type UserReviewRpcRow = {
  mercury_transaction_id: string
  posted_at: string | null
  created_at: string | null
  amount: number | string
  counterparty_name: string | null
  attribution_source: string | null
  attribution_person_id: string | null
  label_id: string | null
  label_name: string | null
  allocation_id: string | null
  job_id: string | null
  allocation_amount: number | string | null
}

export type UserReviewAttributionSource = 'user' | 'person'

export type UserReviewBreakdownTx = {
  mercuryTransactionId: string
  postedAt: string | null
  createdAt: string | null
  amount: number
  counterpartyName: string | null
  attributionSource: UserReviewAttributionSource
  attributionPersonId: string | null
  labelId: string | null
  labelName: string
  /** When this row came from an allocation, the signed allocation amount; null when unallocated. */
  allocationAmount: number | null
  /** Stable key for rendering: tx id + (allocation id or 'no-alloc'). */
  rowKey: string
}

export type UserReviewLabelGroup = {
  labelId: string | null
  labelName: string
  totalAmount: number
  count: number
  rows: UserReviewBreakdownTx[]
}

export type UserReviewJobRow = {
  jobId: string
  jobLabel: string
  totalAmount: number
  count: number
  labelGroups: UserReviewLabelGroup[]
}

export type UserReviewUnallocatedBucket = {
  totalAmount: number
  count: number
  rows: UserReviewBreakdownTx[]
}

export type UserReviewTotalsBySource = {
  totalAmount: number
  count: number
}

export type UserReviewBreakdown = {
  grandTotal: UserReviewTotalsBySource
  totals: {
    byUser: UserReviewTotalsBySource
    byPerson: UserReviewTotalsBySource
  }
  unallocated: UserReviewUnallocatedBucket
  perJob: UserReviewJobRow[]
}

/**
 * Per-tx row enriched with the job context, used by the By-Label and By-Date
 * sort modes so the UI's `Job` column has something to render.
 */
export type UserReviewBreakdownTxWithJob = UserReviewBreakdownTx & {
  jobId: string | null
  jobLabel: string | null
}

export type UserReviewLabelTopRow = {
  labelId: string | null
  labelName: string
  totalAmount: number
  /** Distinct tx count within this label bucket. */
  count: number
  /** One row per (tx, allocation) under this label. Unallocated txs surface with allocationAmount = null. */
  rows: UserReviewBreakdownTxWithJob[]
}

export type UserReviewLabelBreakdown = {
  grandTotal: UserReviewTotalsBySource
  totals: {
    byUser: UserReviewTotalsBySource
    byPerson: UserReviewTotalsBySource
  }
  perLabel: UserReviewLabelTopRow[]
}

export type UserReviewDateRow = UserReviewBreakdownTxWithJob & {
  /** True when the tx has 2+ allocations; UI may show a small marker. */
  hasMultipleAllocations: boolean
}

export type UserReviewDateBreakdown = {
  grandTotal: UserReviewTotalsBySource
  totals: {
    byUser: UserReviewTotalsBySource
    byPerson: UserReviewTotalsBySource
  }
  /** Distinct txs sorted newest-first. One row per `mercury_transaction_id`. */
  rows: UserReviewDateRow[]
}

function toFiniteNumber(value: number | string | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeAttributionSource(value: string | null): UserReviewAttributionSource | null {
  if (value === 'user' || value === 'person') return value
  return null
}

function pickJobLabel(jobLabelById: Readonly<Record<string, string>> | undefined, jobId: string): string {
  const label = jobLabelById?.[jobId]?.trim()
  if (label && label.length > 0) return label
  return jobId
}

type DistinctTxMeta = {
  amount: number
  source: UserReviewAttributionSource
  hasAllocation: boolean
}

type DistinctTxScan = {
  /** Distinct-tx ledger keyed by `mercury_transaction_id`. */
  distinctTxMeta: Map<string, DistinctTxMeta>
  grandTotal: UserReviewTotalsBySource
  totals: { byUser: UserReviewTotalsBySource; byPerson: UserReviewTotalsBySource }
}

/**
 * First-pass scan of RPC rows shared by every breakdown helper in this file.
 *
 * Iterates rows once, collapsing them into a distinct-transaction ledger, and computes
 * the canonical totals (grand total, byUser, byPerson). All three helpers reuse this so
 * totals stay byte-identical across sort modes.
 */
function scanDistinctTxs(rows: ReadonlyArray<UserReviewRpcRow>): DistinctTxScan {
  const distinctTxMeta = new Map<string, DistinctTxMeta>()
  for (const row of rows) {
    const txId = row.mercury_transaction_id
    const source = normalizeAttributionSource(row.attribution_source)
    if (!source) continue
    const amt = toFiniteNumber(row.amount)
    const existing = distinctTxMeta.get(txId)
    if (!existing) {
      distinctTxMeta.set(txId, { amount: amt, source, hasAllocation: row.allocation_id != null })
    } else if (row.allocation_id != null) {
      existing.hasAllocation = true
    }
  }

  let grandAmount = 0
  let userAmount = 0
  let userCount = 0
  let personAmount = 0
  let personCount = 0
  for (const meta of distinctTxMeta.values()) {
    grandAmount += meta.amount
    if (meta.source === 'user') {
      userAmount += meta.amount
      userCount += 1
    } else {
      personAmount += meta.amount
      personCount += 1
    }
  }

  return {
    distinctTxMeta,
    grandTotal: { totalAmount: grandAmount, count: distinctTxMeta.size },
    totals: {
      byUser: { totalAmount: userAmount, count: userCount },
      byPerson: { totalAmount: personAmount, count: personCount },
    },
  }
}

/**
 * Collapse RPC rows into the breakdown shape.
 *
 * Pure — no I/O, no Supabase. Stable sort: jobs by |totalAmount| desc then jobLabel asc;
 * label groups within a job by |totalAmount| desc then labelName asc; rows within a label group by
 * posted_at desc (createdAt fallback) then mercuryTransactionId asc.
 */
export function buildUserJobLabelBreakdown(args: {
  rows: ReadonlyArray<UserReviewRpcRow>
  jobLabelById?: Readonly<Record<string, string>>
}): UserReviewBreakdown {
  const jobLabelById = args.jobLabelById ?? {}
  const scan = scanDistinctTxs(args.rows)
  const { distinctTxMeta } = scan

  // Unallocated bucket: one tx per row; full tx amount.
  const unallocatedRowsByTxId = new Map<string, UserReviewBreakdownTx>()
  for (const row of args.rows) {
    if (row.allocation_id != null) continue
    const source = normalizeAttributionSource(row.attribution_source)
    if (!source) continue
    const txId = row.mercury_transaction_id
    if (unallocatedRowsByTxId.has(txId)) continue
    const meta = distinctTxMeta.get(txId)
    if (!meta || meta.hasAllocation) continue
    unallocatedRowsByTxId.set(txId, buildBreakdownTx(row, source, null))
  }

  const unallocatedRows = [...unallocatedRowsByTxId.values()].sort(sortRowsForDisplay)
  const unallocated: UserReviewUnallocatedBucket = {
    totalAmount: unallocatedRows.reduce((acc, r) => acc + r.amount, 0),
    count: unallocatedRows.length,
    rows: unallocatedRows,
  }

  // Per-job × per-label aggregation. Only rows with allocation_id contribute here.
  type JobBucket = {
    jobId: string
    totalAmount: number
    count: number
    txIds: Set<string>
    labelGroups: Map<string, UserReviewLabelGroup>
  }
  const jobBuckets = new Map<string, JobBucket>()

  for (const row of args.rows) {
    if (row.allocation_id == null || row.job_id == null) continue
    const source = normalizeAttributionSource(row.attribution_source)
    if (!source) continue
    const jobId = row.job_id
    const allocationAmount = toFiniteNumber(row.allocation_amount)
    const labelKey = row.label_id ?? UNLABELED_GROUP_KEY
    const labelName =
      row.label_id != null && row.label_name && row.label_name.trim().length > 0
        ? row.label_name
        : UNLABELED_GROUP_NAME

    let job = jobBuckets.get(jobId)
    if (!job) {
      job = {
        jobId,
        totalAmount: 0,
        count: 0,
        txIds: new Set<string>(),
        labelGroups: new Map<string, UserReviewLabelGroup>(),
      }
      jobBuckets.set(jobId, job)
    }
    job.totalAmount += allocationAmount
    if (!job.txIds.has(row.mercury_transaction_id)) {
      job.txIds.add(row.mercury_transaction_id)
      job.count += 1
    }

    let group = job.labelGroups.get(labelKey)
    if (!group) {
      group = {
        labelId: row.label_id,
        labelName,
        totalAmount: 0,
        count: 0,
        rows: [],
      }
      job.labelGroups.set(labelKey, group)
    }
    group.totalAmount += allocationAmount
    group.count += 1
    group.rows.push(buildBreakdownTx(row, source, allocationAmount))
  }

  const perJob: UserReviewJobRow[] = [...jobBuckets.values()]
    .map((b) => ({
      jobId: b.jobId,
      jobLabel: pickJobLabel(jobLabelById, b.jobId),
      totalAmount: b.totalAmount,
      count: b.count,
      labelGroups: [...b.labelGroups.values()]
        .map((g) => ({ ...g, rows: [...g.rows].sort(sortRowsForDisplay) }))
        .sort(sortByAbsoluteAmountThenName((x) => x.labelName)),
    }))
    .sort(sortByAbsoluteAmountThenName((x) => x.jobLabel))

  return {
    grandTotal: scan.grandTotal,
    totals: scan.totals,
    unallocated,
    perJob,
  }
}

function buildBreakdownTx(
  row: UserReviewRpcRow,
  source: UserReviewAttributionSource,
  allocationAmount: number | null,
): UserReviewBreakdownTx {
  return {
    mercuryTransactionId: row.mercury_transaction_id,
    postedAt: row.posted_at,
    createdAt: row.created_at,
    amount: toFiniteNumber(row.amount),
    counterpartyName: row.counterparty_name,
    attributionSource: source,
    attributionPersonId: row.attribution_person_id,
    labelId: row.label_id,
    labelName:
      row.label_id != null && row.label_name && row.label_name.trim().length > 0
        ? row.label_name
        : UNLABELED_GROUP_NAME,
    allocationAmount,
    rowKey: `${row.mercury_transaction_id}::${row.allocation_id ?? 'no-alloc'}`,
  }
}

function sortRowsForDisplay(a: UserReviewBreakdownTx, b: UserReviewBreakdownTx): number {
  const aIso = a.postedAt ?? a.createdAt ?? ''
  const bIso = b.postedAt ?? b.createdAt ?? ''
  if (aIso !== bIso) return bIso.localeCompare(aIso)
  return a.mercuryTransactionId.localeCompare(b.mercuryTransactionId)
}

function sortByAbsoluteAmountThenName<T extends { totalAmount: number }>(
  nameOf: (item: T) => string,
): (a: T, b: T) => number {
  return (a, b) => {
    const diff = Math.abs(b.totalAmount) - Math.abs(a.totalAmount)
    if (diff !== 0) return diff
    return nameOf(a).localeCompare(nameOf(b))
  }
}

/**
 * Label-first pivot for the User Review modal's By-Label sort mode.
 *
 * Top-level groups are accounting labels (across all jobs); each bucket carries one row per
 * (tx, allocation) under that label. Unallocated txs land in the synthetic `Unlabeled` bucket
 * with `allocationAmount: null` so the UI can render them inline alongside labeled rows.
 *
 * Totals (`grandTotal`, `totals.byUser`, `totals.byPerson`) are byte-identical to
 * `buildUserJobLabelBreakdown` for the same input — same `scanDistinctTxs` first pass.
 */
export function buildUserLabelTopBreakdown(args: {
  rows: ReadonlyArray<UserReviewRpcRow>
  jobLabelById?: Readonly<Record<string, string>>
}): UserReviewLabelBreakdown {
  const jobLabelById = args.jobLabelById ?? {}
  const scan = scanDistinctTxs(args.rows)
  const { distinctTxMeta } = scan

  type LabelBucket = {
    labelId: string | null
    labelName: string
    totalAmount: number
    txIds: Set<string>
    rows: UserReviewBreakdownTxWithJob[]
  }
  const labelBuckets = new Map<string, LabelBucket>()

  function getOrCreate(labelKey: string, labelId: string | null, labelName: string): LabelBucket {
    let bucket = labelBuckets.get(labelKey)
    if (!bucket) {
      bucket = {
        labelId,
        labelName,
        totalAmount: 0,
        txIds: new Set<string>(),
        rows: [],
      }
      labelBuckets.set(labelKey, bucket)
    }
    return bucket
  }

  // Allocation rows → bucket by label.
  for (const row of args.rows) {
    if (row.allocation_id == null || row.job_id == null) continue
    const source = normalizeAttributionSource(row.attribution_source)
    if (!source) continue
    const allocationAmount = toFiniteNumber(row.allocation_amount)
    const labelKey = row.label_id ?? UNLABELED_GROUP_KEY
    const labelName =
      row.label_id != null && row.label_name && row.label_name.trim().length > 0
        ? row.label_name
        : UNLABELED_GROUP_NAME
    const bucket = getOrCreate(labelKey, row.label_id, labelName)
    bucket.totalAmount += allocationAmount
    bucket.txIds.add(row.mercury_transaction_id)
    bucket.rows.push({
      ...buildBreakdownTx(row, source, allocationAmount),
      jobId: row.job_id,
      jobLabel: pickJobLabel(jobLabelById, row.job_id),
    })
  }

  // Unallocated txs → synthetic Unlabeled bucket (one row per distinct tx, full tx amount).
  const seenUnallocatedTxIds = new Set<string>()
  for (const row of args.rows) {
    if (row.allocation_id != null) continue
    const source = normalizeAttributionSource(row.attribution_source)
    if (!source) continue
    const txId = row.mercury_transaction_id
    if (seenUnallocatedTxIds.has(txId)) continue
    const meta = distinctTxMeta.get(txId)
    if (!meta || meta.hasAllocation) continue
    seenUnallocatedTxIds.add(txId)
    const bucket = getOrCreate(UNLABELED_GROUP_KEY, null, UNLABELED_GROUP_NAME)
    bucket.totalAmount += meta.amount
    bucket.txIds.add(txId)
    bucket.rows.push({
      ...buildBreakdownTx(row, source, null),
      jobId: null,
      jobLabel: null,
    })
  }

  const perLabel: UserReviewLabelTopRow[] = [...labelBuckets.values()]
    .map<UserReviewLabelTopRow>((b) => ({
      labelId: b.labelId,
      labelName: b.labelName,
      totalAmount: b.totalAmount,
      count: b.txIds.size,
      rows: [...b.rows].sort(sortRowsForDisplay),
    }))
    .sort(sortByAbsoluteAmountThenName((x) => x.labelName))

  return {
    grandTotal: scan.grandTotal,
    totals: scan.totals,
    perLabel,
  }
}

/**
 * Date-first flat pivot for the User Review modal's By-Date sort mode.
 *
 * Emits exactly one row per distinct `mercury_transaction_id`, using the tx `amount` (not
 * `allocationAmount`). For multi-allocation txs, the display fields (`jobId`/`jobLabel`/
 * `labelId`/`labelName`) come from the allocation with the largest absolute amount; ties
 * break by `allocation_id` ascending. `hasMultipleAllocations` flags those txs so the UI
 * can show a small marker.
 *
 * Totals match `buildUserJobLabelBreakdown` exactly via the shared `scanDistinctTxs`.
 */
export function buildUserDateFlatBreakdown(args: {
  rows: ReadonlyArray<UserReviewRpcRow>
  jobLabelById?: Readonly<Record<string, string>>
}): UserReviewDateBreakdown {
  const jobLabelById = args.jobLabelById ?? {}
  const scan = scanDistinctTxs(args.rows)
  const { distinctTxMeta } = scan

  // Aggregate allocations per tx so we can pick a representative one for display.
  type AllocCandidate = {
    allocationId: string
    absAmount: number
    row: UserReviewRpcRow
  }
  type TxAggregate = {
    /** First RPC row encountered for this tx — used when the tx has no allocations. */
    seedRow: UserReviewRpcRow
    source: UserReviewAttributionSource
    allocations: AllocCandidate[]
  }
  const txAggregates = new Map<string, TxAggregate>()

  for (const row of args.rows) {
    const source = normalizeAttributionSource(row.attribution_source)
    if (!source) continue
    const txId = row.mercury_transaction_id
    let agg = txAggregates.get(txId)
    if (!agg) {
      agg = { seedRow: row, source, allocations: [] }
      txAggregates.set(txId, agg)
    }
    if (row.allocation_id != null) {
      agg.allocations.push({
        allocationId: row.allocation_id,
        absAmount: Math.abs(toFiniteNumber(row.allocation_amount)),
        row,
      })
    }
  }

  const rows: UserReviewDateRow[] = []
  for (const [txId, agg] of txAggregates) {
    const meta = distinctTxMeta.get(txId)
    if (!meta) continue
    if (agg.allocations.length === 0) {
      // Unallocated tx — display fields null, full amount.
      rows.push({
        ...buildBreakdownTx(agg.seedRow, agg.source, null),
        jobId: null,
        jobLabel: null,
        hasMultipleAllocations: false,
      })
      continue
    }
    // Pick the allocation with the largest |amount|; tiebreak by allocation_id asc for determinism.
    const sortedAllocs = [...agg.allocations].sort((a, b) => {
      const diff = b.absAmount - a.absAmount
      if (diff !== 0) return diff
      return a.allocationId.localeCompare(b.allocationId)
    })
    const winner = sortedAllocs[0]
    if (!winner) continue
    const winnerRow = winner.row
    const jobId = winnerRow.job_id
    rows.push({
      ...buildBreakdownTx(winnerRow, agg.source, null),
      jobId,
      jobLabel: jobId != null ? pickJobLabel(jobLabelById, jobId) : null,
      hasMultipleAllocations: agg.allocations.length > 1,
    })
  }

  rows.sort(sortRowsForDisplay)

  return {
    grandTotal: scan.grandTotal,
    totals: scan.totals,
    rows,
  }
}
