/**
 * Pure builders for the Bids -> Labor tab "Print" document (`printCostEstimatePage`).
 *
 * Two variants matching the bid's materials model:
 *   - `rough`: materials are a rough-takeoff roll-up (one table per fixture).
 *   - `exact`: materials are three stage POs (Rough In / Top Out / Trim Set) with subtotal/tax rows.
 * Both share an identical Labor table + cost Summary tail (de-duplicated here via private helpers).
 *
 * The caller (`Bids.tsx`) performs all data gathering (supabase fetches, part-name resolution) and
 * the cost math, then hands fully-computed numbers to these builders. No supabase/window/app-state.
 */

import { formatCurrency } from '../format'
import { escapeHtml } from './htmlDoc'

export interface LaborPageRow {
  fixture: string | null
  count: number
  /** Per-unit hours columns shown in the Labor table. */
  roughPerUnit: number
  topPerUnit: number
  trimPerUnit: number
  /** Pre-computed via laborRowHours (honors is_fixed). */
  totalHrs: number
}

/** Pre-computed stage-hour totals for the Labor table totals row (via laborRowRough/Top/Trim). */
export interface LaborPageTotals {
  rough: number
  top: number
  trim: number
}

export interface LaborPageCosts {
  totalMaterials: number
  taxPercent: number
  rate: number
  totalHours: number
  laborCost: number
  distance: number
  ratePerMile: number
  numTrips: number
  drivingCost: number
  estimatorCost: number
  travelCost: number
  laborCostWithDriving: number
  grandTotal: number
}

export interface RoughLaborPageInput {
  /** Raw (unescaped) title; the builder escapes it. */
  title: string
  rows: LaborPageRow[]
  totals: LaborPageTotals | null
  costs: LaborPageCosts
  materials: Array<{
    fixture: string | null
    count: number
    lines: Array<{ partName: string; unitPrice: number; quantity: number }>
  }>
}

export interface ExactLaborPageInput {
  /** Raw (unescaped) title; the builder escapes it. */
  title: string
  rows: LaborPageRow[]
  totals: LaborPageTotals | null
  costs: LaborPageCosts
  pos: Array<{
    stageLabel: string
    poName: string
    stageMaterialTotal: number
    items: Array<{ part_name: string; quantity: number; price_at_time: number; template_name: string | null }>
  }>
}

function docShell(rawTitle: string, body: string): string {
  const title = escapeHtml(rawTitle)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 1rem; }
  h2 { font-size: 1rem; margin: 1rem 0 0.5rem; text-align: center; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  th { background: #f5f5f5; }
  .summary { margin-top: 1rem; padding: 0.75rem; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; }
  .summary p { margin: 0.25rem 0; text-align: right; }
  .po-section { margin-bottom: 1rem; padding: 0.75rem; background: #fafafa; border-left: 3px solid #3b82f6; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>
  ${body}
</body></html>`
}

function laborTableAndSummary(
  rows: LaborPageRow[],
  totals: LaborPageTotals | null,
  costs: LaborPageCosts,
  materialsSummaryLabel: string,
): string {
  const {
    rate,
    totalHours,
    laborCost,
    distance,
    ratePerMile,
    numTrips,
    drivingCost,
    estimatorCost,
    travelCost,
    laborCostWithDriving,
    totalMaterials,
    grandTotal,
  } = costs
  const laborRowsHtml =
    rows.length === 0
      ? '<tr><td colspan="6" style="text-align:center; color:#6b7280;">No labor rows</td></tr>'
      : rows
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.fixture ?? '')}</td><td style="text-align:center">${row.count}</td><td style="text-align:center">${row.roughPerUnit.toFixed(2)}</td><td style="text-align:center">${row.topPerUnit.toFixed(2)}</td><td style="text-align:center">${row.trimPerUnit.toFixed(2)}</td><td style="text-align:center; font-weight:600">${row.totalHrs.toFixed(2)}</td></tr>`,
          )
          .join('')
  const totalsRowHtml =
    rows.length > 0 && totals
      ? `<tr style="background:#f9fafb; font-weight:600"><td>Totals</td><td style="text-align:center"></td><td style="text-align:center">${totals.rough.toFixed(2)} hrs</td><td style="text-align:center">${totals.top.toFixed(2)} hrs</td><td style="text-align:center">${totals.trim.toFixed(2)} hrs</td><td style="text-align:center">${totalHours.toFixed(2)} hrs</td></tr>`
      : ''
  return `<h2>Labor</h2>
  <p>Labor rate: $${formatCurrency(rate)}/hr</p>
  <table>
    <thead><tr><th>Fixture or Tie-in</th><th style="text-align:center">Count</th><th style="text-align:center">Rough In</th><th style="text-align:center">Top Out</th><th style="text-align:center">Trim Set</th><th style="text-align:center">Total hrs</th></tr></thead>
    <tbody>${laborRowsHtml}${totalsRowHtml}</tbody>
  </table>
  <p style="font-weight:600; text-align:right; margin-top:0.5rem;">Manhours: $${formatCurrency(laborCost)}<br/><span style="font-weight:400; font-size:0.875rem;">(${totalHours.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} hrs × $${formatCurrency(rate)}/hr)</span></p>${distance > 0 && totalHours > 0 ? `
  <p style="font-weight:600; text-align:right; margin-top:0.5rem;">Driving: $${formatCurrency(drivingCost)}<br/><span style="font-weight:400; font-size:0.875rem;">(${numTrips.toFixed(1)} trips × $${ratePerMile.toFixed(2)}/mi × ${distance.toFixed(0)} mi)</span></p>` : ''}${estimatorCost > 0 ? `
  <p style="font-weight:600; text-align:right; margin-top:0.5rem;">Estimator: $${formatCurrency(estimatorCost)}</p>` : ''}${travelCost > 0 ? `
  <p style="font-weight:600; text-align:right; margin-top:0.5rem;">Travel: $${formatCurrency(travelCost)}</p>` : ''}
  <p style="font-weight:600; text-align:right; margin-top:0.5rem;">Labor total: $${formatCurrency(laborCostWithDriving)}</p>
  <h2>Summary</h2>
  <div class="summary">
    <p>${materialsSummaryLabel} $${formatCurrency(totalMaterials)}</p>
    <p>Manhours: $${formatCurrency(laborCost)}</p>${distance > 0 && totalHours > 0 ? `
    <p>Driving: $${formatCurrency(drivingCost)}</p>` : ''}${estimatorCost > 0 ? `
    <p>Estimator: $${formatCurrency(estimatorCost)}</p>` : ''}${travelCost > 0 ? `
    <p>Travel: $${formatCurrency(travelCost)}</p>` : ''}
    <p>Labor total: $${formatCurrency(laborCostWithDriving)}</p>
    <p style="font-weight:700; font-size:1.125rem;">Our total cost is: $${formatCurrency(grandTotal)}</p>
  </div>`
}

function generatePOSummary(
  items: Array<{ part_name: string; quantity: number; price_at_time: number; template_name: string | null }>,
  stageLabel: string,
  taxPercent: number,
): string {
  if (items.length === 0) return '<p style="margin:0.5rem 0; font-size:0.875rem; color:#6b7280;">No items in this PO.</p>'
  const tableRows = items
    .map((item) => {
      const qty = item.quantity.toLocaleString('en-US')
      const price = item.price_at_time.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      const itemTotal = (item.quantity * item.price_at_time).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return `<tr><td style="padding:0.25rem 0.5rem">${escapeHtml(item.part_name)}</td><td style="padding:0.25rem 0.5rem; text-align:center">${qty}</td><td style="padding:0.25rem 0.5rem; text-align:right">$${price}</td><td style="padding:0.25rem 0.5rem; text-align:right">$${itemTotal}</td></tr>`
    })
    .join('')
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price_at_time, 0)
  const taxAmount = subtotal * (taxPercent / 100)
  const stageTotal = subtotal + taxAmount
  const totalFormatted = subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const taxFormatted = taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const stageTotalFormatted = stageTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `
        <table style="width:100%; border-collapse:collapse; margin:0.5rem 0; font-size:0.875rem">
          <thead style="background:#f9fafb"><tr><th style="padding:0.25rem 0.5rem; text-align:left; border:1px solid #ccc">Part</th><th style="padding:0.25rem 0.5rem; text-align:center; border:1px solid #ccc">Qty</th><th style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">Price</th><th style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">Total</th></tr></thead>
          <tbody>${tableRows}<tr style="background:#f9fafb; font-weight:600"><td colspan="3" style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">Subtotal:</td><td style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">$${totalFormatted}</td></tr><tr style="background:#f9fafb; font-weight:600"><td colspan="3" style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">Tax:</td><td style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">$${taxFormatted}</td></tr><tr style="background:#f9fafb; font-weight:600"><td colspan="3" style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">${stageLabel} Total:</td><td style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">$${stageTotalFormatted}</td></tr></tbody>
        </table>`
}

export function buildRoughLaborPageHtml(input: RoughLaborPageInput): string {
  const { title, rows, totals, costs, materials } = input
  const roughMaterialsBlocks = materials
    .map((block) => {
      if (block.lines.length === 0) return ''
      const tr = block.lines
        .map((l) => {
          const nm = escapeHtml(l.partName)
          const q = Number(l.quantity)
          const up = Number(l.unitPrice)
          return `<tr><td style="padding:0.25rem 0.5rem; border:1px solid #ccc">${nm}</td><td style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">$${up.toFixed(2)}</td><td style="padding:0.25rem 0.5rem; text-align:center; border:1px solid #ccc">${q}</td><td style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">$${(q * up).toFixed(2)}</td></tr>`
        })
        .join('')
      return `
  <div class="po-section">
    <p style="margin:0 0 0.25rem; font-weight:600">${escapeHtml(block.fixture ?? '—')} <span style="font-weight:400; color:#6b7280">(count ${Number(block.count)})</span></p>
    <table style="width:100%; border-collapse:collapse; font-size:0.875rem">
      <thead style="background:#f9fafb"><tr><th style="padding:0.25rem 0.5rem; text-align:left; border:1px solid #ccc">Part</th><th style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">Unit</th><th style="padding:0.25rem 0.5rem; text-align:center; border:1px solid #ccc">Qty</th><th style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">Total</th></tr></thead>
      <tbody>${tr}</tbody>
    </table>
  </div>`
    })
    .join('')
  const materialsBody = `<h2>Materials (rough takeoff)</h2>
  <p style="font-size:0.875rem; color:#6b7280;">Pre-tax total $${formatCurrency(costs.totalMaterials)} · Tax ${costs.taxPercent}% → with tax $${formatCurrency(costs.totalMaterials * (1 + costs.taxPercent / 100))}</p>
  ${roughMaterialsBlocks}
  <p style="font-weight:600; text-align:right;">Materials total (pre-tax): $${formatCurrency(costs.totalMaterials)}</p>`
  const body = `${materialsBody}
  ${laborTableAndSummary(rows, totals, costs, 'Materials total (pre-tax):')}`
  return docShell(title, body)
}

export function buildExactLaborPageHtml(input: ExactLaborPageInput): string {
  const { title, rows, totals, costs, pos } = input
  const poSections = pos
    .map(
      (po) => `  <div class="po-section">
    <p style="margin:0 0 0.25rem; font-weight:600"><strong>PO (${po.stageLabel})</strong> ${escapeHtml(po.poName)} — $${formatCurrency(po.stageMaterialTotal)}</p>
    ${generatePOSummary(po.items, po.stageLabel, costs.taxPercent)}
  </div>`,
    )
    .join('\n')
  const materialsBody = `<h2>Materials</h2>
${poSections}
  <p style="font-weight:600; text-align:right;">Materials Total: $${formatCurrency(costs.totalMaterials)}</p>`
  const body = `${materialsBody}
  ${laborTableAndSummary(rows, totals, costs, 'Materials Total:')}`
  return docShell(title, body)
}
