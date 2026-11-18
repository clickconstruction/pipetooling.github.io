/**
 * Bids → Pricing, the Markup and Tax tools (punch list #128): the rows each tool is handed, read
 * off the Workbench's rows and their splits. It sat inline beside the two buttons in
 * `BidsPricingTab` (decomposition queue row 1). Pure.
 */
import type { MarkupToolRow } from '../../components/bids/MarkupToolPopover'
import type { TaxToolRow } from '../../components/bids/TaxToolPopover'
import type { RowKind } from './rowKinds'
import type { RowSplit } from './rowPriceSplit'

/** One Workbench row as the two tools read it. */
export type RowMarkToolSource = {
  id: string
  name: string
  kind: RowKind
  tags: string[]
  /** The row's price split (`rowPriceSplit`). */
  split: Pick<RowSplit, 'material' | 'markup' | 'markupSource' | 'materialSource' | 'taxable'>
  /** The row's takeoff material before tax and markup. */
  materialsBeforeTax: number
}

/** The Markup tool's rows: the markup each sells at now, whether it is the row's own, and whether it has takeoff material to mark up. */
export function markupToolRows(rows: ReadonlyArray<RowMarkToolSource>): MarkupToolRow[] {
  return rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind, tags: r.tags, own: r.split.markupSource === 'row', markup: r.split.markup, hasMaterial: r.split.materialSource === 'takeoff' }))
}

/**
 * The markup the rows' material sells at, taken together: material sold over material cost, less
 * one. A row with no material adds no cost. null when no row has material cost.
 */
export function weightedMarkupOf(rows: ReadonlyArray<RowMarkToolSource>): number | null {
  const cost = rows.reduce((s, r) => s + (r.split.materialSource === 'none' ? 0 : r.materialsBeforeTax), 0)
  const price = rows.reduce((s, r) => s + r.split.material, 0)
  return cost > 0 ? price / cost - 1 : null
}

/** The Tax tool's rows: taxed or not, and whether there is material for the tax to sit on (sold, or from the takeoff). */
export function taxToolRows(rows: ReadonlyArray<RowMarkToolSource>): TaxToolRow[] {
  return rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind, tags: r.tags, taxable: r.split.taxable, hasMaterial: r.split.material > 0 || r.split.materialSource === 'takeoff' }))
}
