import { describe, expect, it } from 'vitest'
import { buildBidPricingPackageSmsText } from './buildBidPricingPackageSmsText'
import type { PackageExternalRow } from './buildBidPricingPackageHtml'

function row(p: Partial<PackageExternalRow> = {}): PackageExternalRow {
  return {
    fixture: p.fixture ?? 'Toilet',
    count: p.count ?? 1,
    unitPrice: p.unitPrice ?? 100,
    revenue: p.revenue ?? 100,
  }
}

describe('buildBidPricingPackageSmsText', () => {
  it('puts the Bid heading on the first line', () => {
    const text = buildBidPricingPackageSmsText({
      bidLabel: 'BP183 SVP LIVPRI Med Gas',
      plansLink: null,
      externalRows: [row()],
      totalRevenue: 100,
    })
    expect(text.split('\n')[0]).toBe('Bid: BP183 SVP LIVPRI Med Gas')
  })

  it('includes the Job plans line when plansLink is set', () => {
    const text = buildBidPricingPackageSmsText({
      bidLabel: 'BE1',
      plansLink: 'https://example.com/plans?a=b&c=d',
      externalRows: [row()],
      totalRevenue: 100,
    })
    const lines = text.split('\n')
    expect(lines[0]).toBe('Bid: BE1')
    expect(lines[1]).toBe('Job plans: https://example.com/plans?a=b&c=d')
    // Blank line separates header from body (header = lines 0–1, blank = line 2).
    expect(lines[2]).toBe('')
  })

  it('omits the Job plans line (and its blank separator) when plansLink is null / blank', () => {
    for (const link of [null, '', '   ']) {
      const text = buildBidPricingPackageSmsText({
        bidLabel: 'BE1',
        plansLink: link,
        externalRows: [row()],
        totalRevenue: 100,
      })
      expect(text).not.toContain('Job plans:')
      const lines = text.split('\n')
      // Header is just line 0 (Bid:), then blank separator (line 1), then body row (line 2).
      expect(lines[0]).toBe('Bid: BE1')
      expect(lines[1]).toBe('')
      expect(lines[2]).toContain('\u00d7')
    }
  })

  it('formats per-row lines as "fixture — count × $unit = $revenue"', () => {
    const text = buildBidPricingPackageSmsText({
      bidLabel: 'BE1',
      plansLink: null,
      externalRows: [
        row({ fixture: 'Med Gas', count: 1, unitPrice: 42287.71, revenue: 42287.71 }),
        row({ fixture: 'Tank fitting', count: 4, unitPrice: 250, revenue: 1000 }),
      ],
      totalRevenue: 43287.71,
    })
    expect(text).toContain('Med Gas \u2014 1 \u00d7 $42,287.71 = $42,287.71')
    expect(text).toContain('Tank fitting \u2014 4 \u00d7 $250.00 = $1,000.00')
  })

  it('renders Total: line after a blank separator below the last body row', () => {
    const text = buildBidPricingPackageSmsText({
      bidLabel: 'BE1',
      plansLink: null,
      externalRows: [row({ fixture: 'A', count: 2, unitPrice: 50, revenue: 100 })],
      totalRevenue: 100,
    })
    const lines = text.split('\n')
    const totalIdx = lines.findIndex((l) => l.startsWith('Total: '))
    expect(totalIdx).toBeGreaterThan(0)
    expect(lines[totalIdx - 1]).toBe('')
    expect(lines[totalIdx]).toBe('Total: $100.00')
  })

  it('omits the body + Total entirely when externalRows is empty', () => {
    const text = buildBidPricingPackageSmsText({
      bidLabel: 'BE1',
      plansLink: 'https://example.com/p',
      externalRows: [],
      totalRevenue: 0,
    })
    expect(text).toBe('Bid: BE1\nJob plans: https://example.com/p')
    expect(text).not.toContain('Total')
    expect(text).not.toContain('\u00d7')
  })

  it('preserves cents in currency (no rounding to dollars)', () => {
    const text = buildBidPricingPackageSmsText({
      bidLabel: 'BE1',
      plansLink: null,
      externalRows: [row({ fixture: 'X', count: 1, unitPrice: 0.05, revenue: 0.05 })],
      totalRevenue: 0.05,
    })
    expect(text).toContain('$0.05')
    expect(text).toContain('Total: $0.05')
  })

  it('does NOT HTML-escape special characters (plain text for SMS)', () => {
    const text = buildBidPricingPackageSmsText({
      bidLabel: 'BE1 "A&B" <test>',
      plansLink: null,
      externalRows: [row({ fixture: 'C&D' })],
      totalRevenue: 100,
    })
    expect(text).toContain('Bid: BE1 "A&B" <test>')
    expect(text).toContain('C&D')
    expect(text).not.toContain('&amp;')
    expect(text).not.toContain('&lt;')
    expect(text).not.toContain('&quot;')
  })

  it('falls back to em-dash for blank fixture names', () => {
    const text = buildBidPricingPackageSmsText({
      bidLabel: 'BE1',
      plansLink: null,
      externalRows: [row({ fixture: '   ', count: 1, unitPrice: 10, revenue: 10 })],
      totalRevenue: 10,
    })
    expect(text).toContain('\u2014 \u2014 1 \u00d7 $10.00 = $10.00')
  })

  it('includes the CountTooling Plans line after Job plans when set', () => {
    const text = buildBidPricingPackageSmsText({
      bidLabel: 'BE1',
      plansLink: 'https://example.com/plans',
      countToolingPlansLink: 'https://counttooling.com/?t=abc',
      externalRows: [row()],
      totalRevenue: 100,
    })
    const lines = text.split('\n')
    expect(lines[0]).toBe('Bid: BE1')
    expect(lines[1]).toBe('Job plans: https://example.com/plans')
    expect(lines[2]).toBe('CountTooling Plans: https://counttooling.com/?t=abc')
  })
})
