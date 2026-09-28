/**
 * Bids → Pricing: the margin brush (v2.2401) — the pure half, out of `BidsPricingTab` (the
 * Pricing / Labor map's step 8). Pick up the brush at a margin, sweep across the Workbench's
 * rows, and every row the pointer crosses prices at that margin; pointer-up saves the sweep
 * as one batch, and the last sweep can be undone. `useMarginBrush` holds the state and runs
 * the writes; everything here is a function of its arguments.
 */
import { unitPriceForTargetMargin } from './applyMarginPricing'

/** A Workbench row as the brush reads it. */
export type BrushRow = { countRow: { id: string }; cost: number; count: number; unitPrice: number | null; isFixedPrice: boolean }

/** One row the stroke has touched: its saved price before (null = unpriced) and the brushed price. */
export type BrushTouch = { prev: number | null; next: number }

/**
 * The price the brush gives a row at margin `m`, or null when the row is skipped: no cost to
 * price from, a fixed price, or held by a 📌. A row with a cost but no count is skipped too
 * (there is no unit to price).
 */
export function brushPriceFor(row: BrushRow, locks: ReadonlySet<string>, m: number): number | null {
  if (!(row.cost > 0) || row.isFixedPrice || locks.has(row.countRow.id)) return null
  return unitPriceForTargetMargin(row.cost, row.count, m)
}

/** What the row carried before the brush: its saved price, or null when it had none (a $0 counts as none). */
export function brushPrevPrice(row: Pick<BrushRow, 'unitPrice'>): number | null {
  return row.unitPrice != null && row.unitPrice > 0 ? row.unitPrice : null
}

/** The rows a stroke actually changes — a row already at the brushed price is not a change. */
export function brushChangedRows(stroke: ReadonlyMap<string, BrushTouch>): Array<[string, BrushTouch]> {
  return [...stroke.entries()].filter(([, v]) => v.prev !== v.next)
}

/** The drafts without the given rows (the stroke's drafts come off once it commits or is cancelled). */
export function draftsWithout(drafts: Readonly<Record<string, string>>, rowIds: Iterable<string>): Record<string, string> {
  const next = { ...drafts }
  for (const id of rowIds) delete next[id]
  return next
}

/**
 * A pending solver preview once the brushed rows are saved prices: those rows leave the preview
 * and its vetoes. `touched` is false when none of them was in the preview (nothing to restash);
 * an emptied preview is null.
 */
export function previewWithoutRows(
  preview: Readonly<Record<string, number>>,
  veto: ReadonlySet<string>,
  rowIds: Iterable<string>,
): { preview: Record<string, number> | null; veto: Set<string>; touched: boolean } {
  const nextPreview = { ...preview }
  const nextVeto = new Set(veto)
  let touched = false
  for (const id of rowIds) {
    if (id in nextPreview) {
      delete nextPreview[id]
      nextVeto.delete(id)
      touched = true
    }
  }
  return { preview: Object.keys(nextPreview).length > 0 ? nextPreview : null, veto: nextVeto, touched }
}

/** The one-level undo a committed sweep leaves: each row with the price it had before. */
export function brushUndoOf(changed: ReadonlyArray<[string, BrushTouch]>): Array<[string, number | null]> {
  return changed.map(([rowId, v]) => [rowId, v.prev])
}

export function brushSweptMessage(rows: number, m: number | null): string {
  return `Swept ${rows} row${rows === 1 ? '' : 's'} at ${m}% — sweep again, or Esc puts the brush down.`
}

/** The id of the Workbench row a DOM element sits in (`<tr id="wb-row-…">`), or null. */
export function workbenchRowIdAt(el: Element | null): string | null {
  const tr = el && 'closest' in el ? el.closest('tr[id^="wb-row-"]') : null
  return tr ? tr.id.slice('wb-row-'.length) : null
}
