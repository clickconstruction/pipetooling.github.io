/**
 * What the Pricing Workbench derives from a bid's reads (punch list #46, row 1, v2.8744): the bid's cost by its
 * parts, the tax on its material, its revenue, and every row decorated for the grid. Every number in the strip,
 * the cards, the grid and a row's breakdown window flows from it.
 *
 * Lifted out of `BidsPricingTab` as it stood, with no change to its logic: the same reads, the same two kernels
 * (`computeBidCostBreakdown`, `decoratePricingRows`), the same order and the same early returns. The names of its
 * inputs are the tab's own, so the two can be read side by side. The one piece that was not arithmetic, opening a
 * row's breakdown window, stays in the tab: this answers what that window is handed (`breakdownRowOf`).
 *
 * Null while there is nothing to derive: no price picked, nothing counted, no cost estimate, or the grid's rows
 * not worked out yet. Pure: no React, no Supabase.
 */
import { computeBidCostBreakdown, type BidCostBreakdownInput } from './bidTotalCostBreakdown'
import type { BidPricingAssignment } from './bidPricingEngineTypes'
import { decoratePricingRows, type DecoratePricingRowsInput, type DecoratedPricingRow } from './decoratePricingRows'

export type DerivePricingWorkbenchInput = {
  selectedPricingVersionId: string | null
  /** Only how many there are is read. */
  pricingCountRows: ReadonlyArray<unknown>
  pricingCostEstimate: BidCostBreakdownInput['costEstimate']
  /** The tax box's text. Empty reads 8.25, and text that is no number reads 0, as the tab always read it. */
  costEstimatePOModalTaxPercent: string
  teamLaborDataForBids: ReadonlyArray<{ bidId: string; bidCost: number }>
  pricingMaterialTotalRoughIn: BidCostBreakdownInput['materialTotalRoughIn']
  pricingMaterialTotalTopOut: BidCostBreakdownInput['materialTotalTopOut']
  pricingMaterialTotalTrimSet: BidCostBreakdownInput['materialTotalTrimSet']
  pricingLaborRate: BidCostBreakdownInput['laborRate']
  pricingLaborRows: DecoratePricingRowsInput['laborRows'] & BidCostBreakdownInput['laborRows']
  selectedBidForPricing: { id?: string | null; distance_from_office?: BidCostBreakdownInput['distanceFromOffice'] } | null
  pricingDirectCostRows: BidCostBreakdownInput['directCostRows']
  bidPricingAssignments: ReadonlyArray<BidPricingAssignment>
  pricingRowsForGrid: { rows: DecoratePricingRowsInput['rows']; totalRevenue: number } | null
  bidCountRowCustomPrices: DecoratePricingRowsInput['customPrices']
  pricingFixtureMaterialsFromTakeoff: DecoratePricingRowsInput['materialsFromTakeoffByCountRowId']
}

export function derivePricingWorkbench(input: DerivePricingWorkbenchInput) {
  const {
    selectedPricingVersionId,
    pricingCountRows,
    pricingCostEstimate,
    costEstimatePOModalTaxPercent,
    teamLaborDataForBids,
    pricingMaterialTotalRoughIn,
    pricingMaterialTotalTopOut,
    pricingMaterialTotalTrimSet,
    pricingLaborRate,
    pricingLaborRows,
    selectedBidForPricing,
    pricingDirectCostRows,
    bidPricingAssignments,
    pricingRowsForGrid,
    bidCountRowCustomPrices,
    pricingFixtureMaterialsFromTakeoff,
  } = input
  if (!selectedPricingVersionId || pricingCountRows.length === 0 || !pricingCostEstimate) return null
  const taxPercent = parseFloat(costEstimatePOModalTaxPercent || '8.25') || 0
  const teamLaborCostByBidId = new Map(teamLaborDataForBids.map((r) => [r.bidId, r.bidCost]))
  // One total (v2.3292): the same kernel the Pricing print/CSV, the Labor page and the approval PDF read.
  const { totalMaterials, rate, totalLaborHours, laborCost, distance, ratePerMile, hrsPerTrip, numTrips, drivingCost, estimatorCost, travelCost, equipmentRentalCost, permitCost, subcontractorCost, wasteCost, otherCost, teamLaborCost, totalCost } = computeBidCostBreakdown({
    materialTotalRoughIn: pricingMaterialTotalRoughIn,
    materialTotalTopOut: pricingMaterialTotalTopOut,
    materialTotalTrimSet: pricingMaterialTotalTrimSet,
    laborRate: pricingLaborRate,
    laborRows: pricingLaborRows,
    distanceFromOffice: selectedBidForPricing?.distance_from_office ?? null,
    costEstimate: pricingCostEstimate,
    countRowsLength: pricingCountRows.length,
    directCostRows: pricingDirectCostRows,
    teamLaborCost: selectedBidForPricing?.id ? (teamLaborCostByBidId.get(selectedBidForPricing.id) ?? 0) : 0,
  })
  const assignmentsForVersion = bidPricingAssignments.filter((a) => a.price_book_version_id === selectedPricingVersionId)
  const pricingCalcResult = pricingRowsForGrid
  if (!pricingCalcResult) return null

  const totalRevenue = pricingCalcResult.totalRevenue
  // Fixtures with a Sale Price but no Takeoffs Unit-price cost: their margin reads "—"
  // (no cost basis), and the bid-level Total margin treats them as full profit — so it
  // is overstated until those costs are entered in Takeoffs (`uncostedRevenueRows`).
  const { rows, uncostedRevenueRows, uncostedRevenue } = decoratePricingRows({
    rows: pricingCalcResult.rows,
    laborRows: pricingLaborRows,
    customPrices: bidCountRowCustomPrices,
    assignmentsForVersion,
    materialsFromTakeoffByCountRowId: pricingFixtureMaterialsFromTakeoff,
    taxPercent,
    versionId: selectedPricingVersionId,
    canToggleOmitSubmission: selectedPricingVersionId != null,
  })
  /** What a row's breakdown window is handed. The tab opens the window with it. */
  const breakdownRowOf = (r: DecoratedPricingRow) => ({
    countRowId: r.countRow.id,
    fixture: r.countRow.fixture ?? '',
    count: r.count,
    unitPrice: r.unitPrice,
    isFixedPrice: r.isFixedPrice,
    revenue: r.revenue,
    materialsBeforeTax: r.materialsBeforeTax,
    taxAmount: r.taxAmount,
    taxPercent,
    laborCost: r.laborCost,
    cost: r.cost,
    margin: r.margin,
    materialsFromTakeoff: r.materialsFromTakeoff,
  })
  // The bid's cost carries the tax on its material (punch list #128 PR 1), as every row's cost already did —
  // until now the overhead line absorbed it (the map's tax fallback duality).
  const taxCost = totalMaterials * (taxPercent / 100)
  return { totalMaterials, rate, totalLaborHours, taxPercent, taxCost, laborCost, distance, ratePerMile, hrsPerTrip, numTrips, drivingCost, estimatorCost, travelCost, equipmentRentalCost, permitCost, subcontractorCost, wasteCost, otherCost, teamLaborCost, totalCost: totalCost + taxCost, assignmentsForVersion, totalRevenue, rows, uncostedRevenueRows, uncostedRevenue, breakdownRowOf }
}

export type DerivedPricingWorkbench = NonNullable<ReturnType<typeof derivePricingWorkbench>>
