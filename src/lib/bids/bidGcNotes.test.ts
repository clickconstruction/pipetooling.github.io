import { describe, expect, it } from 'vitest'
import { countGcNotes, gcNoteCountKey, partitionNotesForGc } from './bidGcNotes'

describe('countGcNotes', () => {
  it('counts scoped rows per bid+gc; whole-bid rows never count', () => {
    const rows = [
      { bid_id: 'b1', gc_customer_id: 'g1' },
      { bid_id: 'b1', gc_customer_id: 'g1' },
      { bid_id: 'b1', gc_customer_id: null },
      { bid_id: 'b2', gc_customer_id: 'g1' },
    ]
    expect(countGcNotes(rows)).toEqual({ [gcNoteCountKey('b1', 'g1')]: 2, [gcNoteCountKey('b2', 'g1')]: 1 })
  })
})

describe('partitionNotesForGc', () => {
  const entries = [
    { id: 'a', gc_customer_id: 'g1' },
    { id: 'b', gc_customer_id: null },
    { id: 'c', gc_customer_id: 'g2' },
  ]
  it('a real GC gets its scoped notes plus the whole-bid notes as context', () => {
    expect(partitionNotesForGc(entries, 'g1')).toEqual({ scoped: [{ id: 'a', gc_customer_id: 'g1' }], context: [{ id: 'b', gc_customer_id: null }] })
  })
  it("the bid's own GC (null) reads the whole-bid notes as the notes", () => {
    expect(partitionNotesForGc(entries, null)).toEqual({ scoped: [{ id: 'b', gc_customer_id: null }], context: [] })
  })
})
