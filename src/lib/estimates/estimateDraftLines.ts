import { computeEstimateLineExtendedCents, type EstimateLineItemNormalized } from '../estimateLineItemNormalize'
import type { EstimateCatalogLineItem } from '../estimateLineItemCatalog'

/**
 * The draft editor's line math (pure): the stub a new draft opens with, an empty row, what a
 * typed quantity or price becomes, how a patch to one line recomputes its amount, and how a
 * catalog entry becomes a line. Lifted out of `src/pages/Estimates.tsx` (Stage A of the
 * Estimates map, v2.3866) — every one of these touched money and none had a test.
 *
 * Rules kept from the page:
 * - A quantity that is not a finite number above 0 is 1 — a blank or a "0" never zeroes a line.
 * - A typed price is dollars, rounded to whole cents. A catalog price clamps at 0; a change
 *   order's credit line carries a negative unit price (`allowNegative`), the sign set by the
 *   Credit toggle, never by what was typed.
 * - `amount_cents` is always `computeEstimateLineExtendedCents(quantity, unit_price_cents)` —
 *   the kernel every reader of a draft shares.
 */

export type DraftLine = EstimateLineItemNormalized

export const DEFAULT_DRAFT_FIRST_LINE_ITEM = 'Custom Service Visit'

/** New stub: the default line item + an empty description. Legacy stub: an empty line item + the default in the description. Both at $0. */
export function isDefaultDraftStubShape(line_item: string, description: string, amount_cents: number): boolean {
  if (amount_cents !== 0) return false
  const def = DEFAULT_DRAFT_FIRST_LINE_ITEM.toLowerCase()
  const li = line_item.trim().toLowerCase()
  const desc = description.trim().toLowerCase()
  if (li === def && desc === '') return true
  if (line_item.trim() === '' && desc === def) return true
  return false
}

export function defaultDraftFirstLine(): DraftLine {
  return { line_item: DEFAULT_DRAFT_FIRST_LINE_ITEM, description: '', quantity: 1, unit_price_cents: 0, amount_cents: computeEstimateLineExtendedCents(1, 0) }
}

export function emptyDraftLine(): DraftLine {
  return { line_item: '', description: '', quantity: 1, unit_price_cents: 0, amount_cents: computeEstimateLineExtendedCents(1, 0) }
}

export function emptyCatalogEditRow(): EstimateCatalogLineItem {
  return { id: '', line_item: '', description: '', quantity: 1, unit_price_cents: 0, amount_cents: computeEstimateLineExtendedCents(1, 0) }
}

/** Nothing typed and nothing owed. */
export function isBlankDraftLine(l: DraftLine): boolean {
  return l.line_item.trim() === '' && l.description.trim() === '' && l.amount_cents === 0
}

/** A last row that inserting from the catalog may replace: blank, or the default first-line placeholder. */
export function isReplaceableStubLine(l: DraftLine): boolean {
  return isBlankDraftLine(l) || isDefaultDraftStubShape(l.line_item, l.description, l.amount_cents)
}

/** A quantity as the editor keeps it: a finite number above 0, else 1. */
export function coerceDraftQuantity(raw: number | string | null | undefined): number {
  const q = Number(raw)
  return Number.isFinite(q) && q > 0 ? q : 1
}

/** A typed dollars string → whole cents (a blank is 0). */
export function dollarsInputToCents(raw: string | null | undefined): number {
  return Math.round(Number(raw || '0') * 100)
}

/** A typed unit price on a draft line: whole cents, negative on a change order's credit line. */
export function draftUnitPriceInputCents(raw: string | null | undefined, opts?: { credit?: boolean }): number {
  const cents = dollarsInputToCents(raw)
  return opts?.credit ? -Math.abs(cents) : cents
}

/** A typed unit price on a catalog row: whole cents, never below 0. */
export function catalogUnitPriceInputCents(raw: string | null | undefined): number {
  return Math.max(0, dollarsInputToCents(raw))
}

/** One line with a patch applied and its amount recomputed — `updateLine`'s math. */
export function patchDraftLine(cur: DraftLine, patch: Partial<DraftLine>, opts?: { allowNegative?: boolean }): DraftLine {
  const line_item = patch.line_item !== undefined ? patch.line_item : cur.line_item
  const description = patch.description !== undefined ? patch.description : cur.description
  const quantity = coerceDraftQuantity(patch.quantity !== undefined ? patch.quantity : cur.quantity)
  const unit_price_cents = patch.unit_price_cents !== undefined ? patch.unit_price_cents : cur.unit_price_cents
  return { line_item, description, quantity, unit_price_cents, amount_cents: computeEstimateLineExtendedCents(quantity, unit_price_cents, { allowNegative: opts?.allowNegative }) }
}

/** A catalog row with a new quantity or unit price and its amount recomputed (the catalog editor's two inputs). */
export function patchCatalogEditRow(cur: EstimateCatalogLineItem, patch: { quantity?: number; unit_price_cents?: number }): EstimateCatalogLineItem {
  const quantity = patch.quantity !== undefined ? coerceDraftQuantity(patch.quantity) : cur.quantity
  const unit_price_cents = patch.unit_price_cents !== undefined ? Math.max(0, Math.round(patch.unit_price_cents)) : cur.unit_price_cents
  return { ...cur, quantity, unit_price_cents, amount_cents: computeEstimateLineExtendedCents(quantity, unit_price_cents) }
}

/** A catalog entry as a draft line: its quantity coerced, its price clamped at 0 and rounded, the amount recomputed. */
export function catalogEntryToLineItem(entry: EstimateCatalogLineItem): DraftLine {
  const quantity = coerceDraftQuantity(entry.quantity)
  const unit_price_cents = Math.max(0, Math.round(entry.unit_price_cents))
  return { line_item: entry.line_item, description: entry.description, quantity, unit_price_cents, amount_cents: computeEstimateLineExtendedCents(quantity, unit_price_cents) }
}
