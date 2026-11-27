/**
 * What the Pricing Workbench derives from a bid's reads (punch list #46, row 1). The bid is the render smoke's own
 * made-up one, so each dollar here is the dollar `BidsPricingTab.render.test.tsx` reads off the mounted tab: the
 * strip's $6,800.00 and $4,068.00, and the breakdown window's $1,899.00. Those were pinned on the tab while the
 * function still lived in it. Every name and number is made up.
 */
import { describe, expect, it } from 'vitest'
import { derivePricingWorkbench, type DerivePricingWorkbenchInput } from './derivePricingWorkbench'
import { scenarioPricingRows } from './scenarioPricingRows'

const PRICING_ID = 'price-base'
const COUNT_ROWS = [
  { id: 'cr-wc', bid_id: 'bid-1', bid_version_id: null, fixture: 'Water closet', count: 6, group_tag: null, sequence_order: 0, kind: 'fixture', tags: ['restrooms'], split_material_cents: null, split_markup_pct: null, split_taxable: null },
  { id: 'cr-lav', bid_id: 'bid-1', bid_version_id: null, fixture: 'Lavatory', count: 4, group_tag: null, sequence_order: 1, kind: null, tags: null, split_material_cents: null, split_markup_pct: null, split_taxable: null },
  { id: 'cr-fd', bid_id: 'bid-1', bid_version_id: null, fixture: 'Floor drain', count: 3, group_tag: null, sequence_order: 2, kind: null, tags: null, split_material_cents: null, split_markup_pct: null, split_taxable: null },
]
/** Six water closets at $800 and four lavatories at $500: $6,800. The floor drain has no price. */
const CUSTOM_PRICES = [
  { id: 'cp-wc', bid_id: 'bid-1', count_row_id: 'cr-wc', price_book_version_id: PRICING_ID, unit_price: 800 },
  { id: 'cp-lav', bid_id: 'bid-1', count_row_id: 'cr-lav', price_book_version_id: PRICING_ID, unit_price: 500 },
]
const LABOR_ROWS = [
  { id: 'lr-wc', cost_estimate_id: 'ce-1', fixture: 'Water closet', count: 6, rough_in_hrs_per_unit: 1, top_out_hrs_per_unit: 0.5, trim_set_hrs_per_unit: 0.5, is_fixed: false, sequence_order: 0 },
  { id: 'lr-lav', cost_estimate_id: 'ce-1', fixture: 'Lavatory', count: 4, rough_in_hrs_per_unit: 1, top_out_hrs_per_unit: 0.5, trim_set_hrs_per_unit: 0.5, is_fixed: false, sequence_order: 1 },
]
const COST_ESTIMATE = { id: 'ce-1', bid_id: 'bid-1', labor_rate: 50, driving_cost_rate: 0.7, hours_per_trip: 2 }
const MATERIALS_BY_ROW: Record<string, number> = { 'cr-wc': 1200, 'cr-lav': 400 }

const gridRows = () =>
  scenarioPricingRows({
    scenarioId: PRICING_ID,
    countRows: COUNT_ROWS,
    entries: [],
    assignments: [],
    customPrices: CUSTOM_PRICES,
    hides: [],
    costs: { laborRows: LABOR_ROWS, totalMaterials: 1600, laborRate: 50, taxPercent: 8.25, materialsFromTakeoffByCountRowId: MATERIALS_BY_ROW, materialsOverrideUnitByCountRowId: new Map<string, number>() },
  } as unknown as Parameters<typeof scenarioPricingRows>[0])

const input = (over: Partial<DerivePricingWorkbenchInput> = {}): DerivePricingWorkbenchInput =>
  ({
    selectedPricingVersionId: PRICING_ID,
    pricingCountRows: COUNT_ROWS,
    pricingCostEstimate: COST_ESTIMATE,
    costEstimatePOModalTaxPercent: '8.25',
    teamLaborDataForBids: [],
    pricingMaterialTotalRoughIn: 1600,
    pricingMaterialTotalTopOut: 0,
    pricingMaterialTotalTrimSet: 0,
    pricingLaborRate: 50,
    pricingLaborRows: LABOR_ROWS,
    selectedBidForPricing: { id: 'bid-1', distance_from_office: null },
    pricingDirectCostRows: [],
    bidPricingAssignments: [],
    pricingRowsForGrid: gridRows(),
    bidCountRowCustomPrices: CUSTOM_PRICES,
    pricingFixtureMaterialsFromTakeoff: MATERIALS_BY_ROW,
    ...over,
  }) as unknown as DerivePricingWorkbenchInput

const derive = (over: Partial<DerivePricingWorkbenchInput> = {}) => derivePricingWorkbench(input(over))!

describe('derivePricingWorkbench: the bid the Workbench smoke mounts', () => {
  it('the strip’s numbers: $6,800 of revenue over $2,732 of cost', () => {
    const d = derive()
    // 6 x $800 + 4 x $500.
    expect(d.totalRevenue).toBe(6800)
    // $1,600 material + $132 tax at 8.25% + 20 h x $50.
    expect(d.totalMaterials).toBe(1600)
    expect(d.taxPercent).toBe(8.25)
    expect(d.taxCost).toBe(132)
    expect(d.rate).toBe(50)
    expect(d.totalLaborHours).toBe(20)
    expect(d.laborCost).toBe(1000)
    expect(d.totalCost).toBe(2732)
    // The strip's profit and margin are these two: $4,068.00, 60%.
    expect(d.totalRevenue - d.totalCost).toBe(4068)
    expect(Math.round(((d.totalRevenue - d.totalCost) / d.totalRevenue) * 100)).toBe(60)
  })

  it('every part of the cost, with nothing driven, rented or sent out on this bid', () => {
    const d = derive()
    expect({ distance: d.distance, drivingCost: d.drivingCost, travelCost: d.travelCost, equipmentRentalCost: d.equipmentRentalCost, permitCost: d.permitCost, subcontractorCost: d.subcontractorCost, wasteCost: d.wasteCost, otherCost: d.otherCost, teamLaborCost: d.teamLaborCost }).toEqual({ distance: 0, drivingCost: 0, travelCost: 0, equipmentRentalCost: 0, permitCost: 0, subcontractorCost: 0, wasteCost: 0, otherCost: 0, teamLaborCost: 0 })
    // Twenty hours at two hours a trip is ten trips, and with no miles on the bid they cost nothing to drive.
    expect(d.ratePerMile).toBe(0.7)
    expect(d.hrsPerTrip).toBe(2)
    expect(d.numTrips).toBe(10)
    // The estimator's time is reported and never added: the $2,732 above holds no part of it.
    expect(d.estimatorCost).toBe(30)
    expect(d.totalCost).toBe(d.totalMaterials + d.taxCost + d.laborCost)
  })

  it('a row per counted fixture, decorated: its price, its cost by its parts and its margin', () => {
    const d = derive()
    expect(d.rows.map((r) => [r.countRow.id, r.count, r.unitPrice, r.revenue, r.materialsBeforeTax, r.taxAmount, r.laborCost, r.cost])).toEqual([
      ['cr-wc', 6, 800, 4800, 1200, 99, 600, 1899],
      ['cr-lav', 4, 500, 2000, 400, 33, 400, 833],
      ['cr-fd', 3, 0, 0, 0, 0, 0, 0],
    ])
    // $2,901 of $4,800, and $1,167 of $2,000.
    expect(d.rows[0]!.margin).toBeCloseTo(60.4375, 6)
    expect(d.rows[1]!.margin).toBeCloseTo(58.35, 6)
    expect(d.rows[2]!.priced).toBe(false)
    expect(d.rows.map((r) => r.customPrice)).toEqual([800, 500, null])
    // Each row carries the labor row of the same fixture, which its split and its hours read.
    expect(d.rows.map((r) => r.laborRow?.id ?? null)).toEqual(['lr-wc', 'lr-lav', null])
    expect(d.rows.every((r) => r.canToggleOmitSubmission)).toBe(true)
    // Both priced rows have a takeoff cost, so no revenue stands on no cost.
    expect(d.uncostedRevenueRows).toEqual([])
    expect(d.uncostedRevenue).toBe(0)
  })

  it('what the breakdown window is handed for a row: the dollars the smoke reads in that window', () => {
    const d = derive()
    expect(d.breakdownRowOf(d.rows[0]!)).toEqual({ countRowId: 'cr-wc', fixture: 'Water closet', count: 6, unitPrice: 800, isFixedPrice: false, revenue: 4800, materialsBeforeTax: 1200, taxAmount: 99, taxPercent: 8.25, laborCost: 600, cost: 1899, margin: d.rows[0]!.margin, materialsFromTakeoff: 1200 })
    // A row with no name reads as an empty one, never as undefined.
    expect(d.breakdownRowOf({ ...d.rows[0]!, countRow: { ...d.rows[0]!.countRow, fixture: null as unknown as string } }).fixture).toBe('')
  })
})

describe('derivePricingWorkbench: what it reads, as the tab always read it', () => {
  it('is null while there is nothing to derive', () => {
    expect(derivePricingWorkbench(input({ selectedPricingVersionId: null }))).toBeNull()
    expect(derivePricingWorkbench(input({ selectedPricingVersionId: '' }))).toBeNull()
    expect(derivePricingWorkbench(input({ pricingCountRows: [] }))).toBeNull()
    expect(derivePricingWorkbench(input({ pricingCostEstimate: null }))).toBeNull()
    expect(derivePricingWorkbench(input({ pricingRowsForGrid: null }))).toBeNull()
  })

  it('the tax box: empty reads 8.25, and text that is no number or a zero reads 0', () => {
    expect(derive({ costEstimatePOModalTaxPercent: '' }).taxPercent).toBe(8.25)
    expect(derive({ costEstimatePOModalTaxPercent: 'abc' }).taxPercent).toBe(0)
    expect(derive({ costEstimatePOModalTaxPercent: '0' }).taxPercent).toBe(0)
    const ten = derive({ costEstimatePOModalTaxPercent: '10' })
    expect(ten.taxCost).toBe(160)
    expect(ten.totalCost).toBe(2760)
    // A row's tax follows the box. The row's own cost is the grid kernel's, worked out before this.
    expect(ten.rows[0]!.taxAmount).toBe(120)
    expect(ten.rows[0]!.cost).toBe(1899)
    expect(ten.breakdownRowOf(ten.rows[0]!).taxPercent).toBe(10)
  })

  it('the team labor clocked on this bid, and no other bid’s', () => {
    const d = derive({ teamLaborDataForBids: [{ bidId: 'bid-9', bidCost: 999 }, { bidId: 'bid-1', bidCost: 250 }] })
    expect(d.teamLaborCost).toBe(250)
    expect(derive({ teamLaborDataForBids: [{ bidId: 'bid-9', bidCost: 999 }] }).teamLaborCost).toBe(0)
    // With no bid picked nothing is looked up.
    expect(derive({ selectedBidForPricing: null, teamLaborDataForBids: [{ bidId: 'bid-1', bidCost: 250 }] }).teamLaborCost).toBe(0)
  })

  it('the assignments of the open price alone, each on its row', () => {
    const mine = { id: 'a1', bid_id: 'bid-1', count_row_id: 'cr-lav', price_book_version_id: PRICING_ID, price_book_entry_id: 'e1' }
    const other = { id: 'a2', bid_id: 'bid-1', count_row_id: 'cr-wc', price_book_version_id: 'price-alt', price_book_entry_id: 'e2' }
    const d = derive({ bidPricingAssignments: [mine, other] as unknown as DerivePricingWorkbenchInput['bidPricingAssignments'] })
    expect(d.assignmentsForVersion.map((a) => a.id)).toEqual(['a1'])
    expect(d.rows.map((r) => r.assignment?.id ?? null)).toEqual([null, 'a1', null])
  })

  it('the material of all three stages, and the miles on the bid', () => {
    const d = derive({ pricingMaterialTotalTopOut: 300, pricingMaterialTotalTrimSet: 100, selectedBidForPricing: { id: 'bid-1', distance_from_office: '30' } })
    expect(d.totalMaterials).toBe(2000)
    expect(d.taxCost).toBe(165)
    expect(d.distance).toBe(30)
    expect(d.totalCost).toBe(d.totalMaterials + d.taxCost + d.laborCost + d.drivingCost)
  })

  it('revenue with no takeoff cost is counted apart, as the strip’s warning reads it', () => {
    const d = derive({ pricingFixtureMaterialsFromTakeoff: { 'cr-wc': 1200 }, pricingRowsForGrid: scenarioPricingRows({ scenarioId: PRICING_ID, countRows: COUNT_ROWS, entries: [], assignments: [], customPrices: CUSTOM_PRICES, hides: [], costs: { laborRows: LABOR_ROWS, totalMaterials: 1600, laborRate: 50, taxPercent: 8.25, materialsFromTakeoffByCountRowId: { 'cr-wc': 1200 }, materialsOverrideUnitByCountRowId: new Map<string, number>() } } as unknown as Parameters<typeof scenarioPricingRows>[0]) })
    expect(d.uncostedRevenueRows.map((r) => r.countRow.id)).toEqual(['cr-lav'])
    expect(d.uncostedRevenue).toBe(2000)
  })
})
