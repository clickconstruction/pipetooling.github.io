import type { EstimateCatalogItemEventRow } from '../estimateCatalogApi'
import type { EstimateCatalogLineItem } from '../estimateLineItemCatalog'
import { formatEstimateMoney } from './estimateListRows'

/**
 * The line-item catalog's two readings (pure): a history event as one sentence, and the
 * pick list narrowed by what was typed. Lifted out of `src/pages/Estimates.tsx` with the
 * catalog modal (step 3 of the Estimates map, v2.3870).
 */

/** One catalog history event as the sentence the modal lists: what was added, changed, removed or restored, with its numbers. */
export function catalogEventSummary(e: EstimateCatalogItemEventRow): string {
  const fmt = (c: number | null | undefined) => (c == null ? '—' : formatEstimateMoney(c))
  const fmtQty = (q: number | null | undefined) => (q == null ? '—' : String(q))
  const lineLbl = (line: string | null | undefined, desc: string | null | undefined) => {
    const a = (line ?? '').trim()
    const b = (desc ?? '').trim()
    if (a && b) return `"${a}" (${b})`
    if (a) return `"${a}"`
    if (b) return `"${b}"`
    return '—'
  }
  switch (e.action) {
    case 'create':
      return `Added: ${lineLbl(e.new_line_item, e.new_description)} · qty ${fmtQty(e.new_quantity)} × ${fmt(e.new_unit_price_cents)} = ${fmt(e.new_amount_cents)}`
    case 'update':
      return `Updated: ${lineLbl(e.prev_line_item, e.prev_description)} qty ${fmtQty(e.prev_quantity)} × ${fmt(e.prev_unit_price_cents)} → ${lineLbl(e.new_line_item, e.new_description)} qty ${fmtQty(e.new_quantity)} × ${fmt(e.new_unit_price_cents)}`
    case 'delete':
      return `Removed: ${lineLbl(e.prev_line_item, e.prev_description)} · qty ${fmtQty(e.prev_quantity)} × ${fmt(e.prev_unit_price_cents)}`
    case 'restore':
      return `Restored: ${lineLbl(e.new_line_item, e.new_description)} · qty ${fmtQty(e.new_quantity)} × ${fmt(e.new_unit_price_cents)} = ${fmt(e.new_amount_cents)}`
    default:
      return String(e.action)
  }
}

/** The pick list under the filter box: the item, its description, its numbers as typed or as money. A blank filter is the whole catalog. */
export function filterCatalogItems(items: readonly EstimateCatalogLineItem[], query: string): EstimateCatalogLineItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...items]
  return items.filter((c) => {
    if (c.line_item.toLowerCase().includes(q)) return true
    if (c.description.toLowerCase().includes(q)) return true
    if (String(c.quantity).includes(q)) return true
    if (String(c.unit_price_cents).includes(q)) return true
    if (String(c.amount_cents).includes(q)) return true
    return formatEstimateMoney(c.unit_price_cents).toLowerCase().includes(q) || formatEstimateMoney(c.amount_cents).toLowerCase().includes(q)
  })
}
