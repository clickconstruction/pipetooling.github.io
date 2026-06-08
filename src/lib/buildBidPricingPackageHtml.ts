/**
 * Client copy of the Pricing tab "Package and send" pure helpers.
 *
 * **Keep in sync** with `supabase/functions/_shared/bidPricingPackage.ts` (Deno copy used by
 * the Edge function). Same convention the project follows for
 * `physicalInvoiceFixtureScaling.ts` ↔ `stripeInvoiceItemsFromFixtures.ts` — Edge bundles
 * can't import from `src/lib/`, so the file is mirrored.
 *
 * External audience: only 4 columns (Fixture/Tie-in, Count, Sale Price, Revenue). Hidden rows
 * (omitFromSubmissionDocuments) are dropped; revenue total in the footer still reflects all
 * rows so it matches the Bids Pricing tab footer.
 *
 * Pure functions only — no DOM, no Supabase, no React.
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

/**
 * Returns just the `<table>...</table>` with inline styles (Resend strips <style> blocks
 * in several clients, so every cell carries its own style attribute).
 *
 * Pass `externalRows` (already filtered) along with the unfiltered totalRevenue from the
 * Pricing tab so the footer matches Bids Pricing.
 */
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
    th('Sale Price', 'right') +
    th('Revenue', 'right') +
    '</tr></thead>' +
    `<tbody>${bodyRows}${footer}</tbody>` +
    '</table>'
  )
}

/**
 * Full standalone HTML document for Resend. Inline styles only.
 *
 * Plans link rendered as `<a href="...">Open plans</a>` when present; omitted when blank.
 * Email also includes a plain-text-safe URL line so screen readers / link-stripping clients
 * still surface the URL.
 */
export function buildBidPricingPackageEmailHtml(args: {
  bidLabel: string
  plansLink: string | null
  countToolingPlansLink?: string | null
  tableHtml: string
  senderName: string | null
}): string {
  const { bidLabel, plansLink, countToolingPlansLink, tableHtml, senderName } = args

  const senderLine = senderName
    ? `<p style="margin:0 0 12px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#111827">Sent by ${escapeHtml(senderName)}.</p>`
    : ''

  const plansBlock = plansLink
    ? `<p style="margin:0 0 16px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#111827"><strong>Job plans:</strong> <a href="${escapeHtml(plansLink)}" style="color:#2563eb;text-decoration:underline">Open plans</a><br><span style="font-size:12px;color:#6b7280">${escapeHtml(plansLink)}</span></p>`
    : ''

  const countToolingPlansBlock = countToolingPlansLink
    ? `<p style="margin:0 0 16px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#111827"><strong>CountTooling Plans:</strong> <a href="${escapeHtml(countToolingPlansLink)}" style="color:#2563eb;text-decoration:underline">Open takeoff</a><br><span style="font-size:12px;color:#6b7280">${escapeHtml(countToolingPlansLink)}</span></p>`
    : ''

  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;padding:24px;background:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#111827">' +
    `<h1 style="margin:0 0 16px 0;font-size:18px;color:#111827">Bid: ${escapeHtml(bidLabel)}</h1>` +
    senderLine +
    plansBlock +
    countToolingPlansBlock +
    tableHtml +
    '</body></html>'
  )
}

/**
 * Plain-text fallback used in the `mailto:` body. Fixed-width columns aligned with spaces so
 * desktop mail clients (which render mailto bodies as plain text only) keep readable structure.
 * Width-aware: longest fixture name + numeric columns padded to their own column width.
 */
export function buildBidPricingPackagePlainText(args: {
  externalRows: ReadonlyArray<PackageExternalRow>
  totalRevenue: number
  bidLabel: string
  plansLink: string | null
  countToolingPlansLink?: string | null
}): string {
  const { externalRows, totalRevenue, bidLabel, plansLink, countToolingPlansLink } = args

  const lines: string[] = []
  lines.push(`Bid: ${bidLabel}`)
  lines.push('')
  if (plansLink) {
    lines.push(`Job plans: ${plansLink}`)
    lines.push('')
  }
  if (countToolingPlansLink) {
    lines.push(`CountTooling Plans: ${countToolingPlansLink}`)
    lines.push('')
  }

  const HDR = ['Fixture or Tie-in', 'Count', 'Sale Price', 'Revenue']
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

/** Sum of cents from external (visible) rows — kept separate from total revenue for clarity. */
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
