import { describe, expect, it } from 'vitest'
import { buildPricingPrintRows, pricingDocShell, type PricingPrintRowsInput } from './pricingPage'

const base: PricingPrintRowsInput = {
  materialTotalRoughIn: 100,
  materialTotalTopOut: 0,
  materialTotalTrimSet: 0,
  laborRate: 50,
  laborRows: [
    {
      fixture: 'Toilet',
      count: 2,
      rough_in_hrs_per_unit: 1,
      top_out_hrs_per_unit: 0.5,
      trim_set_hrs_per_unit: 0.5,
      is_fixed: false,
    },
  ],
  distanceFromOffice: '10',
  costEstimate: {
    driving_cost_rate: 0.7,
    hours_per_trip: 2,
    estimator_cost_flat_amount: 500,
    travel_meals_rate: 50,
    travel_hotel_rate: 100,
  },
  countRowsLength: 1,
  countRows: [{ id: 'c1', fixture: 'Toilet', count: 2 }],
  assignments: [
    {
      count_row_id: 'c1',
      price_book_entry_id: 'e1',
      is_fixed_price: false,
      unit_price_override: null,
    },
  ],
  entries: [{ id: 'e1', total_price: 100, fixture_types: { name: 'Toilet Assembly' } }],
  customUnitPriceByCountRowId: new Map(),
  materialsFromTakeoffByCountRowId: {},
  hiddenSubmissionCountRowIds: new Set(),
  taxPercent: 8.25,
}

describe('buildPricingPrintRows', () => {
  it('computes totalCost from materials + labor + driving + estimator + travel', () => {
    const { totalCost } = buildPricingPrintRows(base)
    // materials 100 + labor (4hrs * 50) 200 + driving ((4/2)*0.7*10) 14 + estimator 500 + travel 150
    expect(totalCost).toBeCloseTo(964, 6)
  })

  it('falls back to per-count estimator and default driving rates when fields are absent', () => {
    const { totalCost } = buildPricingPrintRows({
      ...base,
      costEstimate: {},
    })
    // materials 100 + labor 200 + driving ((4/2)*0.7*10) 14 + estimator (1 * 10) 10 + travel 0
    expect(totalCost).toBeCloseTo(324, 6)
  })

  it('maps computed rows into BidPricingPrintRow shape', () => {
    const { printRows, totalRevenue } = buildPricingPrintRows(base)
    expect(totalRevenue).toBeCloseTo(200, 6)
    expect(printRows).toHaveLength(1)
    expect(printRows[0]).toEqual({
      fixture: 'Toilet',
      count: 2,
      priceBookEntryName: 'Toilet Assembly',
      unitPrice: 100,
      isFixedPrice: false,
      cost: 300,
      revenue: 200,
      marginPct: -50,
      pctOfGrandTotal: 100,
    })
  })

  it('honors the assignment fixed-price flag', () => {
    const { printRows, totalRevenue } = buildPricingPrintRows({
      ...base,
      assignments: [
        {
          count_row_id: 'c1',
          price_book_entry_id: 'e1',
          is_fixed_price: true,
          unit_price_override: null,
        },
      ],
    })
    expect(printRows[0]!.isFixedPrice).toBe(true)
    // fixed price: revenue is the unit price, not count * unit price
    expect(printRows[0]!.revenue).toBeCloseTo(100, 6)
    expect(totalRevenue).toBeCloseTo(100, 6)
  })

  it('leaves priceBookEntryName null when no entry resolves', () => {
    const { printRows } = buildPricingPrintRows({
      ...base,
      assignments: [],
      entries: [],
    })
    expect(printRows[0]!.priceBookEntryName).toBeNull()
  })
})

describe('pricingDocShell', () => {
  it('escapes the title exactly once in <title> and <h1>', () => {
    const html = pricingDocShell('A & B', '<p>hi</p>')
    expect(html).toContain('<title>A &amp; B</title>')
    expect(html).toContain('<h1>A &amp; B</h1>')
    expect(html.split('A &amp; B')).toHaveLength(3) // exactly two occurrences
    expect(html).not.toContain('A &amp;amp; B')
    expect(html).toContain('<p>hi</p>')
  })

  it('omits the price-book-page rule by default and keeps @media print', () => {
    const html = pricingDocShell('T', 'B')
    expect(html).not.toContain('.price-book-page')
    expect(html).toContain('@media print { body { margin: 0.5in; } }')
  })

  it('inserts extraStyle immediately before the @media print rule', () => {
    const html = pricingDocShell('T', 'B', '  .price-book-page { margin-top: 1rem; }\n')
    expect(html).toContain(
      '  th { background: #f5f5f5; }\n  .price-book-page { margin-top: 1rem; }\n  @media print',
    )
  })
})
