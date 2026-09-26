import { useMemo } from 'react'
import { coverLetterTotalsFromPricingRows, type ComputeBidPricingRowsResult } from '../lib/bidPricingRowCalculations'
import { scenarioPackageRows, scenarioPricingRows } from '../lib/bids/scenarioPricingRows'
import type { PackageAndSendPricingRowInput } from '../components/bids/PackageAndSendBidPricingModal'
import type { BidWithBuilder } from '../types/bidWithBuilder'
import type { BidCountRow } from '../types/bids'
import type {
  CostEstimate,
  CostEstimateLaborRow,
  BidPricingAssignment,
  BidCountRowCustomPrice,
  BidCountRowSubmissionHide,
  PriceBookEntryWithFixture,
} from '../lib/bids/bidPricingEngineTypes'

export type UseBidPricingRowsInput = {
  selectedBidForPricing: BidWithBuilder | null
  selectedPricingVersionId: string | null
  pricingCountRows: BidCountRow[]
  pricingCostEstimate: CostEstimate | null
  pricingMaterialTotalRoughIn: number | null
  pricingMaterialTotalTopOut: number | null
  pricingMaterialTotalTrimSet: number | null
  pricingLaborRate: number | null
  costEstimatePOModalTaxPercent: string
  bidPricingAssignments: BidPricingAssignment[]
  bidCountRowCustomPrices: BidCountRowCustomPrice[]
  /** Rung G (v2.2655): applied-quote materials overrides (cents/unit, bid-level). */
  bidCountRowCustomCosts?: Array<{ count_row_id: string; unit_materials_cents: number }>
  bidCountRowSubmissionHides: BidCountRowSubmissionHide[]
  priceBookEntries: PriceBookEntryWithFixture[]
  pricingLaborRows: CostEstimateLaborRow[]
  pricingFixtureMaterialsFromTakeoff: Record<string, number>
}

export type UseBidPricingRowsResult = {
  pricingRowsForGrid: ComputeBidPricingRowsResult | null
  pricingPackageSource: { rows: PackageAndSendPricingRowInput[]; totalRevenue: number } | null
  coverLetterPricingRows: { revenueSum: number; fixtureRows: { fixture: string; count: number }[] } | null
}

/**
 * Shared pricing-rows calc for the Bids cluster. Both the Pricing tab (grid, package-send
 * modal) and the Cover Letter tab (totals line) read from the same `computeBidPricingRows`
 * kernel, so the math is single-sourced here. Only one of those tabs is mounted at a time.
 */
export function useBidPricingRows(input: UseBidPricingRowsInput): UseBidPricingRowsResult {
  const {
    selectedBidForPricing,
    selectedPricingVersionId,
    pricingCountRows,
    pricingCostEstimate,
    pricingMaterialTotalRoughIn,
    pricingMaterialTotalTopOut,
    pricingMaterialTotalTrimSet,
    pricingLaborRate,
    costEstimatePOModalTaxPercent,
    bidPricingAssignments,
    bidCountRowCustomPrices,
    bidCountRowCustomCosts,
    bidCountRowSubmissionHides,
    priceBookEntries,
    pricingLaborRows,
    pricingFixtureMaterialsFromTakeoff,
  } = input

  // cents/unit → $/unit for the kernel; recomputed against live counts there.
  const materialsOverrideUnitByCountRowId = new Map<string, number>()
  for (const cc of bidCountRowCustomCosts ?? []) {
    materialsOverrideUnitByCountRowId.set(cc.count_row_id, cc.unit_materials_cents / 100)
  }

  /**
   * Shared package source: external rows + total revenue used by the "Package and send"
   * modal so the modal preview / mailto plain text / clipboard HTML all read the same
   * numbers as the table on screen. Null when the toolbar preconditions are not met.
   */
  const pricingPackageSource = useMemo<{
    rows: PackageAndSendPricingRowInput[]
    totalRevenue: number
  } | null>(() => {
    if (!selectedBidForPricing || !selectedPricingVersionId) return null
    if (pricingCountRows.length === 0 || !pricingCostEstimate) return null
    const totalMaterials =
      (pricingMaterialTotalRoughIn ?? 0) +
      (pricingMaterialTotalTopOut ?? 0) +
      (pricingMaterialTotalTrimSet ?? 0)
    const rate = pricingLaborRate ?? 0
    const taxPercent = parseFloat(costEstimatePOModalTaxPercent || '8.25') || 0
    // The one scenario adapter (v2.3853): own overlay rows only, the grid's cost side.
    return scenarioPackageRows(
      scenarioPricingRows({
        scenarioId: selectedPricingVersionId,
        countRows: pricingCountRows,
        entries: priceBookEntries,
        assignments: bidPricingAssignments,
        customPrices: bidCountRowCustomPrices,
        hides: bidCountRowSubmissionHides,
        costs: {
          laborRows: pricingLaborRows,
          totalMaterials,
          laborRate: rate,
          taxPercent,
          materialsFromTakeoffByCountRowId: pricingFixtureMaterialsFromTakeoff,
          materialsOverrideUnitByCountRowId,
        },
      }),
    )
  }, [
    selectedBidForPricing,
    selectedPricingVersionId,
    pricingCountRows,
    pricingCostEstimate,
    pricingMaterialTotalRoughIn,
    pricingMaterialTotalTopOut,
    pricingMaterialTotalTrimSet,
    pricingLaborRate,
    costEstimatePOModalTaxPercent,
    bidPricingAssignments,
    bidCountRowCustomPrices,
    bidCountRowCustomCosts,
    bidCountRowSubmissionHides,
    priceBookEntries,
    pricingLaborRows,
    pricingFixtureMaterialsFromTakeoff,
  ])

  const pricingRowsForGrid = useMemo<ComputeBidPricingRowsResult | null>(() => {
    if (!selectedBidForPricing || !selectedPricingVersionId) return null
    if (pricingCountRows.length === 0) return null
    const totalMaterials = pricingCostEstimate
      ? (pricingMaterialTotalRoughIn ?? 0) + (pricingMaterialTotalTopOut ?? 0) + (pricingMaterialTotalTrimSet ?? 0)
      : 0
    const rate = pricingCostEstimate ? (pricingLaborRate ?? 0) : 0
    const taxPercent = parseFloat(costEstimatePOModalTaxPercent || '8.25') || 0
    return scenarioPricingRows({
      scenarioId: selectedPricingVersionId,
      countRows: pricingCountRows,
      entries: priceBookEntries,
      assignments: bidPricingAssignments,
      customPrices: bidCountRowCustomPrices,
      hides: bidCountRowSubmissionHides,
      costs: {
        laborRows: pricingLaborRows,
        totalMaterials,
        laborRate: rate,
        taxPercent,
        materialsFromTakeoffByCountRowId: pricingFixtureMaterialsFromTakeoff,
        materialsOverrideUnitByCountRowId,
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the override map is rebuilt each render from bidCountRowCustomCosts (dep below)
  }, [
    selectedBidForPricing,
    selectedPricingVersionId,
    pricingCountRows,
    pricingCostEstimate,
    pricingMaterialTotalRoughIn,
    pricingMaterialTotalTopOut,
    pricingMaterialTotalTrimSet,
    pricingLaborRate,
    costEstimatePOModalTaxPercent,
    bidPricingAssignments,
    bidCountRowCustomPrices,
    bidCountRowCustomCosts,
    bidCountRowSubmissionHides,
    priceBookEntries,
    pricingLaborRows,
    pricingFixtureMaterialsFromTakeoff,
  ])

  const coverLetterPricingRows = useMemo<{ revenueSum: number; fixtureRows: { fixture: string; count: number }[] } | null>(() => {
    if (!pricingRowsForGrid) return null
    return coverLetterTotalsFromPricingRows(pricingRowsForGrid.rows)
  }, [pricingRowsForGrid])

  return { pricingRowsForGrid, pricingPackageSource, coverLetterPricingRows }
}
