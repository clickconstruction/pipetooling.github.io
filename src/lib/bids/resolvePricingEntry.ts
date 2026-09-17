/**
 * Which price-book entry prices a count row (Pricing train, Stage A — v2.3546).
 *
 * Lifted verbatim from `BidsPricingTab`: an explicit assignment for the active pricing wins;
 * otherwise the entry whose fixture name matches the row's fixture, case-insensitively.
 * No version → nothing. The tab passes its engine state; nothing here reads React.
 */
import type { BidPricingAssignment, PriceBookEntryWithFixture } from './bidPricingEngineTypes'

export type ResolvePricingEntryInput = {
  countRowId: string
  /** The active pricing (price-book version) — null before one is picked. */
  versionId: string | null
  assignments: ReadonlyArray<Pick<BidPricingAssignment, 'count_row_id' | 'price_book_version_id' | 'price_book_entry_id'>>
  entries: ReadonlyArray<PriceBookEntryWithFixture>
  countRows: ReadonlyArray<{ id: string; fixture: string | null }>
}

export function resolvePricingEntry(input: ResolvePricingEntryInput): PriceBookEntryWithFixture | null {
  const { countRowId, versionId, assignments, entries, countRows } = input
  if (!versionId) return null
  const existing = assignments.find((a) => a.count_row_id === countRowId && a.price_book_version_id === versionId)
  const entriesById = new Map(entries.map((e) => [e.id, e]))
  if (existing) {
    return entriesById.get(existing.price_book_entry_id) ?? null
  }
  const countRow = countRows.find((r) => r.id === countRowId)
  if (!countRow) return null
  return (
    entries.find((e) => (e.fixture_types?.name ?? '').toLowerCase() === (countRow.fixture ?? '').toLowerCase()) ?? null
  )
}
