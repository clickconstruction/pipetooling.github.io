import type { PurchaseOrderWithItems } from '../materials/poItemDetails'
import { formatCurrency } from '../format'

/**
 * Pure HTML builders for the Materials Purchase Orders print flows — extracted
 * verbatim from `printPO` / `printPOForSupplyHouse` in Materials.tsx (Stage A
 * of the Materials decomposition; see docs/MATERIALS_TABS_ARCHITECTURE.md).
 *
 * IO stays with the caller: the draft variant's per-item "All prices" lists
 * are fetched by the page and injected here, and the `window.open` + print
 * plumbing lives in the component.
 */

export type PartPriceOption = { supply_house_name: string; price: number }

const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The main PO print document. Finalized POs render chosen supply house + price
 * per row; drafts render an "All prices / Chosen" comparison from
 * `allPricesPerItem` (indexed parallel to `po.items`; pass null for finalized).
 */
export function buildPOPrintHtml(
  po: PurchaseOrderWithItems,
  allPricesPerItem: PartPriceOption[][] | null
): string {
  const title = escapeHtml(po.name)
  const grandTotal = po.items.reduce((sum, item) => sum + item.price_at_time * item.quantity, 0)
  let tableRows = ''
  if (po.status === 'finalized') {
    tableRows = po.items.map(item => {
      const partName = escapeHtml(item.part.name ?? '')
      const qty = item.quantity
      const sh = item.supply_house?.name ? escapeHtml(item.supply_house.name) : '—'
      const price = formatCurrency(item.price_at_time)
      const total = formatCurrency(item.price_at_time * item.quantity)
      return `<tr><td>${partName}</td><td>${qty}</td><td>${sh}</td><td>$${price}</td><td>$${total}</td></tr>`
    }).join('')
  } else {
    po.items.forEach((item, i) => {
      const partName = escapeHtml(item.part.name ?? '')
      const qty = item.quantity
      const prices = allPricesPerItem?.[i] ?? []
      const allPricesStr = prices.length === 0 ? '—' : prices.map(p => `${escapeHtml(p.supply_house_name)}: $${formatCurrency(p.price)}`).join('; ')
      const chosenStr = item.supply_house?.name ? `${escapeHtml(item.supply_house.name)}: $${formatCurrency(item.price_at_time)}` : '—'
      const total = formatCurrency(item.price_at_time * item.quantity)
      tableRows += `<tr><td>${partName}</td><td>${qty}</td><td>${allPricesStr}</td><td>${chosenStr}</td><td>$${total}</td></tr>`
    })
  }
  const statusLabel = po.status === 'finalized' ? 'Finalized' : 'Draft'
  const dateStr = po.status === 'finalized' && po.finalized_at
    ? new Date(po.finalized_at).toLocaleString()
    : po.created_at ? new Date(po.created_at).toLocaleDateString() : ''
  const theadFinalized = '<tr><th>Part</th><th>Qty</th><th>Supply House</th><th>Price</th><th>Total</th></tr>'
  const theadDraft = '<tr><th>Part</th><th>Qty</th><th>All prices</th><th>Chosen</th><th>Total</th></tr>'
  const thead = po.status === 'finalized' ? theadFinalized : theadDraft
  const footerColspan = po.status === 'finalized' ? 4 : 4
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
      body { font-family: sans-serif; margin: 1in; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
      th { background: #f5f5f5; }
      .meta { margin-bottom: 0.5rem; color: #666; }
      @media print { body { margin: 0.5in; } }
    </style></head><body>
      <h1>${title}</h1>
      <div class="meta">${statusLabel}${dateStr ? ` · ${dateStr}` : ''}</div>
      <table>
        <thead>${thead}</thead>
        <tbody>${tableRows}</tbody>
        <tfoot><tr><td colspan="${footerColspan}" style="text-align:right; font-weight:600;">Grand Total</td><td style="font-weight:600;">$${formatCurrency(grandTotal)}</td></tr></tfoot>
      </table>
    </body></html>`
}

/** The per-supply-house print variant: chosen prices only + a with-tax footer row. */
export function buildPOForSupplyHousePrintHtml(po: PurchaseOrderWithItems, taxPercent: number): string {
  const title = escapeHtml(po.name)
  const grandTotal = po.items.reduce((sum, item) => sum + item.price_at_time * item.quantity, 0)
  const withTaxAmount = grandTotal * (1 + taxPercent / 100)
  const tableRows = po.items.map(item => {
    const partName = escapeHtml(item.part.name ?? '')
    const qty = item.quantity
    const price = formatCurrency(item.price_at_time)
    const total = formatCurrency(item.price_at_time * item.quantity)
    return `<tr><td>${partName}</td><td>${qty}</td><td>$${price}</td><td>$${total}</td></tr>`
  }).join('')
  const thead = '<tr><th>Part</th><th>Qty</th><th>Price</th><th>Total</th></tr>'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
      body { font-family: sans-serif; margin: 1in; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
      th { background: #f5f5f5; }
      @media print { body { margin: 0.5in; } }
    </style></head><body>
      <h1>${title}</h1>
      <table>
        <thead>${thead}</thead>
        <tbody>${tableRows}</tbody>
        <tfoot><tr><td colspan="3" style="text-align:right; font-weight:600;">Grand Total:</td><td style="font-weight:600;">$${formatCurrency(grandTotal)}</td></tr><tr><td colspan="3" style="text-align:right; font-weight:600;">With Tax ${taxPercent}%:</td><td style="font-weight:600;">$${formatCurrency(withTaxAmount)}</td></tr></tfoot>
      </table>
    </body></html>`
}
