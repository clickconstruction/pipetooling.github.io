import { describe, expect, it } from 'vitest'
import { decoratePricingRows } from './decoratePricingRows'
import type { ComputedBidPricingRow } from '../bidPricingRowCalculations'
import type { BidCountRowCustomPrice, BidPricingAssignment, CostEstimateLaborRow } from './bidPricingEngineTypes'

const calc = (id: string, fixture: string, o: Partial<ComputedBidPricingRow> = {}) =>
  ({
    countRow: { id, fixture },
    entry: undefined,
    count: 2,
    cost: 100,
    unitPrice: 150,
    isFixedPrice: false,
    revenue: 300,
    marginPct: 66.7,
    materialsBeforeTax: 80,
    materialsWithTax: 86.6,
    laborCost: 20,
    pctOfGrandTotal: 50,
    omitFromSubmissionDocuments: false,
    ...o,
  }) as unknown as ComputedBidPricingRow

describe('decoratePricingRows', () => {
  it('joins the labor row by fixture (case-insensitive), the custom price and assignment for the active pricing only, the takeoff materials and the tax', () => {
    const out = decoratePricingRows({
      rows: [calc('r1', 'Toilet'), calc('r2', 'Shower')],
      laborRows: [{ fixture: 'toilet', rough_in_hours: 1 } as unknown as CostEstimateLaborRow],
      customPrices: [
        { count_row_id: 'r1', price_book_version_id: 'v1', unit_price: 199 } as unknown as BidCountRowCustomPrice,
        { count_row_id: 'r2', price_book_version_id: 'v2', unit_price: 5 } as unknown as BidCountRowCustomPrice,
      ],
      assignmentsForVersion: [{ count_row_id: 'r2', price_book_entry_id: 'e1' } as unknown as BidPricingAssignment],
      materialsFromTakeoffByCountRowId: { r1: 80 },
      taxPercent: 8.25,
      versionId: 'v1',
      canToggleOmitSubmission: true,
    })
    const [r1, r2] = out.rows
    expect(r1!.laborRow).toBeTruthy()
    expect(r1!.customPrice).toBe(199)
    expect(r1!.assignment).toBeUndefined()
    expect(r1!.materialsFromTakeoff).toBe(80)
    expect(r1!.taxAmount).toBeCloseTo(6.6)
    expect(r1!.flag).toBe('green')
    expect(r1!.canToggleOmitSubmission).toBe(true)
    expect(r2!.laborRow).toBeUndefined()
    expect(r2!.customPrice).toBeNull()
    expect(r2!.assignment?.price_book_entry_id).toBe('e1')
    expect(r2!.materialsFromTakeoff).toBeNull()
    expect(r2!.taxAmount).toBe(0)
  })

  it('buckets the rows with revenue but no takeoff cost as uncosted, and sums them', () => {
    const out = decoratePricingRows({
      rows: [calc('r1', 'A', { revenue: 300 }), calc('r2', 'B', { revenue: 500 }), calc('r3', 'C', { revenue: 0 })],
      laborRows: [],
      customPrices: [],
      assignmentsForVersion: [],
      materialsFromTakeoffByCountRowId: { r1: 80, r2: 0 },
      taxPercent: 8.25,
      versionId: 'v1',
      canToggleOmitSubmission: false,
    })
    expect(out.uncostedRevenueRows.map((r) => r.countRow.id)).toEqual(['r2'])
    expect(out.uncostedRevenue).toBe(500)
  })
})
