/**
 * Bids → Pricing, the Workbench's effective rows: what each row is worth on screen right now.
 * A row has a saved price, and may also have a price being typed (a draft) and a price the solver
 * proposes (a preview, which a click can veto). This is the arithmetic that sat inline at the top
 * of the Workbench's render in `BidsPricingTab` (decomposition queue row 1; the map's untested
 * money math): which of the three prices counts toward the bar's totals, which one the row's own
 * cells show, and the revenue, profit, margin and priced counts that follow.
 *
 * Pure. It takes the solver's preview, its vetoes and the typed drafts as values and holds none.
 */

/** What the arithmetic reads off a row; every other field rides along untouched. */
export type WorkbenchRowBase = {
  countRow: { id: string }
  count: number
  /** The row's cost (material, tax and labor). 0 = no cost basis. */
  cost: number
  /** The saved unit price. Read only while `priced`. */
  unitPrice: number
  /** A price exists for the row, a saved $0 included (v2.6001). */
  priced: boolean
}

export type WorkbenchRowEffective = {
  /** The unit price the totals use: the draft, else an unvetoed preview, else the saved price. null = unpriced. */
  effUnit: number | null
  effRevenue: number
  /** null with no price, no revenue or no cost basis. */
  effMargin: number | null
  /** The solver proposes a price that differs from the saved one. */
  isPreview: boolean
  /** That proposal was clicked off: Apply holds the saved price. */
  isVetoed: boolean
  /** The unit price the row's own cells show: the draft, else the saved price. The ghost carries the proposal. */
  displayUnit: number | null
  displayRevenue: number
  displayMargin: number | null
}

export type WorkbenchPriceState = {
  /** The solver's proposed unit prices by count-row id; null with no preview. */
  preview: Readonly<Record<string, number>> | null
  /** Count-row ids whose proposal was clicked off. */
  vetoed: ReadonlySet<string>
  /** The text in a price cell while it is typed, by count-row id. */
  drafts: Readonly<Record<string, string>>
}

/** A price cell's text as a price: "$1,250.50" is 1250.5. Empty, a word or a negative is no draft. */
export function parsePriceDraft(raw: string | undefined | null): number | null {
  const n = raw != null ? parseFloat(raw.replace(/[$,]/g, '')) : NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** One row's margin: (revenue − cost) / revenue, or null with no price, no revenue or no cost basis. */
function marginOf(unit: number | null, revenue: number, cost: number): number | null {
  return unit != null && revenue > 0 && cost > 0 ? (revenue - cost) / revenue : null
}

export function workbenchEffectiveRow<R extends WorkbenchRowBase>(r: R, state: WorkbenchPriceState): R & WorkbenchRowEffective {
  const pv = state.preview?.[r.countRow.id]
  const isPreview = pv != null && pv !== r.unitPrice
  const isVetoed = isPreview && state.vetoed.has(r.countRow.id)
  // A price mid-typing drives the live totals too (v2.2373), but only the solver's preview map
  // makes a row "preview": typed prices save on Enter or blur and never wait on Apply.
  const draft = parsePriceDraft(state.drafts[r.countRow.id])
  // v2.2396: a row nothing prices reads as a dash and counts as unpriced. v2.6001: a saved $0 is
  // a price; `priced` tells the two apart.
  const savedUnit = r.priced ? r.unitPrice : null
  // The totals see the pending solve, minus the clicked-off rows; the row's own cells keep the
  // saved price and the ghost carries the proposal (v2.2379).
  const unit = draft ?? (isPreview && !isVetoed ? pv : null) ?? savedUnit
  const revenue = unit != null ? unit * r.count : 0
  const displayUnit = draft ?? savedUnit
  const displayRevenue = displayUnit != null ? displayUnit * r.count : 0
  return {
    ...r,
    effUnit: unit,
    effRevenue: revenue,
    effMargin: marginOf(unit, revenue, r.cost),
    isPreview,
    isVetoed,
    displayUnit,
    displayRevenue,
    displayMargin: marginOf(displayUnit, displayRevenue, r.cost),
  }
}

export function workbenchEffectiveRows<R extends WorkbenchRowBase>(rows: ReadonlyArray<R>, state: WorkbenchPriceState): Array<R & WorkbenchRowEffective> {
  return rows.map((r) => workbenchEffectiveRow(r, state))
}

/**
 * The bar's figures over the effective rows. `totalCost` is the bid's whole cost, the overhead
 * included, so the profit is the bid's and not the rows' alone.
 */
export function workbenchEffectiveTotals<E extends { cost: number; effUnit: number | null; effRevenue: number; isPreview: boolean; isVetoed: boolean }>(
  eff: ReadonlyArray<E>,
  totalCost: number,
): {
  effRevenue: number
  effProfit: number
  /** null with no revenue. */
  effMargin: number | null
  /** Proposals that would be written by Apply. */
  previewCount: number
  vetoCount: number
  /** The rows with a cost basis: the priced meter counts these. */
  costed: E[]
  pricedCount: number
  /** The cost sitting on costed rows with no price. */
  unpricedCost: number
} {
  const effRevenue = eff.reduce((s, r) => s + r.effRevenue, 0)
  const effProfit = effRevenue - totalCost
  const costed = eff.filter((r) => r.cost > 0)
  return {
    effRevenue,
    effProfit,
    effMargin: effRevenue > 0 ? effProfit / effRevenue : null,
    previewCount: eff.filter((r) => r.isPreview && !r.isVetoed).length,
    vetoCount: eff.filter((r) => r.isVetoed).length,
    costed,
    pricedCount: costed.filter((r) => r.effUnit != null).length,
    unpricedCost: costed.filter((r) => r.effUnit == null).reduce((s, r) => s + r.cost, 0),
  }
}
