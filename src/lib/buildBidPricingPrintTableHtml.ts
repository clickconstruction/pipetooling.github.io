/**
 * Inner `<thead>...</thead><tbody>...</tbody>` markup for the Bids → Pricing tab print views.
 *
 * Shared by both print buttons on the Pricing tab so the View toggle drives the column set
 * consistently:
 * - `Print` button → `printPricingPage` in `src/pages/Bids.tsx` (current selected version).
 * - `Review` button → `printAllPricingPages` in `src/pages/Bids.tsx` (loops every version).
 *
 * The viewModel branch:
 * - `'cost'` keeps the legacy 7-column layout (Fixture or Tie-in / Count / Price book entry /
 *   Unit price / Our cost / Revenue / Margin %).
 * - `'price'` emits a 5-column layout (Fixture or Tie-in / Count / Unit price / Revenue /
 *   % of Total) — mirrors the on-screen "Price Model" View by dropping cost-only columns and
 *   substituting `% of Total` (`pctOfGrandTotal`) for `Margin %`.
 *
 * Returns the inner table markup ONLY — callers own the surrounding `<table>` wrapper plus
 * their `<h2>` / `<section>` chrome (the two callers wrap with different surrounding HTML).
 *
 * Pure: no DOM, React, or Supabase access.
 */

import { escapeHtml, formatPackageCurrency } from './buildBidPricingPackageHtml'

export type BidPricingPrintRow = {
  fixture: string | null
  count: number
  priceBookEntryName: string | null
  unitPrice: number
  isFixedPrice: boolean
  cost: number
  revenue: number
  marginPct: number | null
  pctOfGrandTotal: number | null
}

export type BidPricingPrintViewModel = 'cost' | 'price'

const FIXED_PRICE_HINT_HTML =
  ' <span style="font-size:0.85em;color:#4b5563">(fixed)</span>'

function pctOrEmDash(n: number | null): string {
  return n != null ? `${n.toFixed(1)}%` : '\u2014'
}

function moneyCell(n: number): string {
  return `$${formatPackageCurrency(n)}`
}

function buildCostTable(args: {
  rows: ReadonlyArray<BidPricingPrintRow>
  totalCost: number
  totalRevenue: number
}): string {
  const { rows, totalCost, totalRevenue } = args
  const thead =
    '<thead><tr>' +
    '<th>Fixture or Tie-in</th>' +
    '<th style="text-align:center">Count</th>' +
    '<th>Price book entry</th>' +
    '<th style="text-align:right">Unit price</th>' +
    '<th style="text-align:right">Our cost</th>' +
    '<th style="text-align:right">Revenue</th>' +
    '<th style="text-align:center">Margin %</th>' +
    '</tr></thead>'

  const bodyRows = rows
    .map((r) => {
      const fixedHint = r.isFixedPrice ? FIXED_PRICE_HINT_HTML : ''
      return (
        '<tr>' +
        `<td>${escapeHtml(r.fixture ?? '')}</td>` +
        `<td style="text-align:center">${r.count}</td>` +
        `<td>${escapeHtml(r.priceBookEntryName ?? '\u2014')}</td>` +
        `<td style="text-align:right">${moneyCell(r.unitPrice)}${fixedHint}</td>` +
        `<td style="text-align:right">${moneyCell(r.cost)}</td>` +
        `<td style="text-align:right">${moneyCell(r.revenue)}</td>` +
        `<td style="text-align:center">${pctOrEmDash(r.marginPct)}</td>` +
        '</tr>'
      )
    })
    .join('')

  const overallMarginStr =
    totalRevenue > 0
      ? `${(((totalRevenue - totalCost) / totalRevenue) * 100).toFixed(1)}%`
      : '\u2014'

  const totalRow =
    '<tr style="background:#f9fafb; font-weight:600">' +
    '<td>Total</td>' +
    '<td style="text-align:center"></td>' +
    '<td></td>' +
    '<td style="text-align:right"></td>' +
    `<td style="text-align:right">${moneyCell(totalCost)}</td>` +
    `<td style="text-align:right">${moneyCell(totalRevenue)}</td>` +
    `<td style="text-align:center">${overallMarginStr}</td>` +
    '</tr>'

  return `${thead}<tbody>${bodyRows}${totalRow}</tbody>`
}

function buildPriceTable(args: {
  rows: ReadonlyArray<BidPricingPrintRow>
  totalRevenue: number
}): string {
  const { rows, totalRevenue } = args
  const thead =
    '<thead><tr>' +
    '<th>Fixture or Tie-in</th>' +
    '<th style="text-align:center">Count</th>' +
    '<th style="text-align:right">Unit price</th>' +
    '<th style="text-align:right">Revenue</th>' +
    '<th style="text-align:center">% of Total</th>' +
    '</tr></thead>'

  const bodyRows = rows
    .map((r) => {
      const fixedHint = r.isFixedPrice ? FIXED_PRICE_HINT_HTML : ''
      return (
        '<tr>' +
        `<td>${escapeHtml(r.fixture ?? '')}</td>` +
        `<td style="text-align:center">${r.count}</td>` +
        `<td style="text-align:right">${moneyCell(r.unitPrice)}${fixedHint}</td>` +
        `<td style="text-align:right">${moneyCell(r.revenue)}</td>` +
        `<td style="text-align:center">${pctOrEmDash(r.pctOfGrandTotal)}</td>` +
        '</tr>'
      )
    })
    .join('')

  const totalPctStr = totalRevenue > 0 ? '100.0%' : '\u2014'

  const totalRow =
    '<tr style="background:#f9fafb; font-weight:600">' +
    '<td>Total</td>' +
    '<td style="text-align:center"></td>' +
    '<td style="text-align:right"></td>' +
    `<td style="text-align:right">${moneyCell(totalRevenue)}</td>` +
    `<td style="text-align:center">${totalPctStr}</td>` +
    '</tr>'

  return `${thead}<tbody>${bodyRows}${totalRow}</tbody>`
}

export function buildBidPricingPrintTableHtml(args: {
  rows: ReadonlyArray<BidPricingPrintRow>
  totalCost: number
  totalRevenue: number
  viewModel: BidPricingPrintViewModel
}): string {
  if (args.viewModel === 'price') {
    return buildPriceTable({ rows: args.rows, totalRevenue: args.totalRevenue })
  }
  return buildCostTable({
    rows: args.rows,
    totalCost: args.totalCost,
    totalRevenue: args.totalRevenue,
  })
}
