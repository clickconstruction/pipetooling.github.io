import { describe, expect, it } from 'vitest'
import {
  buildBidPricingPrintTableHtml,
  type BidPricingPrintRow,
} from './buildBidPricingPrintTableHtml'

function row(p: Partial<BidPricingPrintRow> = {}): BidPricingPrintRow {
  return {
    fixture: p.fixture !== undefined ? p.fixture : 'Toilet',
    count: p.count ?? 1,
    priceBookEntryName: p.priceBookEntryName !== undefined ? p.priceBookEntryName : 'Toilet',
    unitPrice: p.unitPrice ?? 100,
    isFixedPrice: p.isFixedPrice ?? false,
    cost: p.cost ?? 60,
    revenue: p.revenue ?? 100,
    marginPct: p.marginPct !== undefined ? p.marginPct : 40,
    pctOfGrandTotal: p.pctOfGrandTotal !== undefined ? p.pctOfGrandTotal : 50,
  }
}

function thList(html: string): string[] {
  return Array.from(html.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)).map((m) => m[1] ?? '')
}

describe('buildBidPricingPrintTableHtml — cost view', () => {
  it('emits 7 <th> ending with Margin %', () => {
    const html = buildBidPricingPrintTableHtml({
      rows: [row()],
      totalCost: 60,
      totalRevenue: 100,
      viewModel: 'cost',
    })
    const headers = thList(html)
    expect(headers).toEqual([
      'Fixture or Tie-in',
      'Count',
      'Price book entry',
      'Unit price',
      'Our cost',
      'Revenue',
      'Margin %',
    ])
  })

  it('total row includes $totalCost and $totalRevenue', () => {
    const html = buildBidPricingPrintTableHtml({
      rows: [row({ count: 2, cost: 100, revenue: 200 })],
      totalCost: 100,
      totalRevenue: 200,
      viewModel: 'cost',
    })
    const totalMatch = html.match(/<tr style="background:#f9fafb[^"]*"[^>]*>([\s\S]*?)<\/tr>/)
    expect(totalMatch).toBeTruthy()
    const totalHtml = totalMatch?.[1] ?? ''
    expect(totalHtml).toContain('$100.00')
    expect(totalHtml).toContain('$200.00')
    expect(totalHtml).toContain('50.0%')
  })

  it('renders — for null marginPct', () => {
    const html = buildBidPricingPrintTableHtml({
      rows: [row({ marginPct: null })],
      totalCost: 0,
      totalRevenue: 0,
      viewModel: 'cost',
    })
    expect(html).toContain('\u2014')
  })
})

describe('buildBidPricingPrintTableHtml — price view', () => {
  it('emits 5 <th> ending with % of Total and drops cost-only columns', () => {
    const html = buildBidPricingPrintTableHtml({
      rows: [row()],
      totalCost: 60,
      totalRevenue: 100,
      viewModel: 'price',
    })
    const headers = thList(html)
    expect(headers).toEqual([
      'Fixture or Tie-in',
      'Count',
      'Unit price',
      'Revenue',
      '% of Total',
    ])
    expect(html).not.toContain('Price book entry')
    expect(html).not.toContain('Our cost')
    expect(html).not.toContain('Margin %')
  })

  it('renders pctOfGrandTotal as N.N% with one decimal', () => {
    const html = buildBidPricingPrintTableHtml({
      rows: [row({ pctOfGrandTotal: 12.345 })],
      totalCost: 0,
      totalRevenue: 100,
      viewModel: 'price',
    })
    expect(html).toContain('12.3%')
  })

  it('renders — for null pctOfGrandTotal', () => {
    const html = buildBidPricingPrintTableHtml({
      rows: [row({ pctOfGrandTotal: null })],
      totalCost: 0,
      totalRevenue: 0,
      viewModel: 'price',
    })
    expect(html).toContain('\u2014')
  })

  it('total row: $totalRevenue + 100.0% when revenue > 0', () => {
    const html = buildBidPricingPrintTableHtml({
      rows: [row({ revenue: 42287.71 })],
      totalCost: 0,
      totalRevenue: 42287.71,
      viewModel: 'price',
    })
    const totalMatch = html.match(/<tr style="background:#f9fafb[^"]*"[^>]*>([\s\S]*?)<\/tr>/)
    expect(totalMatch).toBeTruthy()
    const totalHtml = totalMatch?.[1] ?? ''
    expect(totalHtml).toContain('$42,287.71')
    expect(totalHtml).toContain('100.0%')
  })

  it('total row: — for % when totalRevenue is 0', () => {
    const html = buildBidPricingPrintTableHtml({
      rows: [row({ revenue: 0, pctOfGrandTotal: null })],
      totalCost: 0,
      totalRevenue: 0,
      viewModel: 'price',
    })
    const totalMatch = html.match(/<tr style="background:#f9fafb[^"]*"[^>]*>([\s\S]*?)<\/tr>/)
    expect(totalMatch).toBeTruthy()
    const totalHtml = totalMatch?.[1] ?? ''
    expect(totalHtml).toContain('$0.00')
    expect(totalHtml).toContain('\u2014')
    expect(totalHtml).not.toContain('100.0%')
  })
})

describe('buildBidPricingPrintTableHtml — shared', () => {
  it('preserves cents in currency formatting', () => {
    const html = buildBidPricingPrintTableHtml({
      rows: [row({ unitPrice: 42287.71, revenue: 42287.71 })],
      totalCost: 0,
      totalRevenue: 42287.71,
      viewModel: 'price',
    })
    expect(html).toContain('$42,287.71')
  })

  it('renders (fixed) hint in cost view when isFixedPrice', () => {
    const html = buildBidPricingPrintTableHtml({
      rows: [row({ isFixedPrice: true })],
      totalCost: 60,
      totalRevenue: 100,
      viewModel: 'cost',
    })
    expect(html).toContain('(fixed)')
  })

  it('renders (fixed) hint in price view when isFixedPrice', () => {
    const html = buildBidPricingPrintTableHtml({
      rows: [row({ isFixedPrice: true })],
      totalCost: 0,
      totalRevenue: 100,
      viewModel: 'price',
    })
    expect(html).toContain('(fixed)')
  })

  it('omits (fixed) hint when isFixedPrice is false', () => {
    const html = buildBidPricingPrintTableHtml({
      rows: [row({ isFixedPrice: false })],
      totalCost: 0,
      totalRevenue: 100,
      viewModel: 'price',
    })
    expect(html).not.toContain('(fixed)')
  })

  it('HTML-escapes fixture and priceBookEntryName', () => {
    const html = buildBidPricingPrintTableHtml({
      rows: [row({ fixture: '<bad>', priceBookEntryName: 'A&B' })],
      totalCost: 0,
      totalRevenue: 100,
      viewModel: 'cost',
    })
    expect(html).toContain('&lt;bad&gt;')
    expect(html).toContain('A&amp;B')
    expect(html).not.toContain('<bad>')
  })

  it('empty rows → only the total row, no body <tr> from rows', () => {
    for (const viewModel of ['cost', 'price'] as const) {
      const html = buildBidPricingPrintTableHtml({
        rows: [],
        totalCost: 0,
        totalRevenue: 0,
        viewModel,
      })
      // Two <tr> total: one in <thead>, one in <tbody> (the totals row).
      const trCount = (html.match(/<tr/g) ?? []).length
      expect(trCount).toBe(2)
    }
  })
})
