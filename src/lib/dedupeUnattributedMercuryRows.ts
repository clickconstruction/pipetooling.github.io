import type { MercuryJobAllocationWithAttributionRow } from './fetchMercuryJobAllocationsWithAttributionForJob'

/** Dedupe by mercury_transaction_id, sum abs(allocation) for this job. */
export function dedupeUnattributedRows(
  rows: MercuryJobAllocationWithAttributionRow[],
): { mercury_transaction_id: string; lineAmount: number; sample: MercuryJobAllocationWithAttributionRow }[] {
  const byTx = new Map<string, { sum: number; first: MercuryJobAllocationWithAttributionRow }>()
  for (const r of rows) {
    if (r.attributionDisplayName != null) continue
    const tid = r.mercury_transaction_id
    const ex = byTx.get(tid)
    const add = Math.abs(Number(r.amount ?? 0))
    if (ex) {
      ex.sum += add
    } else {
      byTx.set(tid, { sum: add, first: r })
    }
  }
  return [...byTx.entries()]
    .map(([mercury_transaction_id, { sum, first }]) => ({
      mercury_transaction_id,
      lineAmount: sum,
      sample: first,
    }))
    .sort((a, b) => a.mercury_transaction_id.localeCompare(b.mercury_transaction_id))
}
