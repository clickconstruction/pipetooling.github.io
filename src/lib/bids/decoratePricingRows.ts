/**
 * The Pricing grid's row decoration (Pricing train, Stage A — v2.3546): joins the calc
 * kernel's rows (`computeBidPricingRows`) with the labor row of the same fixture, the custom
 * price and the assignment for the active pricing, the takeoff materials figure, the tax
 * amount, and the margin flag — then buckets the rows that carry revenue with no takeoff
 * cost (their margin reads "—" and the bid-level total counts them as full profit until
 * costs are entered; map quirk 10). Lifted verbatim from the grid IIFE in `BidsPricingTab`.
 */
import type { ComputedBidPricingRow } from '../bidPricingRowCalculations'
import type { BidCountRow } from '../../types/bids'
import { marginFlag } from './bidFormatting'
import type { BidCountRowCustomPrice, BidPricingAssignment, CostEstimateLaborRow, PriceBookEntryWithFixture } from './bidPricingEngineTypes'

export type DecoratedPricingRow = {
  countRow: BidCountRow
  entry: PriceBookEntryWithFixture | undefined
  laborRow: CostEstimateLaborRow | undefined
  count: number
  cost: number
  unitPrice: number
  isFixedPrice: boolean
  revenue: number
  margin: number | null
  flag: ReturnType<typeof marginFlag>
  assignment: BidPricingAssignment | undefined
  customPrice: number | null
  materialsBeforeTax: number
  materialsWithTax: number
  taxAmount: number
  laborCost: number
  materialsFromTakeoff: number | null
  pctOfGrandTotal: number | null
  omitFromSubmissionDocuments: boolean
  canToggleOmitSubmission: boolean
}

export type DecoratePricingRowsInput = {
  rows: ReadonlyArray<ComputedBidPricingRow>
  laborRows: ReadonlyArray<CostEstimateLaborRow>
  customPrices: ReadonlyArray<BidCountRowCustomPrice>
  /** Assignments already narrowed to the active pricing. */
  assignmentsForVersion: ReadonlyArray<BidPricingAssignment>
  materialsFromTakeoffByCountRowId: Record<string, number>
  taxPercent: number
  versionId: string | null
  /** Whether the omit-from-submission toggle is live (an active pricing exists). */
  canToggleOmitSubmission: boolean
}

export function decoratePricingRows(input: DecoratePricingRowsInput): {
  rows: DecoratedPricingRow[]
  uncostedRevenueRows: DecoratedPricingRow[]
  uncostedRevenue: number
} {
  const { rows: calcRows, laborRows, customPrices, assignmentsForVersion, materialsFromTakeoffByCountRowId, taxPercent, versionId, canToggleOmitSubmission } = input
  const rows = calcRows.map((pr): DecoratedPricingRow => {
    const laborRow = laborRows.find((l) => (l.fixture ?? '').toLowerCase() === (pr.countRow.fixture ?? '').toLowerCase())
    const customPrice =
      customPrices.find((c) => c.count_row_id === pr.countRow.id && c.price_book_version_id === versionId)?.unit_price ?? null
    const assignment = assignmentsForVersion.find((a) => a.count_row_id === pr.countRow.id)
    const materialsFromTakeoff = materialsFromTakeoffByCountRowId[pr.countRow.id]
    const taxAmount = materialsFromTakeoff != null ? pr.materialsBeforeTax * (taxPercent / 100) : 0
    const marginVal = pr.marginPct
    const flag = marginFlag(marginVal)
    return {
      countRow: pr.countRow as BidCountRow,
      entry: pr.entry as PriceBookEntryWithFixture | undefined,
      laborRow,
      count: pr.count,
      cost: pr.cost,
      unitPrice: pr.unitPrice,
      isFixedPrice: pr.isFixedPrice,
      revenue: pr.revenue,
      margin: marginVal,
      flag,
      assignment,
      customPrice,
      materialsBeforeTax: pr.materialsBeforeTax,
      materialsWithTax: pr.materialsWithTax,
      taxAmount,
      laborCost: pr.laborCost,
      materialsFromTakeoff: materialsFromTakeoff ?? null,
      pctOfGrandTotal: pr.pctOfGrandTotal,
      omitFromSubmissionDocuments: pr.omitFromSubmissionDocuments,
      canToggleOmitSubmission,
    }
  })
  const uncostedRevenueRows = rows.filter((r) => r.revenue > 0 && (r.materialsFromTakeoff == null || r.materialsFromTakeoff === 0))
  const uncostedRevenue = uncostedRevenueRows.reduce((s, r) => s + r.revenue, 0)
  return { rows, uncostedRevenueRows, uncostedRevenue }
}
