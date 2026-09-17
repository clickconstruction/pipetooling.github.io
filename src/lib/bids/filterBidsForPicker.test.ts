import { describe, expect, it } from 'vitest'
import { filterBidsForPicker } from './filterBidsForPicker'
import type { LedgerPrefixMap } from '../ledgerDisplayPrefixes'

const map = {} as LedgerPrefixMap
const bids = [
  { id: 'a', project_name: 'Metrology Lab', address: '12 Elm St', customers: { name: 'Acme' }, bids_gc_builders: { name: 'Knight Homes' }, bid_number: '482' },
  { id: 'b', project_name: 'Fire Station', address: null, customers: null, bids_gc_builders: null, bid_number: '77' },
]

describe('filterBidsForPicker', () => {
  it('returns every bid for a blank or whitespace query', () => {
    expect(filterBidsForPicker(bids, '', map).map((b) => b.id)).toEqual(['a', 'b'])
    expect(filterBidsForPicker(bids, '   ', map).map((b) => b.id)).toEqual(['a', 'b'])
  })
  it('matches project, address, customer and GC case-insensitively, tolerating null fields', () => {
    expect(filterBidsForPicker(bids, 'METRO', map).map((b) => b.id)).toEqual(['a'])
    expect(filterBidsForPicker(bids, 'elm', map).map((b) => b.id)).toEqual(['a'])
    expect(filterBidsForPicker(bids, 'acme', map).map((b) => b.id)).toEqual(['a'])
    expect(filterBidsForPicker(bids, 'knight', map).map((b) => b.id)).toEqual(['a'])
    expect(filterBidsForPicker(bids, 'station', map).map((b) => b.id)).toEqual(['b'])
    expect(filterBidsForPicker(bids, 'zzz', map)).toEqual([])
  })
})
