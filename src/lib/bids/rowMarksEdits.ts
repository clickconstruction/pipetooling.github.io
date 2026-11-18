/**
 * Bids → Pricing, what the price is made of (punch list #128): the edits to a row's marks and to
 * the bid's material markup, as pure rules. `usePricingRowMarks` holds the state and the writes;
 * every number it writes is decided here, as `BidsPricingTab` decided it inline before the move
 * (decomposition queue row 1). The marks' shape is `rowKinds.ts`, their columns `rowMarksIo.ts`,
 * and the split they feed `rowPriceSplit.ts`.
 */
import type { RowMarks, RowMarksByRowId } from './rowKinds'
import { rowMarksFromDbRow, type RowMarksDbRow } from './rowMarksIo'

/**
 * The factor the bid saves for a markup typed on the Traditional card's chip: 1 + markup, to four
 * places (a 35% markup is 1.35). null is the bid going back to the company number.
 */
export function sovFactorFromMarkup(markup: number | null): number | null {
  return markup == null ? null : Math.round((1 + markup) * 10000) / 10000
}

/** A bid's saved factor as a number; a bid with none, or no bid, is null. */
export function savedSovFactorOf(bid: { sov_material_factor?: number | string | null } | null | undefined): number | null {
  return bid?.sov_material_factor != null ? Number(bid.sov_material_factor) : null
}

/** Every count row's marks, keyed by row id, read off the rows the engine loaded with `select('*')`. */
export function seedRowMarks(countRows: ReadonlyArray<{ id: string }>): RowMarksByRowId {
  const next: RowMarksByRowId = {}
  for (const cr of countRows) next[cr.id] = rowMarksFromDbRow(cr as unknown as RowMarksDbRow)
  return next
}

/** What a row's markup cell says: nothing (clear the row's own), a markup, or text that is not a markup. */
export type RowMarkupText = { kind: 'clear' } | { kind: 'markup'; markup: number } | { kind: 'unreadable' }

/**
 * The cell's text as a markup. The cell is in percent with one decimal: "12.5%" is 0.125.
 * Percent signs and spaces are dropped; empty text clears; a negative or a word is unreadable.
 */
export function readRowMarkupText(raw: string): RowMarkupText {
  const s = raw.replace(/[%\s]/g, '')
  if (s === '') return { kind: 'clear' }
  const v = Number(s)
  if (!Number.isFinite(v) || v < 0) return { kind: 'unreadable' }
  return { kind: 'markup', markup: Math.round(v * 10) / 1000 }
}

/**
 * The markup a row shows while its cell is typed in, so the labor under it moves at once.
 * null while nothing is typed, and while the text is unreadable (the row keeps its saved split).
 */
export function rowMarkupPreviewOf(draft: { rowId: string; text: string } | null): { rowId: string; markup: number | null } | null {
  if (!draft) return null
  const read = readRowMarkupText(draft.text)
  if (read.kind === 'unreadable') return null
  return { rowId: draft.rowId, markup: read.kind === 'clear' ? null : read.markup }
}

/**
 * What leaving the cell writes: null is nothing. Empty text clears a row's own markup and writes
 * nothing when the row has none; unreadable text and the markup the row already has write nothing.
 */
export function rowMarkupCommit(current: number | null, raw: string): { markup: number | null } | null {
  const read = readRowMarkupText(raw)
  if (read.kind === 'unreadable') return null
  if (read.kind === 'clear') return current != null ? { markup: null } : null
  if (current != null && Math.abs(current - read.markup) < 1e-9) return null
  return { markup: read.markup }
}

/** A row's marks with its own markup set (null = the bid's markup again); the rest of its split is kept. */
export function withSplitMarkup(m: RowMarks, markup: number | null): RowMarks {
  return { ...m, split: { ...(m.split ?? {}), markup } }
}

/** A row's marks with its tax choice set (null = the rule again); the rest of its split is kept. */
export function withSplitTaxable(m: RowMarks, taxable: boolean | null): RowMarks {
  return { ...m, split: { ...(m.split ?? {}), taxable } }
}

/** What the Markup tool's Undo puts back: each row's own markup as it stood (undefined = it had no split). */
export type MarkupUndo = { rowId: string; markup: number | null | undefined }[]
/** What the Tax tool's Undo puts back: each row's tax choice as it stood. */
export type TaxUndo = { rowId: string; taxable: boolean | null | undefined }[]

export function markupUndoFor(rowIds: ReadonlyArray<string>, marks: RowMarksByRowId): MarkupUndo {
  return rowIds.map((rowId) => ({ rowId, markup: marks[rowId]?.split?.markup }))
}

export function taxUndoFor(rowIds: ReadonlyArray<string>, marks: RowMarksByRowId): TaxUndo {
  return rowIds.map((rowId) => ({ rowId, taxable: marks[rowId]?.split?.taxable }))
}

/** An undo list as row id → the value to write back; a row that had none goes back to null. */
export function markupUndoBack(undo: MarkupUndo): Map<string, number | null> {
  return new Map(undo.map((u) => [u.rowId, u.markup ?? null] as const))
}

export function taxUndoBack(undo: TaxUndo): Map<string, boolean | null> {
  return new Map(undo.map((u) => [u.rowId, u.taxable ?? null] as const))
}

/**
 * After a save where some rows failed: the marks on screen with each failed row put back as it
 * stood before the edit. A row that saved keeps its edit, and so does every row not in the save.
 */
export function putBackFailedRowMarks(current: RowMarksByRowId, rowIds: ReadonlyArray<string>, failed: ReadonlyArray<boolean>, before: RowMarksByRowId): RowMarksByRowId {
  const back = { ...current }
  rowIds.forEach((id, i) => {
    if (failed[i]) back[id] = before[id] ?? {}
  })
  return back
}

/** Where a bid's open split rows are remembered on this device. */
export function splitOpenStorageKey(bidId: string | null | undefined): string {
  return `pt.pricing.split.open.${bidId ?? ''}`
}

/** The remembered open rows; nothing remembered, or a value that does not parse, is none open. */
export function readSplitOpen(storage: Pick<Storage, 'getItem'> | null, key: string): Set<string> {
  try {
    const raw = storage ? storage.getItem(key) : null
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

/** The open rows with one row's chevron pressed: open closes, closed opens. */
export function toggledSplitOpen(open: ReadonlySet<string>, rowId: string): Set<string> {
  const next = new Set(open)
  if (next.has(rowId)) next.delete(rowId)
  else next.add(rowId)
  return next
}
