import { describe, expect, it } from 'vitest'
import { resolvePricingEntry } from './resolvePricingEntry'
import type { PriceBookEntryWithFixture } from './bidPricingEngineTypes'

const entry = (id: string, fixtureName: string) => ({ id, fixture_types: { name: fixtureName } }) as unknown as PriceBookEntryWithFixture
const entries = [entry('e-toilet', 'Toilet'), entry('e-sink', 'Lav Sink')]
const countRows = [{ id: 'r1', fixture: 'toilet' }, { id: 'r2', fixture: 'Shower' }]

describe('resolvePricingEntry', () => {
  it('is null without an active pricing', () => {
    expect(resolvePricingEntry({ countRowId: 'r1', versionId: null, assignments: [], entries, countRows })).toBeNull()
  })
  it('an assignment for the active pricing wins, even over a name match', () => {
    const assignments = [{ count_row_id: 'r1', price_book_version_id: 'v1', price_book_entry_id: 'e-sink' }]
    expect(resolvePricingEntry({ countRowId: 'r1', versionId: 'v1', assignments, entries, countRows })?.id).toBe('e-sink')
  })
  it('an assignment for another pricing is ignored and the fixture name matches case-insensitively', () => {
    const assignments = [{ count_row_id: 'r1', price_book_version_id: 'v2', price_book_entry_id: 'e-sink' }]
    expect(resolvePricingEntry({ countRowId: 'r1', versionId: 'v1', assignments, entries, countRows })?.id).toBe('e-toilet')
  })
  it('an assignment to a missing entry, an unknown row, or an unmatched fixture is null', () => {
    expect(resolvePricingEntry({ countRowId: 'r1', versionId: 'v1', assignments: [{ count_row_id: 'r1', price_book_version_id: 'v1', price_book_entry_id: 'gone' }], entries, countRows })).toBeNull()
    expect(resolvePricingEntry({ countRowId: 'nope', versionId: 'v1', assignments: [], entries, countRows })).toBeNull()
    expect(resolvePricingEntry({ countRowId: 'r2', versionId: 'v1', assignments: [], entries, countRows })).toBeNull()
  })
})
