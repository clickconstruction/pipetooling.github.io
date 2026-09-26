import {
  computeBidPricingRows,
  coverLetterTotalsFromPricingRows,
  type BidCountRowCalc,
  type ComputeBidPricingRowsInput,
  type ComputeBidPricingRowsResult,
  type PriceBookEntryCalc,
} from '../bidPricingRowCalculations'
import type { BidCountRowSubmissionHide } from './bidPricingEngineTypes'
import { submissionHiddenIdsForVersion } from './submissionHides'

/**
 * The scenario pricing adapter — one price scenario's overlay rows (assignments, custom prices,
 * submission hides, all keyed by `price_book_version_id`) projected onto the count rows it
 * prices, through `computeBidPricingRows`. The Pricing tab hand-rolled this four times
 * (Share / print / CSV, the workbench cards, the alternates' revenue, Copy prices from…) and
 * `useBidPricingRows` twice; one copy shipped every row at $0.00 against another version's
 * rows (v2.3685) and another read $0 on every other version's card (v2.3841). This is the
 * one place the projection lives.
 *
 * Rules kept from the copies:
 * - Only the scenario's own overlay rows count: an assignment, custom price or hide whose
 *   `price_book_version_id` is another scenario's is ignored, whatever the caller loaded.
 * - The count rows are the caller's: a scenario on another bid version prices on THAT
 *   version's rows (count rows are per version with their own ids, 20260823034820) — pass
 *   them; never the on-screen rows.
 * - `costs` is the grid's cost side (labor rows, materials, rate, tax, takeoff materials, the
 *   applied-quote override). Leave it out for revenue only — cards, alternates, copying prices —
 *   which is what every copy that passed zeros meant.
 */

export type ScenarioAssignmentRow = {
  price_book_version_id: string
  count_row_id: string
  price_book_entry_id: string
  is_fixed_price: boolean | null
  unit_price_override: number | null
}

export type ScenarioCustomPriceRow = {
  price_book_version_id: string
  count_row_id: string
  unit_price: number | string
}

/** A price book entry as the callers load it; `version_id` is present when several scenarios' entries came back in one read. */
export type ScenarioPriceBookEntry = PriceBookEntryCalc & { version_id?: string | null }

/** The cost side of the grid; omitted = prices only. */
export type ScenarioPricingCosts = Pick<
  ComputeBidPricingRowsInput,
  'laborRows' | 'totalMaterials' | 'laborRate' | 'taxPercent' | 'materialsFromTakeoffByCountRowId' | 'materialsOverrideUnitByCountRowId'
>

export const PRICES_ONLY: ScenarioPricingCosts = Object.freeze({
  laborRows: [],
  totalMaterials: 0,
  laborRate: 0,
  taxPercent: 0,
  materialsFromTakeoffByCountRowId: {},
})

export type ScenarioPricingInput = {
  /** The price scenario (`price_book_versions.id`). */
  scenarioId: string
  /** The count rows this scenario prices — its own bid version's. */
  countRows: readonly BidCountRowCalc[]
  entries: readonly ScenarioPriceBookEntry[]
  assignments: readonly ScenarioAssignmentRow[]
  customPrices: readonly ScenarioCustomPriceRow[]
  /** Submission hides; omit when the caller did not load them (nothing hidden). */
  hides?: readonly BidCountRowSubmissionHide[]
  costs?: ScenarioPricingCosts
}

/** The scenario's own custom prices, count_row_id → unit price. */
export function scenarioCustomPriceMap(customPrices: readonly ScenarioCustomPriceRow[], scenarioId: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const cp of customPrices) if (cp.price_book_version_id === scenarioId) map.set(cp.count_row_id, Number(cp.unit_price))
  return map
}

/** The scenario's own assignments in the pricing kernel's shape. */
export function scenarioAssignments(assignments: readonly ScenarioAssignmentRow[], scenarioId: string): ComputeBidPricingRowsInput['assignments'] {
  return assignments
    .filter((a) => a.price_book_version_id === scenarioId)
    .map((a) => ({ count_row_id: a.count_row_id, price_book_entry_id: a.price_book_entry_id, is_fixed_price: a.is_fixed_price ?? false, unit_price_override: a.unit_price_override }))
}

/** One scenario priced on the given count rows. */
export function scenarioPricingRows(input: ScenarioPricingInput): ComputeBidPricingRowsResult {
  const costs = input.costs ?? PRICES_ONLY
  return computeBidPricingRows({
    countRows: [...input.countRows],
    assignments: scenarioAssignments(input.assignments, input.scenarioId),
    entries: input.entries.filter((e) => e.version_id == null || e.version_id === input.scenarioId),
    customUnitPriceByCountRowId: scenarioCustomPriceMap(input.customPrices, input.scenarioId),
    laborRows: costs.laborRows,
    totalMaterials: costs.totalMaterials,
    laborRate: costs.laborRate,
    taxPercent: costs.taxPercent,
    materialsFromTakeoffByCountRowId: costs.materialsFromTakeoffByCountRowId,
    hiddenSubmissionCountRowIds: input.hides ? submissionHiddenIdsForVersion(input.hides, input.scenarioId) : new Set<string>(),
    materialsOverrideUnitByCountRowId: costs.materialsOverrideUnitByCountRowId,
  })
}

/** The scenario's revenue as the cover letter and the cards sum it (prices only unless `costs` is given). */
export function scenarioRevenue(input: ScenarioPricingInput): number {
  return coverLetterTotalsFromPricingRows(scenarioPricingRows(input).rows).revenueSum
}

export type ScenarioPackageRow = {
  fixture: string
  count: number
  unitPrice: number
  revenue: number
  omitFromSubmissionDocuments: boolean
}

/** The rows the Package-and-send modal, the mailto text and the clipboard HTML read (`PackageRowInput`), with the total. */
export function scenarioPackageRows(result: ComputeBidPricingRowsResult): { rows: ScenarioPackageRow[]; totalRevenue: number } {
  return {
    rows: result.rows.map((r) => ({ fixture: r.countRow.fixture ?? '', count: r.count, unitPrice: r.unitPrice, revenue: r.revenue, omitFromSubmissionDocuments: r.omitFromSubmissionDocuments })),
    totalRevenue: result.totalRevenue,
  }
}
