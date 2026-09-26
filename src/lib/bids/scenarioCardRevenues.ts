import type { BidCountRowCalc, PriceBookEntryCalc } from '../bidPricingRowCalculations'
import type { BidCountRowSubmissionHide } from './bidPricingEngineTypes'
import { scenarioRevenue } from './scenarioPricingRows'

/** Map key for a bid version's count rows ('' = the unversioned rows of a legacy bid). */
export function bidVersionRowsKey(bidVersionId: string | null | undefined): string {
  return bidVersionId ?? ''
}

export type ScenarioCardRevenueInput = {
  /** The bid's price scenarios (price_book_versions rows) to price. */
  scenarios: ReadonlyArray<{ id: string; bid_version_id: string | null }>
  /** The bid version whose count rows are on screen. */
  activeBidVersionId: string | null
  activeCountRows: BidCountRowCalc[]
  /** Count rows of the other bid versions, by `bidVersionRowsKey`. A version missing here is not priced. */
  countRowsByBidVersion: ReadonlyMap<string, BidCountRowCalc[]>
  entries: ReadonlyArray<PriceBookEntryCalc & { version_id: string }>
  assignments: ReadonlyArray<{
    price_book_version_id: string
    count_row_id: string
    price_book_entry_id: string
    is_fixed_price: boolean | null
    unit_price_override: number | null
  }>
  customPrices: ReadonlyArray<{ price_book_version_id: string; count_row_id: string; unit_price: number | string }>
  hides: readonly BidCountRowSubmissionHide[]
}

/**
 * Revenue for each scenario card on Bids → Pricing (the workbench strip). Each scenario is priced
 * on ITS OWN bid version's count rows — count rows are per version with their own ids
 * (20260823034820), so a scenario of another version priced against the on-screen rows matched
 * none and read $0 (v2.3841). The same own-rows rule as the tab's `loadScenarioInputs` (the
 * v2.3685 Share fix). A scenario whose rows are not supplied is left out — its card reads
 * "not priced", never a wrong $0.
 */
export function scenarioCardRevenues(input: ScenarioCardRevenueInput): Record<string, number> {
  const out: Record<string, number> = {}
  const activeKey = bidVersionRowsKey(input.activeBidVersionId)
  for (const s of input.scenarios) {
    const key = bidVersionRowsKey(s.bid_version_id)
    const countRows = key === activeKey ? input.activeCountRows : input.countRowsByBidVersion.get(key)
    if (!countRows) continue
    // Prices only, through the one adapter (v2.3853); the kernel keeps each scenario to its own overlay rows and entries.
    out[s.id] = scenarioRevenue({ scenarioId: s.id, countRows, entries: input.entries, assignments: input.assignments, customPrices: input.customPrices, hides: input.hides })
  }
  return out
}
