/**
 * Re-key a just-cloned pricing's count-row children (custom prices, assignments, submission
 * hides) from the SOURCE version's rows onto the TARGET version's rows, matched by fixture name
 * (v2.2405). Every bid version owns its own count rows, so without this the clone points at rows
 * the target packet's grid never shows and the copy lands as "No prices yet". Children whose row
 * has no unique same-named counterpart are deleted: a price for a row this packet does not carry
 * belongs to nobody.
 *
 * Lifted out of `BidsPricingTab` as it was (decomposition queue row 1, the map's Stage-A
 * inventory): the same reads and writes in the same order, one child at a time, from the client.
 * It is not atomic (the map's quirk 20): a write that fails stops the run where it stands and
 * leaves the children before it moved. The plan is the pure part, `rekeyPlan`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { alternateScopeKey } from './countSheet'
import { mapCountRowsByFixture } from './mapCountRowsByFixture'

/** The three tables keyed by `count_row_id` under a pricing, in the order they are re-keyed. */
export const REKEY_CHILD_TABLES = ['bid_count_row_custom_prices', 'bid_pricing_assignments', 'bid_count_row_submission_hides'] as const
export type RekeyChildTable = (typeof REKEY_CHILD_TABLES)[number]

export type RekeyCountRow = { id: string; fixture: string | null; group_tag: string | null }

/**
 * Source row id → target row id: the same fixture name, unique on both sides, within the same
 * alternate scope (v2.4194: a fixture that sits in the base and in an alternate pairs within its scope).
 */
export function rekeyRowMap(sourceRows: readonly RekeyCountRow[], targetRows: readonly RekeyCountRow[], alternateGroupTags: readonly string[]): Map<string, string> {
  return mapCountRowsByFixture(sourceRows, targetRows, (r) => alternateScopeKey({ group_tag: r.group_tag ?? null }, alternateGroupTags))
}

/** What happens to one child: it moves to its row's counterpart, or is dropped (`moveTo` null) when there is none. */
export type RekeyStep = { countRowId: string; moveTo: string | null }

/** One table's children, in the order they were read. */
export function rekeyPlan(childCountRowIds: readonly string[], rowMap: ReadonlyMap<string, string>): RekeyStep[] {
  return childCountRowIds.map((countRowId) => ({ countRowId, moveTo: rowMap.get(countRowId) || null }))
}

/** The counts the copy's toast reads are prices: custom prices only, never assignments or hides. */
export function rekeyTableCounts(table: RekeyChildTable): boolean {
  return table === 'bid_count_row_custom_prices'
}

export type RekeyClonedPricingArgs = {
  bidId: string
  /** The clone (`price_book_versions.id`) whose children are re-keyed. */
  pricingId: string
  sourceBidVersionId: string
  targetBidVersionId: string
  /** The bid's alternate tags (`bids.alternate_group_tags`). */
  alternateGroupTags: readonly string[]
}

export type RekeyClonedPricingResult = { ok: true; matched: number; dropped: number } | { ok: false; error: string }

export async function rekeyClonedPricingToVersion(
  supabase: SupabaseClient,
  { bidId, pricingId, sourceBidVersionId, targetBidVersionId, alternateGroupTags }: RekeyClonedPricingArgs,
): Promise<RekeyClonedPricingResult> {
  const loadRows = async (versionId: string): Promise<RekeyCountRow[] | { error: string }> => {
    const { data, error: err } = await supabase.from('bids_count_rows').select('id, fixture, group_tag').eq('bid_id', bidId).eq('bid_version_id', versionId)
    if (err) return { error: err.message }
    return (data ?? []) as RekeyCountRow[]
  }
  // Both reads run, the source first, before either failure is said: the target's is the one named when both fail.
  const sourceRows = await loadRows(sourceBidVersionId)
  const targetRows = await loadRows(targetBidVersionId)
  if (!Array.isArray(targetRows)) return { ok: false, error: targetRows.error }
  if (!Array.isArray(sourceRows)) return { ok: false, error: sourceRows.error }
  const rowMap = rekeyRowMap(sourceRows, targetRows, alternateGroupTags)
  let matched = 0
  let dropped = 0
  for (const table of REKEY_CHILD_TABLES) {
    const { data, error: err } = await supabase.from(table).select('count_row_id').eq('price_book_version_id', pricingId)
    if (err) return { ok: false, error: err.message }
    const children = ((data ?? []) as Array<{ count_row_id: string }>).map((c) => c.count_row_id)
    for (const step of rekeyPlan(children, rowMap)) {
      if (step.moveTo) {
        const { error: upErr } = await supabase.from(table).update({ count_row_id: step.moveTo }).eq('price_book_version_id', pricingId).eq('count_row_id', step.countRowId)
        if (upErr) return { ok: false, error: upErr.message }
        if (rekeyTableCounts(table)) matched++
      } else {
        const { error: delErr } = await supabase.from(table).delete().eq('price_book_version_id', pricingId).eq('count_row_id', step.countRowId)
        if (delErr) return { ok: false, error: delErr.message }
        if (rekeyTableCounts(table)) dropped++
      }
    }
  }
  return { ok: true, matched, dropped }
}
