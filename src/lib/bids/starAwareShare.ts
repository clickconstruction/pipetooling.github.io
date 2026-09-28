/**
 * Bids → Pricing: Share / Print / CSV honor the ★ (F2, v2.2120; "both", v2.3685) — the pure
 * half of region P7 of `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`. When the scenario on
 * screen is not the customer's price, a chooser asks which one to send, print or export;
 * picking the ★ prices that scenario from its own inputs, with no view switch.
 *
 * `useStarAwareShare` holds the state and the side effects; everything here is a function
 * of its arguments.
 */
import type { PackageRowInput } from '../buildBidPricingPackageHtml'
import type { PricingPrintContext } from '../bidDocuments/pricingPage'
import type { ScenarioInputs } from './loadScenarioInputs'
import { scenarioPackageRows, scenarioPricingRows } from './scenarioPricingRows'

export type StarAwareAction = 'share' | 'print' | 'csv'
/** 'both' is offered for a share only: the ★ price with the viewed one under it. */
export type StarChoice = 'star' | 'viewed' | 'both'

export type SharePricing = { pricingId: string; name: string; rows: PackageRowInput[]; totalRevenue: number }
export type ShareOverride = SharePricing & { also?: SharePricing | null }

/** What the print, the CSV and the ★'s package are built from — the Pricing tab's inputs for the bid on screen. */
export type PricingShareInputs = Omit<PricingPrintContext, 'viewModel' | 'teamLaborCost'> & {
  /** Team labor clocked per bid; the bid's own row is the print's and the CSV's team labor cost. */
  teamLaborDataForBids: ReadonlyArray<{ bidId: string; bidCost: number }>
}

/** A scenario's name, or an em dash when it is not among the bid's scenarios. */
export function pricingNameOf(versions: ReadonlyArray<{ id: string; name: string }>, id: string | null): string {
  return versions.find((v) => v.id === id)?.name ?? '—'
}

/** Team labor clocked on the bid — 0 when nobody has; with two rows for one bid the later one counts. */
export function teamLaborCostForBid(rows: ReadonlyArray<{ bidId: string; bidCost: number }>, bidId: string): number {
  return new Map(rows.map((r) => [r.bidId, r.bidCost])).get(bidId) ?? 0
}

/** The chooser shows only when there is a ★, a scenario on screen, and they differ. */
export function starChooserNeeded(starId: string | null, viewedId: string | null): boolean {
  return !!(starId && viewedId && starId !== viewedId)
}

/** The action reads what is on screen: the viewed price was picked, the bid has no ★, or the ★ is on screen. */
export function starActionReadsViewed(choice: StarChoice, starId: string | null, viewedId: string | null): boolean {
  return choice === 'viewed' || !starId || starId === viewedId
}

/** The print / CSV context for the scenario on screen (the price view). */
export function buildPricingPrintContext(inputs: PricingShareInputs): PricingPrintContext {
  const { teamLaborDataForBids, ...rest } = inputs
  return {
    ...rest,
    viewModel: 'price',
    teamLaborCost: inputs.bid.id ? teamLaborCostForBid(teamLaborDataForBids, inputs.bid.id) : 0,
  }
}

/** The same context re-aimed at another scenario: its id, its prices, and its own count rows when it has them. */
export function pricingPrintContextFor(ctx: PricingPrintContext, pricingId: string, inputs: ScenarioInputs): PricingPrintContext {
  return {
    ...ctx,
    selectedPricingVersionId: pricingId,
    countRows: inputs.countRows ?? ctx.countRows,
    priceBookEntries: inputs.entries,
    assignments: inputs.assignments,
    customPrices: inputs.customPrices,
    submissionHides: inputs.hides,
  }
}

/** Same math as `useBidPricingRows.pricingPackageSource`, for an arbitrary scenario's inputs — the one kernel (v2.3853). */
export function scenarioPackageFromInputs(
  pricingId: string,
  inputs: ScenarioInputs,
  costs: Pick<PricingShareInputs, 'countRows' | 'laborRows' | 'materialTotalRoughIn' | 'materialTotalTopOut' | 'materialTotalTrimSet' | 'laborRate' | 'taxPercent' | 'fixtureMaterialsFromTakeoff'>,
): { rows: PackageRowInput[]; totalRevenue: number } {
  return scenarioPackageRows(
    scenarioPricingRows({
      scenarioId: pricingId,
      countRows: inputs.countRows ?? costs.countRows,
      entries: inputs.entries,
      assignments: inputs.assignments,
      customPrices: inputs.customPrices,
      hides: inputs.hides,
      costs: {
        laborRows: costs.laborRows,
        totalMaterials: (costs.materialTotalRoughIn ?? 0) + (costs.materialTotalTopOut ?? 0) + (costs.materialTotalTrimSet ?? 0),
        laborRate: costs.laborRate ?? 0,
        taxPercent: costs.taxPercent,
        materialsFromTakeoffByCountRowId: costs.fixtureMaterialsFromTakeoff,
      },
    }),
  )
}

/**
 * What the Package-and-send window is handed for a ★ share: the ★ price, and under it the
 * viewed one when "both" was picked and there is a viewed price to send.
 */
export function shareOverrideForStar(args: {
  starId: string
  starPackage: { rows: PackageRowInput[]; totalRevenue: number }
  choice: StarChoice
  viewedId: string | null
  viewedPackage: { rows: PackageRowInput[]; totalRevenue: number } | null
  versions: ReadonlyArray<{ id: string; name: string }>
}): ShareOverride {
  const { starId, starPackage, choice, viewedId, viewedPackage, versions } = args
  const also: SharePricing | null =
    choice === 'both' && viewedId && viewedPackage
      ? { pricingId: viewedId, name: pricingNameOf(versions, viewedId), rows: viewedPackage.rows, totalRevenue: viewedPackage.totalRevenue }
      : null
  return { pricingId: starId, name: pricingNameOf(versions, starId), rows: starPackage.rows, totalRevenue: starPackage.totalRevenue, also }
}

/** The chooser's verb, and what its confirm button says. */
export function starChooserVerb(action: StarAwareAction): 'Send' | 'Print' | 'Export' {
  return action === 'share' ? 'Send' : action === 'print' ? 'Print' : 'Export'
}
export function starChooserConfirmLabel(args: { action: StarAwareAction; choice: StarChoice; starName: string; viewedName: string; busy: boolean }): string {
  const { action, choice, starName, viewedName, busy } = args
  if (busy) return 'Loading…'
  return `${starChooserVerb(action)} ${choice === 'star' ? `★ ${starName}` : choice === 'both' ? 'both' : viewedName}`
}
