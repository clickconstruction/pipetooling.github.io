/**
 * A bid's materials cost, from the takeoff's part lines (v2.4368): Σ fixture count ×
 * quantity × unit price, plus the order rounding's extra (`roughMaterialsTotalWithRounding`).
 *
 * The pricing engine (Labor and Pricing) and the Approval PDF both read it through
 * `combinedMaterials`, so the documents say what the tabs say. Pure; the reads live in
 * `bidMaterialsIo.ts`. Until By Stage retired (v2.4389) a second model priced materials
 * from three stage purchase orders instead; no reader counts those now.
 */
import { roughCountMultiplier } from './bidTakeoffHelpers'
import { roughMaterialsTotalWithRounding, type RoughLineDbRow } from './takeoffOrderRounding'

export type BidMaterials = {
  /**
   * The three slots `computeBidCostBreakdown` reads: the whole list in `roughIn` and 0 in
   * the other two, as the engine sets them.
   */
  roughIn: number
  topOut: number
  trimSet: number
  /** Pre-tax. */
  total: number
  /** Each count row's materials with its slice of the rounding, the Pricing table's per-fixture number. */
  byCountRowId: Record<string, number>
}

/**
 * The version's part lines over its count rows. The total carries the
 * sticks; each count row in `countByRowId` gets Σ its lines' quantity × price,
 * times its count, plus its share of the rounding. A line whose count row is not
 * in the map still sums at ×1 in the total, the same as the Takeoffs strip.
 */
export function combinedMaterials(
  lines: ReadonlyArray<RoughLineDbRow>,
  countByRowId: ReadonlyMap<string, number | string | null | undefined>,
): BidMaterials {
  const rounded = roughMaterialsTotalWithRounding(lines, countByRowId)
  const perUnitByRow = new Map<string, number>()
  for (const l of lines) {
    if (!l.count_row_id) continue
    perUnitByRow.set(l.count_row_id, (perUnitByRow.get(l.count_row_id) ?? 0) + Number(l.quantity) * Number(l.unit_price))
  }
  const byCountRowId: Record<string, number> = {}
  for (const [rowId, count] of countByRowId) {
    byCountRowId[rowId] = (perUnitByRow.get(rowId) ?? 0) * roughCountMultiplier(count) + (rounded.rounding.extraByCountRow.get(rowId) ?? 0)
  }
  return { roughIn: rounded.total, topOut: 0, trimSet: 0, total: rounded.total, byCountRowId }
}

/** The materials line a document prints. */
export function materialsLines(m: BidMaterials): Array<{ label: string; amount: number }> {
  return [{ label: 'Materials', amount: m.total }]
}
