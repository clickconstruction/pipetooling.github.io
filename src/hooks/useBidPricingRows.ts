import { useMemo } from 'react'
import {
  computeBidPricingRows,
  coverLetterTotalsFromPricingRows,
  type ComputeBidPricingRowsResult,
} from '../lib/bidPricingRowCalculations'
import { submissionHiddenIdsForVersion } from '../lib/bids/submissionHides'
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
    bidCountRowSubmissionHides,
    priceBookEntries,
    pricingLaborRows,
    pricingFixtureMaterialsFromTakeoff,
  } = input

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
    const assignmentsForVersion = bidPricingAssignments.filter(
      (a) => a.price_book_version_id === selectedPricingVersionId,
    )
    const customMap = new Map<string, number>()
    for (const cp of bidCountRowCustomPrices) {
      if (cp.price_book_version_id === selectedPricingVersionId) {
        customMap.set(cp.count_row_id, Number(cp.unit_price))
      }
    }
    const hidden = submissionHiddenIdsForVersion(
      bidCountRowSubmissionHides,
      selectedPricingVersionId,
    )
    const result = computeBidPricingRows({
      countRows: pricingCountRows,
      assignments: assignmentsForVersion.map((a) => ({
        count_row_id: a.count_row_id,
        price_book_entry_id: a.price_book_entry_id,
        is_fixed_price: a.is_fixed_price ?? false,
        unit_price_override: a.unit_price_override,
      })),
      entries: priceBookEntries,
      customUnitPriceByCountRowId: customMap,
      laborRows: pricingLaborRows,
      totalMaterials,
      laborRate: rate,
      taxPercent,
      materialsFromTakeoffByCountRowId: pricingFixtureMaterialsFromTakeoff,
      hiddenSubmissionCountRowIds: hidden,
    })
    return {
      rows: result.rows.map((r) => ({
        fixture: r.countRow.fixture ?? '',
        count: r.count,
        unitPrice: r.unitPrice,
        revenue: r.revenue,
        omitFromSubmissionDocuments: r.omitFromSubmissionDocuments,
      })),
      totalRevenue: result.totalRevenue,
    }
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
    const assignmentsForVersion = bidPricingAssignments.filter(
      (a) => a.price_book_version_id === selectedPricingVersionId,
    )
    const customUnitPriceByCountRowId = new Map<string, number>()
    for (const cp of bidCountRowCustomPrices) {
      if (cp.price_book_version_id === selectedPricingVersionId) {
        customUnitPriceByCountRowId.set(cp.count_row_id, Number(cp.unit_price))
      }
    }
    const hidden = submissionHiddenIdsForVersion(bidCountRowSubmissionHides, selectedPricingVersionId)
    return computeBidPricingRows({
      countRows: pricingCountRows,
      assignments: assignmentsForVersion.map((a) => ({
        count_row_id: a.count_row_id,
        price_book_entry_id: a.price_book_entry_id,
        is_fixed_price: a.is_fixed_price ?? false,
        unit_price_override: a.unit_price_override,
      })),
      entries: priceBookEntries,
      customUnitPriceByCountRowId,
      laborRows: pricingLaborRows,
      totalMaterials,
      laborRate: rate,
      taxPercent,
      materialsFromTakeoffByCountRowId: pricingFixtureMaterialsFromTakeoff,
      hiddenSubmissionCountRowIds: hidden,
    })
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
