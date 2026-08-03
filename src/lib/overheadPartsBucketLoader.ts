import { supabase } from './supabase'
import { fetchAllRowsChunkedIn } from './supabasePaging'
import {
  fetchOverheadOfficePartsByDay,
  type OverheadPartsDetailLine,
} from './fetchOverheadOfficePartsByDay'
import {
  overheadPartsAccountingBucketFromDefaultKey,
  sumPartsUsdByDayExcludingInternalTransfer,
  type OverheadPartsAccountingBucketKey,
} from './overheadPartsAccountingBuckets'

/** Unique Mercury transaction ids across every line of the given per-day detail maps. */
export function collectMercuryTxIds(
  detailMaps: ReadonlyArray<ReadonlyMap<string, OverheadPartsDetailLine[]>>,
): string[] {
  const ids = new Set<string>()
  for (const m of detailMaps) {
    for (const lines of m.values()) {
      for (const ln of lines) {
        if (ln.source === 'mercury' && ln.mercuryTransactionId) ids.add(ln.mercuryTransactionId)
      }
    }
  }
  return [...ids]
}

/**
 * Banking → Accounting drag-sort bucket per Mercury transaction id.
 *
 * Two-step query: assignment rows for the tx ids, then bulk-resolve label
 * `default_key` for the assigned label ids. Chunked `.in()` + paged
 * (`fetchAllRowsChunkedIn`) — the 90-day KPI window's id list is unbounded.
 * Tx ids with no assignment row are absent from the map; renderers default
 * those to the `'other'` bucket via `bucketForOverheadPartsLine`.
 */
export async function fetchAccountingBucketByTxId(
  txIds: readonly string[],
): Promise<Map<string, OverheadPartsAccountingBucketKey>> {
  if (txIds.length === 0) return new Map()
  const assignments = (await fetchAllRowsChunkedIn(
    [...txIds],
    (chunk, from, to) =>
      supabase
        .from('mercury_transaction_drag_sort_assignments')
        .select('mercury_transaction_id, label_id')
        .in('mercury_transaction_id', chunk)
        .order('mercury_transaction_id')
        .range(from, to),
    'load overhead accounting assignments',
  )) as Array<{ mercury_transaction_id: string; label_id: string }>
  if (assignments.length === 0) return new Map()
  const labelIds = [...new Set(assignments.map((a) => a.label_id))]
  const labels = (await fetchAllRowsChunkedIn(
    labelIds,
    (chunk, from, to) =>
      supabase
        .from('mercury_drag_sort_labels')
        .select('id, default_key')
        .in('id', chunk)
        .order('id')
        .range(from, to),
    'load overhead accounting labels',
  )) as Array<{ id: string; default_key: string | null }>
  const defaultKeyByLabelId = new Map<string, string | null>()
  for (const l of labels) defaultKeyByLabelId.set(l.id, l.default_key ?? null)
  const out = new Map<string, OverheadPartsAccountingBucketKey>()
  for (const a of assignments) {
    const defaultKey = defaultKeyByLabelId.get(a.label_id) ?? null
    out.set(a.mercury_transaction_id, overheadPartsAccountingBucketFromDefaultKey(defaultKey))
  }
  return out
}

export type OfficePartsExcludingInternalTransferResult = {
  /**
   * Per-day office materials $ with Internal Transfer Mercury lines excluded
   * (empty bucket map on a bucket-fetch failure → everything counted).
   */
  partsUsdByDay: Map<string, number>
  /** Raw per-day detail lines, unfiltered — for table/modal renderers. */
  partsDetailByDay: Map<string, OverheadPartsDetailLine[]>
  /**
   * Bucket per Mercury tx id used for the exclusion. Empty when no Mercury
   * lines exist OR when the bucket fetch failed (the degrade case).
   */
  bucketByTxId: Map<string, OverheadPartsAccountingBucketKey>
}

/**
 * The ONE way to build a 90-day (or any window's) office-parts overhead pool
 * component: fetch office-job materials by day, resolve each Mercury line's
 * Banking → Accounting bucket, and sum per day EXCLUDING Internal Transfers
 * (they're money moving between the org's own accounts, not an expense —
 * the #983/v2.1283–1285 correctness rule).
 *
 * Shared by the Overhead tab's 90-day KPI/three-lenses effect and the Review
 * tab's rate/Team-Summary pool so the two surfaces cannot drift.
 *
 * Error semantics (identical to the Overhead tab's original inline block):
 * - Detail fetch failure REJECTS — callers surface the error.
 * - Bucket fetch failure (RLS/network) degrades to an empty bucket map, i.e.
 *   every line counts (all lines bucket to `'other'`), instead of nulling
 *   the caller's KPIs.
 */
export async function loadOfficePartsUsdByDayExcludingInternalTransfer(args: {
  officeJobLedgerId: string
  startYmd: string
  endYmd: string
}): Promise<OfficePartsExcludingInternalTransferResult> {
  const r = await fetchOverheadOfficePartsByDay(args)
  let bucketByTxId = new Map<string, OverheadPartsAccountingBucketKey>()
  try {
    bucketByTxId = await fetchAccountingBucketByTxId(collectMercuryTxIds([r.partsDetailByDay]))
  } catch {
    /* RLS or network — degrade to "everything counted" */
  }
  return {
    partsUsdByDay: sumPartsUsdByDayExcludingInternalTransfer(r.partsDetailByDay, bucketByTxId),
    partsDetailByDay: r.partsDetailByDay,
    bucketByTxId,
  }
}
