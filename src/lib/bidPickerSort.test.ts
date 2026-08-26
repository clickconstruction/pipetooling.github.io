import { describe, expect, it } from 'vitest'
import {
  normalizeBidPickerSortView,
  parseBidNumberNumeric,
  sortBidsForPicker,
  type BidPickerSortBid,
} from './bidPickerSort'

function bid(partial: Partial<BidPickerSortBid> & { id: string }): BidPickerSortBid {
  return { bid_number: null, bid_due_date: null, bid_date_sent: null, bid_value: null, ...partial }
}

describe('parseBidNumberNumeric', () => {
  it('parses plain numbers', () => {
    expect(parseBidNumberNumeric('302')).toBe(302)
  })
  it('parses the first digit run out of mixed text', () => {
    expect(parseBidNumberNumeric('302R1')).toBe(302)
    expect(parseBidNumberNumeric('B39')).toBe(39)
  })
  it('returns null for empty or non-numeric', () => {
    expect(parseBidNumberNumeric(null)).toBeNull()
    expect(parseBidNumberNumeric('')).toBeNull()
    expect(parseBidNumberNumeric('draft')).toBeNull()
  })
})

describe('sortBidsForPicker number view', () => {
  it('sorts numerically descending, not lexicographically', () => {
    const rows = [bid({ id: 'a', bid_number: '39' }), bid({ id: 'b', bid_number: '302' }), bid({ id: 'c', bid_number: '41' })]
    expect(sortBidsForPicker(rows, 'number').map((r) => r.bid_number)).toEqual(['302', '41', '39'])
  })
  it('puts unnumbered bids last, stable by id', () => {
    const rows = [bid({ id: 'z' }), bid({ id: 'a' }), bid({ id: 'm', bid_number: '5' })]
    expect(sortBidsForPicker(rows, 'number').map((r) => r.id)).toEqual(['m', 'a', 'z'])
  })
})

describe('sortBidsForPicker due view', () => {
  it('sorts soonest due first with undated last', () => {
    const rows = [
      bid({ id: 'a', bid_number: '1', bid_due_date: '2026-09-01' }),
      bid({ id: 'b', bid_number: '2' }),
      bid({ id: 'c', bid_number: '3', bid_due_date: '2026-08-15' }),
    ]
    expect(sortBidsForPicker(rows, 'due').map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })
  it('breaks same-day ties by bid number descending', () => {
    const rows = [
      bid({ id: 'a', bid_number: '10', bid_due_date: '2026-09-01' }),
      bid({ id: 'b', bid_number: '20', bid_due_date: '2026-09-01' }),
    ]
    expect(sortBidsForPicker(rows, 'due').map((r) => r.bid_number)).toEqual(['20', '10'])
  })
})

describe('sortBidsForPicker sent view', () => {
  it('sorts most recently sent first with unsent last', () => {
    const rows = [
      bid({ id: 'a', bid_number: '1', bid_date_sent: '2026-06-03' }),
      bid({ id: 'b', bid_number: '2' }),
      bid({ id: 'c', bid_number: '3', bid_date_sent: '2026-06-29' }),
    ]
    expect(sortBidsForPicker(rows, 'sent').map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })
  it('normalizes timestamps to the date for comparison', () => {
    const rows = [
      bid({ id: 'a', bid_number: '1', bid_date_sent: '2026-06-03T15:00:00Z' }),
      bid({ id: 'b', bid_number: '2', bid_date_sent: '2026-06-04' }),
    ]
    expect(sortBidsForPicker(rows, 'sent').map((r) => r.id)).toEqual(['b', 'a'])
  })
})

describe('sortBidsForPicker value view', () => {
  it('sorts largest value first with missing values last, accepting numeric strings', () => {
    const rows = [
      bid({ id: 'a', bid_number: '1', bid_value: '2243' }),
      bid({ id: 'b', bid_number: '2' }),
      bid({ id: 'c', bid_number: '3', bid_value: 213687 }),
    ]
    expect(sortBidsForPicker(rows, 'value').map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('normalizeBidPickerSortView', () => {
  it('passes valid views through and defaults everything else to number', () => {
    expect(normalizeBidPickerSortView('due')).toBe('due')
    expect(normalizeBidPickerSortView('garbage')).toBe('number')
    expect(normalizeBidPickerSortView(null)).toBe('number')
  })
})
