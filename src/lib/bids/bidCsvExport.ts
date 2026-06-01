import type { BidCountRow } from '../../types/bids'

export function csvEscapeField(value: string): string {
  const s = value ?? ''
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function sanitizeCsvFilenamePart(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

/** Builds the counts CSV body (no BOM). Caller prepends `\uFEFF` for Excel. */
export function buildCountsCsv(rows: BidCountRow[]): string {
  const headerLabels = ['Count', 'Fixture or Tie-in', 'Group/Tag', 'Plan Page']
  const lines = [headerLabels.map((h) => csvEscapeField(h)).join(',')]
  for (const row of rows) {
    lines.push(
      [
        String(row.count),
        csvEscapeField(row.fixture),
        csvEscapeField(row.group_tag ?? ''),
        csvEscapeField(row.page ?? ''),
      ].join(','),
    )
  }
  return lines.join('\n')
}

export type PricingCsvRow = {
  fixture: string
  count: number
  priceBookEntry: string
  fixedPrice: boolean
  unitPrice: number
  ourCost: number
  revenue: number
  marginPct: number | null
  pctOfTotalDisplay: number | null
}

/** Builds the pricing CSV body (no BOM). Caller prepends `\uFEFF` for Excel. */
export function buildPricingCsv(
  rows: PricingCsvRow[],
  totals: { totalBidCost: number; totalRevenue: number },
): string {
  const headers = [
    'Fixture or Tie-in',
    'Count',
    'Price book entry',
    'Fixed price',
    'Sale Price',
    'Our cost',
    'Revenue',
    'Margin %',
    '% of bid revenue',
  ]
  const lines = [headers.map((h) => csvEscapeField(h)).join(',')]
  for (const r of rows) {
    const pctOf = r.pctOfTotalDisplay
    lines.push(
      [
        csvEscapeField(r.fixture),
        String(r.count),
        csvEscapeField(r.priceBookEntry),
        r.fixedPrice ? 'Yes' : 'No',
        r.unitPrice.toFixed(2),
        r.ourCost.toFixed(2),
        r.revenue.toFixed(2),
        r.marginPct != null ? r.marginPct.toFixed(1) : '',
        pctOf != null ? pctOf.toFixed(1) : '',
      ].join(','),
    )
  }
  const { totalBidCost, totalRevenue } = totals
  const overallMargin = totalRevenue > 0 ? ((totalRevenue - totalBidCost) / totalRevenue) * 100 : null
  lines.push(
    [
      csvEscapeField('TOTAL (bid)'),
      '',
      '',
      '',
      '',
      totalBidCost.toFixed(2),
      totalRevenue.toFixed(2),
      overallMargin != null ? overallMargin.toFixed(1) : '',
      totalRevenue > 0 ? '100.0' : '',
    ].join(','),
  )
  return lines.join('\n')
}
