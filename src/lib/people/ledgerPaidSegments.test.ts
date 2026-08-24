import { describe, expect, it } from 'vitest'
import { filterStubsByPaidSegment, hiddenBySegment, paidSegmentCounts } from './ledgerPaidSegments'

const stubs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
const paidIds = new Set(['b', 'd'])

describe('paidSegmentCounts', () => {
  it('splits stubs into open/paid and totals them', () => {
    expect(paidSegmentCounts(stubs, paidIds)).toEqual({ open: 2, paid: 2, all: 4 })
  })

  it('handles no stubs', () => {
    expect(paidSegmentCounts([], paidIds)).toEqual({ open: 0, paid: 0, all: 0 })
  })

  it('ignores paid ids that are not in the list', () => {
    expect(paidSegmentCounts([{ id: 'a' }], new Set(['zzz']))).toEqual({ open: 1, paid: 0, all: 1 })
  })
})

describe('filterStubsByPaidSegment', () => {
  it('open keeps unpaid and partial (not fully paid) rows', () => {
    expect(filterStubsByPaidSegment(stubs, paidIds, 'open').map((s) => s.id)).toEqual(['a', 'c'])
  })

  it('paid keeps fully paid rows only', () => {
    expect(filterStubsByPaidSegment(stubs, paidIds, 'paid').map((s) => s.id)).toEqual(['b', 'd'])
  })

  it('all keeps everything, as a copy', () => {
    const out = filterStubsByPaidSegment(stubs, paidIds, 'all')
    expect(out.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(out).not.toBe(stubs)
  })
})

describe('hiddenBySegment', () => {
  const counts = { open: 2, paid: 3, all: 5 }

  it('open hides the paid rows', () => {
    expect(hiddenBySegment(counts, 'open')).toEqual({ count: 3, label: 'paid' })
  })

  it('paid hides the open rows', () => {
    expect(hiddenBySegment(counts, 'paid')).toEqual({ count: 2, label: 'open' })
  })

  it('all hides nothing', () => {
    expect(hiddenBySegment(counts, 'all')).toBeNull()
  })

  it('stays quiet when the hidden side is empty', () => {
    expect(hiddenBySegment({ open: 2, paid: 0, all: 2 }, 'open')).toBeNull()
    expect(hiddenBySegment({ open: 0, paid: 2, all: 2 }, 'paid')).toBeNull()
  })
})
