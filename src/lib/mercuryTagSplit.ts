// Splits card allocations by bank-category TAG — the general form of the
// v2.2700 fuel split. A charge belongs to the tag of its accounting label
// (a human decision) when it has one, else to the tag of its bank category.
// Only tags flagged `show_as_cost_line` become lines on Review / Job Summary.
// Pure; every surface that draws cost lines calls this one function.

import { categoryTagForCharge, type CategoryTagLookups, type CategoryTagRow } from './banking/categoryTags'

export type TagSplitAllocationRow = {
  job_id: string
  amount: number | string | null
  mercury_transaction_id: string | null
}

/** The tags that get their own cost line, in manager order. */
export function costLineTags(lookups: CategoryTagLookups): CategoryTagRow[] {
  return [...lookups.tagsById.values()].filter((t) => t.show_as_cost_line).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

/**
 * job id → (tag id → Σ|amount|) over the allocation rows, for cost-line tags
 * only. Always a slice of the plain card-charge sum for the same rows.
 */
export function sumTagChargesByJob(
  rows: readonly TagSplitAllocationRow[],
  labelIdByTxId: ReadonlyMap<string, string>,
  categoryByTxId: ReadonlyMap<string, unknown>,
  lookups: CategoryTagLookups,
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>()
  for (const r of rows) {
    if (!r.mercury_transaction_id) continue
    const tag = categoryTagForCharge(
      lookups,
      labelIdByTxId.get(r.mercury_transaction_id) ?? null,
      (() => {
        const v = categoryByTxId.get(r.mercury_transaction_id)
        return typeof v === 'string' ? v : v && typeof v === 'object' && typeof (v as { name?: unknown }).name === 'string' ? (v as { name: string }).name : null
      })(),
    )
    if (!tag || !tag.show_as_cost_line) continue
    const abs = Math.abs(Number(r.amount)) || 0
    if (abs <= 0) continue
    const perTag = out.get(r.job_id) ?? new Map<string, number>()
    perTag.set(tag.id, (perTag.get(tag.id) ?? 0) + abs)
    out.set(r.job_id, perTag)
  }
  return out
}
