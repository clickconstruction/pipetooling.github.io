/**
 * Pure builder for the Bids → Labor cost-estimate Purchase Order print documents.
 *
 * Extracted from `src/pages/Bids.tsx` (merges the former `printCostEstimatePOForReview` and
 * `printCostEstimatePOForSupplyHouse`). The only difference between the two is the `review`
 * variant adds an "Assembly" column and labels the unit cost "Cost"; the `supplyHouse` variant
 * drops the assembly column and labels it "Price". No DOM/React/Supabase.
 */

import { escapeHtml } from './htmlDoc'

export type CostEstimatePOModalItem = {
  part_name: string
  quantity: number
  price_at_time: number
  template_name: string | null
}

export type CostEstimatePOVariant = 'review' | 'supplyHouse'

export function buildCostEstimatePOHtml(args: {
  variant: CostEstimatePOVariant
  poName: string
  items: CostEstimatePOModalItem[]
  taxPercent: number
}): string {
  const { variant, poName, items, taxPercent } = args
  const includeAssembly = variant === 'review'
  const title = escapeHtml(poName)
  const grandTotal = items.reduce((sum, item) => sum + item.price_at_time * item.quantity, 0)
  const withTaxAmount = grandTotal * (1 + taxPercent / 100)
  const tableRows = items.map((item) => {
    const partName = escapeHtml(item.part_name)
    const qty = item.quantity
    const price = item.price_at_time.toFixed(2)
    const total = (item.price_at_time * item.quantity).toFixed(2)
    if (includeAssembly) {
      const template = escapeHtml(item.template_name ?? '—')
      return `<tr><td>${partName}</td><td>${qty}</td><td>${template}</td><td>$${price}</td><td>$${total}</td></tr>`
    }
    return `<tr><td>${partName}</td><td>${qty}</td><td>$${price}</td><td>$${total}</td></tr>`
  }).join('')
  const thead = includeAssembly
    ? '<tr><th>Part</th><th>Qty</th><th>Assembly</th><th>Cost</th><th>Total</th></tr>'
    : '<tr><th>Part</th><th>Qty</th><th>Price</th><th>Total</th></tr>'
  const footerColspan = includeAssembly ? 4 : 3
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
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
        <tfoot><tr><td colspan="${footerColspan}" style="text-align:right; font-weight:600;">Grand Total:</td><td style="font-weight:600;">$${grandTotal.toFixed(2)}</td></tr><tr><td colspan="${footerColspan}" style="text-align:right; font-weight:600;">With Tax ${taxPercent}%:</td><td style="font-weight:600;">$${withTaxAmount.toFixed(2)}</td></tr></tfoot>
      </table>
    </body></html>`
  return html
}
