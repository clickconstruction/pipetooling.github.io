/**
 * Deno copy of the Pricing "Package and send" pure helpers.
 *
 * **Keep in sync** with `src/lib/buildBidPricingPackageHtml.ts` — the project's convention
 * (see `physicalInvoiceFixtureScaling.ts` ↔ `stripeInvoiceItemsFromFixtures.ts`) is to keep
 * two mirrored files because Edge bundles can't import from `src/lib/`.
 *
 * No DOM, no React, no Supabase. Pure functions only.
 */

export type PackageRowInput = {
  fixture: string
  count: number
  unitPrice: number
  revenue: number
  omitFromSubmissionDocuments: boolean
}

export type PackageExternalRow = {
  fixture: string
  count: number
  unitPrice: number
  revenue: number
}

export function buildBidPricingPackageExternalRows(
  rows: ReadonlyArray<PackageRowInput>,
): PackageExternalRow[] {
  const out: PackageExternalRow[] = []
  for (const r of rows) {
    if (r.omitFromSubmissionDocuments) continue
    if (!Number.isFinite(r.count) || r.count <= 0) continue
    out.push({
      fixture: r.fixture ?? '',
      count: r.count,
      unitPrice: r.unitPrice,
      revenue: r.revenue,
    })
  }
  return out
}

export function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatPackageCurrency(n: number): string {
  if (!Number.isFinite(n)) return '0.00'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function buildBidPricingPackageTableHtml(args: {
  externalRows: ReadonlyArray<PackageExternalRow>
  totalRevenue: number
}): string {
  const { externalRows, totalRevenue } = args

  const th = (text: string, align: 'left' | 'center' | 'right' = 'left'): string =>
    `<th style="border:1px solid #d1d5db;padding:6px 10px;text-align:${align};background:#f3f4f6;font-weight:600;font-size:13px;color:#111827">${escapeHtml(text)}</th>`

  const td = (text: string, align: 'left' | 'center' | 'right' = 'left'): string =>
    `<td style="border:1px solid #e5e7eb;padding:6px 10px;text-align:${align};font-size:13px;color:#111827">${text}</td>`

  const bodyRows = externalRows
    .map((r) => {
      return (
        '<tr>' +
        td(escapeHtml(r.fixture)) +
        td(String(r.count), 'center') +
        td(`$${formatPackageCurrency(r.unitPrice)}`, 'right') +
        td(`$${formatPackageCurrency(r.revenue)}`, 'right') +
        '</tr>'
      )
    })
    .join('')

  const totalCell = (text: string, align: 'left' | 'center' | 'right' = 'left'): string =>
    `<td style="border:1px solid #d1d5db;padding:6px 10px;text-align:${align};font-size:13px;color:#111827;background:#f9fafb;font-weight:600">${text}</td>`

  const footer =
    '<tr>' +
    totalCell('Total') +
    totalCell('', 'center') +
    totalCell('', 'right') +
    totalCell(`$${formatPackageCurrency(totalRevenue)}`, 'right') +
    '</tr>'

  return (
    '<table style="border-collapse:collapse;width:100%;font-family:Helvetica,Arial,sans-serif">' +
    '<thead><tr>' +
    th('Fixture or Tie-in') +
    th('Count', 'center') +
    th('Unit price', 'right') +
    th('Revenue', 'right') +
    '</tr></thead>' +
    `<tbody>${bodyRows}${footer}</tbody>` +
    '</table>'
  )
}

export function buildBidPricingPackageEmailHtml(args: {
  bidLabel: string
  plansLink: string | null
  tableHtml: string
  senderName: string | null
}): string {
  const { bidLabel, plansLink, tableHtml, senderName } = args

  const senderLine = senderName
    ? `<p style="margin:0 0 12px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#111827">Sent by ${escapeHtml(senderName)}.</p>`
    : ''

  const plansBlock = plansLink
    ? `<p style="margin:0 0 16px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#111827"><strong>Job plans:</strong> <a href="${escapeHtml(plansLink)}" style="color:#2563eb;text-decoration:underline">Open plans</a><br><span style="font-size:12px;color:#6b7280">${escapeHtml(plansLink)}</span></p>`
    : ''

  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;padding:24px;background:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#111827">' +
    `<h1 style="margin:0 0 16px 0;font-size:18px;color:#111827">Bid: ${escapeHtml(bidLabel)}</h1>` +
    senderLine +
    plansBlock +
    tableHtml +
    '</body></html>'
  )
}

export function buildBidPricingPackagePlainText(args: {
  externalRows: ReadonlyArray<PackageExternalRow>
  totalRevenue: number
  bidLabel: string
  plansLink: string | null
}): string {
  const { externalRows, totalRevenue, bidLabel, plansLink } = args

  const lines: string[] = []
  lines.push(`Bid: ${bidLabel}`)
  lines.push('')
  if (plansLink) {
    lines.push(`Job plans: ${plansLink}`)
    lines.push('')
  }

  const HDR = ['Fixture or Tie-in', 'Count', 'Unit price', 'Revenue']
  const body = externalRows.map((r) => [
    r.fixture || '',
    String(r.count),
    `$${formatPackageCurrency(r.unitPrice)}`,
    `$${formatPackageCurrency(r.revenue)}`,
  ])
  const totalRow = ['Total', '', '', `$${formatPackageCurrency(totalRevenue)}`]

  const allRows = [HDR, ...body, totalRow]
  const colWidths = [0, 0, 0, 0]
  for (const row of allRows) {
    for (let i = 0; i < 4; i++) {
      const cell = row[i] ?? ''
      if (cell.length > colWidths[i]!) colWidths[i] = cell.length
    }
  }

  const padLeft = (s: string, w: number): string => s.padStart(w, ' ')
  const padRight = (s: string, w: number): string => s.padEnd(w, ' ')

  // Body rows use ' • ' between cells (3 chars: space-bullet-space).
  // Header / divider / total use 3 spaces so columns stay aligned with body rows.
  const BODY_SEP = ' \u2022 '
  const PLAIN_SEP = '   '

  const formatRow = (row: string[], sep: string): string => {
    return [
      padRight(row[0] ?? '', colWidths[0]!),
      padLeft(row[1] ?? '', colWidths[1]!),
      padLeft(row[2] ?? '', colWidths[2]!),
      padLeft(row[3] ?? '', colWidths[3]!),
    ].join(sep)
  }

  const dividerLine = [
    ''.padEnd(colWidths[0]!, '-'),
    ''.padEnd(colWidths[1]!, '-'),
    ''.padEnd(colWidths[2]!, '-'),
    ''.padEnd(colWidths[3]!, '-'),
  ].join(PLAIN_SEP)

  lines.push(formatRow(HDR, PLAIN_SEP))
  lines.push(dividerLine)
  for (const row of body) lines.push(formatRow(row, BODY_SEP))
  lines.push(dividerLine)
  lines.push(formatRow(totalRow, PLAIN_SEP))

  return lines.join('\n')
}

export function packageRowRevenueTotalCents(
  rows: ReadonlyArray<PackageExternalRow>,
): number {
  let acc = 0
  for (const r of rows) {
    if (!Number.isFinite(r.revenue)) continue
    acc += Math.round(r.revenue * 100)
  }
  return acc
}
