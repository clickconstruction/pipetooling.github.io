/**
 * Pure builders for the Labor Sub Sheet print documents (per-stage and combined), extracted from
 * `src/pages/Bids.tsx`.
 *
 * Parity notes (preserved exactly from the original inline print functions):
 * - Per-row displayed cost = rate x hours x count (does NOT account for `is_fixed`).
 * - Stage total = sum of the `is_fixed`-aware per-row hours (fixed rows contribute `hours`, not
 *   `count x hours`). For fixed rows the per-row cell and the total can therefore differ.
 */

import { escapeHtml } from './htmlDoc'
import { formatCurrency } from '../format'

export type LaborSubSheetStage = 'rough_in' | 'top_out' | 'trim_set'

export type LaborSubSheetRow = {
  fixture: string | null
  count: number | null
  is_fixed: boolean | null
  rough_in_hrs_per_unit: number | null
  top_out_hrs_per_unit: number | null
  trim_set_hrs_per_unit: number | null
}

const HOURS_FIELD_BY_STAGE: Record<LaborSubSheetStage, keyof Pick<LaborSubSheetRow, 'rough_in_hrs_per_unit' | 'top_out_hrs_per_unit' | 'trim_set_hrs_per_unit'>> = {
  rough_in: 'rough_in_hrs_per_unit',
  top_out: 'top_out_hrs_per_unit',
  trim_set: 'trim_set_hrs_per_unit',
}

/** Rows `<tr>` markup + the `is_fixed`-aware stage total, matching the original print functions. */
function renderStageRowsAndTotal(
  rows: LaborSubSheetRow[],
  rate: number,
  stage: LaborSubSheetStage
): { rowsHtml: string; total: number } {
  const hoursField = HOURS_FIELD_BY_STAGE[stage]
  if (rows.length === 0) {
    return { rowsHtml: '<tr><td colspan="3" style="text-align:center; color:#6b7280;">No labor rows</td></tr>', total: 0 }
  }
  const rowsHtml = rows
    .map((row) => {
      const quantity = Number(row.count)
      const hours = Number(row[hoursField])
      const totalCost = rate * hours * quantity
      return `<tr><td>${escapeHtml(row.fixture ?? '')}</td><td style="text-align:center">${quantity}</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr>`
    })
    .join('')
  const total = rows.reduce((sum, row) => {
    const hrs = Number(row[hoursField])
    const stageHours = row.is_fixed ? hrs : Number(row.count) * hrs
    return sum + rate * stageHours
  }, 0)
  return { rowsHtml, total }
}

/** Single-stage labor sub sheet print document. */
export function buildLaborSubSheetHtml(args: {
  bidName: string
  stageLabel: string
  stage: LaborSubSheetStage
  rows: LaborSubSheetRow[]
  rate: number
}): string {
  const { bidName, stageLabel, stage, rows, rate } = args
  const title = escapeHtml(bidName || 'Bid') + ` — ${stageLabel} Labor Sub Sheet`
  const { rowsHtml, total } = renderStageRowsAndTotal(rows, rate, stage)

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 1rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  th { background: #f5f5f5; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>
  <table>
    <thead><tr><th>Fixture or Tie-in</th><th style="text-align:center">Quantity</th><th style="text-align:right">Rate</th></tr></thead>
    <tbody>${rowsHtml}<tr style="background:#f9fafb; font-weight:600"><td colspan="2" style="text-align:right">Total:</td><td style="text-align:right">$${formatCurrency(total)}</td></tr></tbody>
  </table>
</body></html>`
}

/** Combined document with all three stages (Rough In, Top Out, Trim Set). */
export function buildAllLaborSubSheetsHtml(args: {
  bidName: string
  rows: LaborSubSheetRow[]
  rate: number
}): string {
  const { rows, rate } = args
  const bidName = escapeHtml(args.bidName || 'Bid')

  const generateStageTable = (stageName: string, stage: LaborSubSheetStage): string => {
    const { rowsHtml, total } = renderStageRowsAndTotal(rows, rate, stage)
    return `
      <h2>${stageName}</h2>
      <table>
        <thead><tr><th>Fixture or Tie-in</th><th style="text-align:center">Quantity</th><th style="text-align:right">Rate</th></tr></thead>
        <tbody>${rowsHtml}<tr style="background:#f9fafb; font-weight:600"><td colspan="2" style="text-align:right">Total:</td><td style="text-align:right">$${formatCurrency(total)}</td></tr></tbody>
      </table>
    `
  }

  const roughInTable = generateStageTable('Rough In', 'rough_in')
  const topOutTable = generateStageTable('Top Out', 'top_out')
  const trimSetTable = generateStageTable('Trim Set', 'trim_set')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${bidName} — Labor Sub Sheets</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 1rem; }
  h2 { font-size: 1rem; margin: 1.5rem 0 0.5rem; page-break-before: auto; }
  h2:first-of-type { margin-top: 0.5rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; page-break-inside: avoid; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  th { background: #f5f5f5; }
  @media print { 
    body { margin: 0.5in; }
    h2 { page-break-after: avoid; }
  }
</style></head><body>
  <h1>${bidName} — Labor Sub Sheets</h1>
  ${roughInTable}
  ${topOutTable}
  ${trimSetTable}
</body></html>`
}
