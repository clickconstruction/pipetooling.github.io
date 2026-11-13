import { describe, expect, it } from 'vitest'
import { buildBidPricingPackageSmsText } from './buildBidPricingPackageSmsText'
import type { PackageExternalRow } from './buildBidPricingPackageHtml'

function row(p: Partial<PackageExternalRow> = {}): PackageExternalRow {
  return {
    fixture: p.fixture ?? 'Toilet',
    count: p.count ?? 1,
    unitPrice: p.unitPrice ?? 100,
    revenue: p.revenue ?? 100,
    isFixedPrice: p.isFixedPrice,
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
    expect(text).toContain('Med Gas \u2014 1 \u00d7 $42,288 = $42,288')
    expect(text).toContain('Tank fitting \u2014 4 \u00d7 $250 = $1,000')
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
    expect(lines[totalIdx]).toBe('Total: $100')
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
    expect(text).toContain('\u2014 \u2014 1 \u00d7 $10 = $10')
  })

  it('includes Address + Map lines right after the Bid heading when address is set', () => {
    const text = buildBidPricingPackageSmsText({
      bidLabel: 'BE1',
      plansLink: 'https://example.com/plans',
      address: '1234 Casa Linda Dr, Dallas, TX',
      externalRows: [row()],
      totalRevenue: 100,
    })
    const lines = text.split('\n')
    expect(lines[0]).toBe('Bid: BE1')
    expect(lines[1]).toBe('Address: 1234 Casa Linda Dr, Dallas, TX')
    expect(lines[2]).toBe(
      'Map: https://www.google.com/maps/search/?api=1&query=1234%20Casa%20Linda%20Dr%2C%20Dallas%2C%20TX',
    )
    expect(lines[3]).toBe('Job plans: https://example.com/plans')
  })

  it('omits the Address + Map lines when address is null / blank', () => {
    for (const address of [null, undefined, '', '   ']) {
      const text = buildBidPricingPackageSmsText({
        bidLabel: 'BE1',
        plansLink: null,
        address,
        externalRows: [row()],
        totalRevenue: 100,
      })
      expect(text).not.toContain('Address:')
      expect(text).not.toContain('Map:')
    }
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

describe('Send both (v2.3685)', () => {
  it('with sections: a heading line, the rows and a Total per price, ★ first', () => {
    const text = buildBidPricingPackageSmsText({
      bidLabel: 'BP385 Gallenby Park',
      plansLink: null,
      externalRows: [row()],
      totalRevenue: 100,
      sections: [
        { name: 'Value Engineered', starred: true, externalRows: [row()], totalRevenue: 100 },
        { name: 'Written to Plan', externalRows: [row({ fixture: 'Sink', unitPrice: 50, revenue: 50 })], totalRevenue: 50 },
      ],
    })
    expect(text.split('\n')).toEqual([
      'Bid: BP385 Gallenby Park',
      '',
      '★ Value Engineered — customer\'s price',
      'Toilet — 1 × $100 = $100',
      '',
      'Total: $100',
      '',
      'Written to Plan — second price',
      'Sink — 1 × $50 = $50',
      '',
      'Total: $50',
    ])
  })
})

describe('whole dollars (v2.7045)', () => {
  const body = (rows: PackageExternalRow[], totalRevenue: number): string[] =>
    buildBidPricingPackageSmsText({ bidLabel: 'BE1', plansLink: null, externalRows: rows, totalRevenue })
      .split('\n')
      .slice(2)

  it('shows no cents on a bid of round prices: unit price, line total and Total', () => {
    const lines = body(
      [
        row({ fixture: 'LAV-A', count: 3, unitPrice: 2900, revenue: 8700 }),
        row({ fixture: 'Heater', count: 1, unitPrice: 6400, revenue: 6400 }),
      ],
      15100,
    )
    expect(lines).toEqual(['LAV-A — 3 × $2,900 = $8,700', 'Heater — 1 × $6,400 = $6,400', '', 'Total: $15,100'])
    expect(lines.join('\n')).not.toMatch(/\.\d\d\b/)
  })

  it('leaves a count that is not whole exactly as it is, and rounds the line total from the true amount', () => {
    // 61.37 ft × $24 = $1,472.88, which is $1,473 (not 61 × 24, not 61.37 rounded).
    expect(body([row({ fixture: 'ft of pipe', count: 61.37, unitPrice: 24, revenue: 1472.88 })], 1472.88)[0]).toBe(
      'ft of pipe — 61.37 × $24 = $1,473',
    )
  })

  it('rounds an amount ending in .50 or more up', () => {
    const lines = body([row({ fixture: 'Tie-ins', count: 1, unitPrice: 6412.5, revenue: 6412.5 })], 6412.5)
    expect(lines[0]).toBe('Tie-ins — 1 × $6,413 = $6,413')
    expect(lines[lines.length - 1]).toBe('Total: $6,413')
  })

  it('rounds a float that is a hair under the half dollar as the half dollar it is', () => {
    // 0.7 × 15 is 10.499999999999998 in floating point; the true amount is $10.50.
    expect(body([row({ fixture: 'Stub', count: 0.7, unitPrice: 15, revenue: 0.7 * 15 })], 0.7 * 15)[0]).toBe(
      'Stub — 0.7 × $15 = $11',
    )
  })

  it('drops the cents from a unit price when the line still adds up without them', () => {
    expect(body([row({ fixture: 'Valve', count: 3, unitPrice: 100.1, revenue: 300.3 })], 300.3)[0]).toBe(
      'Valve — 3 × $100 = $300',
    )
  })

  it('keeps the cents on a unit price when the whole-dollar price would not add up to the line', () => {
    // $12.50 a foot shown as $13 would read 180.4 × $13 = $2,255, which is wrong by $90.
    expect(body([row({ fixture: 'ft of copper', count: 180.4, unitPrice: 12.5, revenue: 2255 })], 2255)[0]).toBe(
      'ft of copper — 180.4 × $12.50 = $2,255',
    )
    // 2 × $450 = $900, but the line is $900.50 and shows $901.
    expect(body([row({ fixture: 'Sink', count: 2, unitPrice: 450.25, revenue: 900.5 })], 900.5)[0]).toBe(
      'Sink — 2 × $450.25 = $901',
    )
  })

  it('reads a fixed price in whole dollars: one figure for the line, rounded like any line total', () => {
    expect(
      body([row({ fixture: 'Mobilize', count: 3, unitPrice: 5000.5, revenue: 5000.5, isFixedPrice: true })], 5000.5)[0],
    ).toBe('Mobilize — 3, fixed price $5,001')
  })

  it('shows the true total rounded, not the rounded lines added up', () => {
    const lines = body(
      [
        row({ fixture: 'A', count: 1, unitPrice: 100.4, revenue: 100.4 }),
        row({ fixture: 'B', count: 1, unitPrice: 200.4, revenue: 200.4 }),
        row({ fixture: 'C', count: 1, unitPrice: 300.4, revenue: 300.4 }),
      ],
      601.2,
    )
    // The lines read $100 + $200 + $300 = $600; the bid is $601.20.
    expect(lines).toEqual(['A — 1 × $100 = $100', 'B — 1 × $200 = $200', 'C — 1 × $300 = $300', '', 'Total: $601'])
  })

  it('keeps the cents on an amount under 50 cents so it never reads $0', () => {
    const lines = body([row({ fixture: 'X', count: 1, unitPrice: 0.05, revenue: 0.05 })], 0.05)
    expect(lines[0]).toBe('X — 1 × $0.05 = $0.05')
    expect(lines[lines.length - 1]).toBe('Total: $0.05')
  })

  it('reads a true zero and a number that is not finite as $0', () => {
    const lines = body([row({ fixture: 'Y', count: 2, unitPrice: 0, revenue: Number.NaN })], 0)
    expect(lines[0]).toBe('Y — 2 × $0 = $0')
    expect(lines[lines.length - 1]).toBe('Total: $0')
  })
})

describe('a fixed price reads as one price for the line (v2.7136)', () => {
  const body = (rows: PackageExternalRow[], totalRevenue: number): string[] =>
    buildBidPricingPackageSmsText({ bidLabel: 'BE1', plansLink: null, externalRows: rows, totalRevenue })
      .split('\n')
      .slice(2)

  it('a count over 1 shows the count and the fixed price, with no × and no =', () => {
    const [line] = body([row({ fixture: 'Mobilize', count: 3, unitPrice: 5000, revenue: 5000, isFixedPrice: true })], 5000)
    expect(line).toBe('Mobilize — 3, fixed price $5,000')
    expect(line).not.toContain('×')
    expect(line).not.toContain('=')
  })

  it('a count of 1 reads the same way: the flag decides, not the count', () => {
    expect(body([row({ fixture: 'Permit', count: 1, unitPrice: 750, revenue: 750, isFixedPrice: true })], 750)[0]).toBe(
      'Permit — 1, fixed price $750',
    )
  })

  it('a count that is not whole shows exactly as stored', () => {
    expect(
      body([row({ fixture: 'Trench', count: 74.29, unitPrice: 2400, revenue: 2400, isFixedPrice: true })], 2400)[0],
    ).toBe('Trench — 74.29, fixed price $2,400')
  })

  it('a fixed price with cents rounds to the dollar like any line total; under 50 cents keeps them', () => {
    expect(
      body([row({ fixture: 'Flush', count: 2, unitPrice: 1249.49, revenue: 1249.49, isFixedPrice: true })], 1249.49)[0],
    ).toBe('Flush — 2, fixed price $1,249')
    expect(
      body([row({ fixture: 'Hauling', count: 4, unitPrice: 812.5, revenue: 812.5, isFixedPrice: true })], 812.5)[0],
    ).toBe('Hauling — 4, fixed price $813')
    expect(body([row({ fixture: 'Tag', count: 2, unitPrice: 0.25, revenue: 0.25, isFixedPrice: true })], 0.25)[0]).toBe(
      'Tag — 2, fixed price $0.25',
    )
  })

  it('a plain row with a count of 1 still reads 1 × $x = $x', () => {
    expect(body([row({ fixture: 'Heater', count: 1, unitPrice: 6400, revenue: 6400 })], 6400)[0]).toBe(
      'Heater — 1 × $6,400 = $6,400',
    )
    expect(
      body([row({ fixture: 'Med Gas', count: 1, unitPrice: 4287.71, revenue: 4287.71, isFixedPrice: false })], 4287.71)[0],
    ).toBe('Med Gas — 1 × $4,288 = $4,288')
  })

  it('changes no line total and not the Total: only the words of a fixed line', () => {
    const rows = [
      row({ fixture: 'LAV-A', count: 3, unitPrice: 2900, revenue: 8700 }),
      row({ fixture: 'Mobilize', count: 3, unitPrice: 5000.5, revenue: 5000.5, isFixedPrice: true }),
      row({ fixture: 'Permit', count: 1, unitPrice: 750.4, revenue: 750.4, isFixedPrice: true }),
    ]
    const total = 8700 + 5000.5 + 750.4
    const lines = body(rows, total)
    expect(lines).toEqual([
      'LAV-A — 3 × $2,900 = $8,700',
      'Mobilize — 3, fixed price $5,001',
      'Permit — 1, fixed price $750',
      '',
      'Total: $14,451',
    ])
    // The same rows read as plain rows end each line on the same figure, and the Total is the same.
    const lastFigure = (l: string) => /\$[\d,.]+$/.exec(l)?.[0] ?? l
    const asPlain = body(rows.map((r) => ({ ...r, isFixedPrice: false })), total)
    expect(lines.map(lastFigure)).toEqual(asPlain.map(lastFigure))
  })

  it('a fixed row in either price of Send both reads the same way', () => {
    const text = buildBidPricingPackageSmsText({
      bidLabel: 'BE1',
      plansLink: null,
      externalRows: [],
      totalRevenue: 0,
      sections: [
        { name: 'Base', starred: true, externalRows: [row({ fixture: 'Mobilize', count: 3, unitPrice: 5000, revenue: 5000, isFixedPrice: true })], totalRevenue: 5000 },
        { name: 'Alternate', externalRows: [row({ fixture: 'Mobilize', count: 2, unitPrice: 3500, revenue: 3500, isFixedPrice: true })], totalRevenue: 3500 },
      ],
    })
    expect(text).toContain('Mobilize — 3, fixed price $5,000')
    expect(text).toContain('Mobilize — 2, fixed price $3,500')
    expect(text.split('\n').filter((l) => l.startsWith('Total:'))).toEqual(['Total: $5,000', 'Total: $3,500'])
  })

  it('a plain row no longer passes for fixed: its price keeps the cents the sum needs', () => {
    // 2 × $0.60 is $1.20, which shows $1. The old guess took a price that rounds to its line
    // total for a fixed one and printed 2 × $1 = $1.
    expect(body([row({ fixture: 'Washer', count: 2, unitPrice: 0.6, revenue: 1.2 })], 1.2)[0]).toBe(
      'Washer — 2 × $0.60 = $1',
    )
  })
})
