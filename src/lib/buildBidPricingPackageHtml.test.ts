import { describe, expect, it } from 'vitest'
import {
  buildBidPricingPackageEmailHtml,
  buildBidPricingPackageExternalRows,
  buildBidPricingPackagePlainText,
  buildBidPricingPackageTableHtml,
  escapeHtml,
  formatPackageCurrency,
  packageRowRevenueTotalCents,
  type PackageExternalRow,
  type PackageRowInput,
} from './buildBidPricingPackageHtml'

const row = (overrides: Partial<PackageRowInput> = {}): PackageRowInput => ({
  fixture: 'Toilet',
  count: 2,
  unitPrice: 100,
  revenue: 200,
  omitFromSubmissionDocuments: false,
  ...overrides,
})

const ext = (overrides: Partial<PackageExternalRow> = {}): PackageExternalRow => ({
  fixture: 'Toilet',
  count: 2,
  unitPrice: 100,
  revenue: 200,
  ...overrides,
})

describe('buildBidPricingPackageExternalRows', () => {
  it('drops omitted rows', () => {
    const out = buildBidPricingPackageExternalRows([
      row(),
      row({ fixture: 'Sink', omitFromSubmissionDocuments: true }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]!.fixture).toBe('Toilet')
  })

  it('drops zero-count rows', () => {
    const out = buildBidPricingPackageExternalRows([row({ count: 0 })])
    expect(out).toHaveLength(0)
  })

  it('drops negative or non-finite counts', () => {
    const out = buildBidPricingPackageExternalRows([
      row({ count: -1 }),
      row({ count: Number.NaN }),
    ])
    expect(out).toHaveLength(0)
  })

  it('preserves order', () => {
    const out = buildBidPricingPackageExternalRows([
      row({ fixture: 'B' }),
      row({ fixture: 'A' }),
      row({ fixture: 'C' }),
    ])
    expect(out.map((r) => r.fixture)).toEqual(['B', 'A', 'C'])
  })
})

describe('escapeHtml', () => {
  it('escapes the five HTML-sensitive chars', () => {
    expect(escapeHtml(`<"&'>`)).toBe('&lt;&quot;&amp;&#39;&gt;')
  })

  it('passes through null-ish safely', () => {
    expect(escapeHtml(undefined as unknown as string)).toBe('')
    expect(escapeHtml(null as unknown as string)).toBe('')
  })
})

describe('formatPackageCurrency', () => {
  it('always renders two decimals', () => {
    expect(formatPackageCurrency(1)).toBe('1.00')
    expect(formatPackageCurrency(1.5)).toBe('1.50')
    expect(formatPackageCurrency(1234.567)).toBe('1,234.57')
  })

  it('handles non-finite numbers', () => {
    expect(formatPackageCurrency(Number.NaN)).toBe('0.00')
    expect(formatPackageCurrency(Number.POSITIVE_INFINITY)).toBe('0.00')
  })
})

describe('buildBidPricingPackageTableHtml', () => {
  it('renders 4 columns and one footer row', () => {
    const html = buildBidPricingPackageTableHtml({
      externalRows: [ext()],
      totalRevenue: 200,
    })
    expect(html).toContain('Fixture or Tie-in')
    expect(html).toContain('Count')
    expect(html).toContain('Sale Price')
    expect(html).toContain('Revenue')
    expect(html).toContain('$200.00')
    expect(html).toContain('Total')
    expect(html).not.toContain('Margin')
    expect(html).not.toContain('Our cost')
    expect(html).not.toContain('Price book entry')
  })

  it('escapes HTML in fixture names', () => {
    const html = buildBidPricingPackageTableHtml({
      externalRows: [ext({ fixture: '<Tub & Shower>' })],
      totalRevenue: 200,
    })
    expect(html).toContain('&lt;Tub &amp; Shower&gt;')
    expect(html).not.toContain('<Tub & Shower>')
  })

  it('inlines styles only (no <style> blocks)', () => {
    const html = buildBidPricingPackageTableHtml({
      externalRows: [ext()],
      totalRevenue: 200,
    })
    expect(html).not.toContain('<style')
  })

  it('uses totalRevenue arg for footer, not sum of external rows', () => {
    const html = buildBidPricingPackageTableHtml({
      externalRows: [ext({ revenue: 100 })],
      totalRevenue: 999.5,
    })
    expect(html).toContain('$999.50')
  })
})

describe('buildBidPricingPackageEmailHtml', () => {
  it('omits plans block when plansLink is null', () => {
    const html = buildBidPricingPackageEmailHtml({
      bidLabel: 'BE249 Project X',
      plansLink: null,
      tableHtml: '<table></table>',
      senderName: 'Robert',
    })
    expect(html).not.toContain('Open plans')
    expect(html).not.toContain('Job plans')
    expect(html).toContain('Sent by Robert')
    expect(html).toContain('Bid: BE249 Project X')
    expect(html).not.toContain('Price book')
    expect(html).not.toContain('Pricing</h1>')
  })

  it('renders plans link as Open plans anchor', () => {
    const html = buildBidPricingPackageEmailHtml({
      bidLabel: 'BE249 Project X',
      plansLink: 'https://example.com/plans?a=b&c=d',
      tableHtml: '<table></table>',
      senderName: null,
    })
    expect(html).toContain('href="https://example.com/plans?a=b&amp;c=d"')
    expect(html).toContain('Open plans')
    expect(html).not.toContain('Sent by')
  })

  it('escapes the bid label in the heading', () => {
    const html = buildBidPricingPackageEmailHtml({
      bidLabel: '<bad>',
      plansLink: null,
      tableHtml: '',
      senderName: null,
    })
    expect(html).toContain('Bid: &lt;bad&gt;')
  })
})

describe('buildBidPricingPackagePlainText', () => {
  it('aligns columns and includes plans link when present', () => {
    const text = buildBidPricingPackagePlainText({
      externalRows: [ext({ fixture: 'Toilet', count: 2, unitPrice: 100, revenue: 200 })],
      totalRevenue: 200,
      bidLabel: 'BE249 Project X',
      plansLink: 'https://example.com/plans',
    })
    expect(text).toContain('Bid: BE249 Project X')
    expect(text).not.toContain('Price book')
    expect(text).not.toContain('— Pricing')
    expect(text).toContain('Job plans: https://example.com/plans')
    expect(text).toContain('Fixture or Tie-in')
    expect(text).toContain('Toilet')
    expect(text).toContain('$100.00')
    expect(text).toContain('Total')
    expect(text).toContain('$200.00')
  })

  it('omits Job plans line when plansLink is null', () => {
    const text = buildBidPricingPackagePlainText({
      externalRows: [ext()],
      totalRevenue: 200,
      bidLabel: 'BE1',
      plansLink: null,
    })
    expect(text).not.toContain('Job plans')
  })

  it('separates body cells with " \u2022 " and keeps header/total cells separated by spaces', () => {
    const text = buildBidPricingPackagePlainText({
      externalRows: [ext({ fixture: 'Med Gas', count: 1, unitPrice: 42287.71, revenue: 42287.71 })],
      totalRevenue: 42287.71,
      bidLabel: 'BE249 Project X',
      plansLink: null,
    })
    const lines = text.split('\n')
    const bodyLine = lines.find((l) => l.includes('Med Gas'))
    expect(bodyLine).toBeDefined()
    expect(bodyLine!).toContain(' \u2022 ')
    expect(bodyLine!.match(/\u2022/g)!.length).toBe(3)

    const headerLine = lines.find((l) => l.includes('Fixture or Tie-in'))
    expect(headerLine).toBeDefined()
    expect(headerLine!).not.toContain('\u2022')

    const totalLine = lines.find((l) => l.startsWith('Total'))
    expect(totalLine).toBeDefined()
    expect(totalLine!).not.toContain('\u2022')
  })

  it('pads to the widest fixture name', () => {
    const text = buildBidPricingPackagePlainText({
      externalRows: [
        ext({ fixture: 'A' }),
        ext({ fixture: 'A very long fixture name here' }),
      ],
      totalRevenue: 400,
      bidLabel: 'BE1',
      plansLink: null,
    })
    const lines = text.split('\n')
    const dataLines = lines.filter((l) => l.includes('$'))
    expect(dataLines.length).toBeGreaterThanOrEqual(2)
    expect(dataLines[0]!.length).toBe(dataLines[1]!.length)
  })
})

describe('packageRowRevenueTotalCents', () => {
  it('sums and rounds to cents', () => {
    expect(
      packageRowRevenueTotalCents([
        ext({ revenue: 1.25 }),
        ext({ revenue: 2.5 }),
      ]),
    ).toBe(375)
  })

  it('rounds half-up at the cent boundary', () => {
    expect(packageRowRevenueTotalCents([ext({ revenue: 0.015 })])).toBe(2)
  })

  it('skips non-finite revenue', () => {
    expect(
      packageRowRevenueTotalCents([
        ext({ revenue: Number.NaN }),
        ext({ revenue: 1 }),
      ]),
    ).toBe(100)
  })
})
