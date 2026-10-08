import { describe, expect, it } from 'vitest'
import { bidCellDay, bidCellPast, buildBidCellHistoryIndex, countCellKeys, laborCellKeys, priceCellKeys, takeoffCellKeys, type BidCellHistoryRpcRow } from './bidCellHistory'

// Made-up people and values.
const NOW = new Date('2026-10-08T20:00:00Z')
const r = (over: Partial<BidCellHistoryRpcRow>): BidCellHistoryRpcRow => ({
  cell_key: 'price:c1:pb1',
  name_key: 'price:pb1:lav-1',
  kind: 'changed',
  column_name: 'unit_price',
  label: 'Lav-1',
  value: 9800,
  changed_by_name: 'Ann',
  changed_at: '2026-10-08T15:00:00Z',
  rank: 1,
  total: 1,
  ...over,
})

describe('the keys match the SQL', () => {
  it('builds each tab’s cell and name keys', () => {
    expect(priceCellKeys('c1', 'pb1', ' Lav-1 ')).toEqual({ cellKey: 'price:c1:pb1', nameKey: 'price:pb1:lav-1' })
    expect(countCellKeys('c1', 'v1', 'WC')).toEqual({ cellKey: 'count:c1', nameKey: 'count:v1:wc' })
    expect(countCellKeys('c1', null, '')).toEqual({ cellKey: 'count:c1', nameKey: null })
    expect(takeoffCellKeys('l1', 'quantity')).toEqual({ cellKey: 'takeoff:l1:quantity', nameKey: null })
    expect(laborCellKeys('r1', 'rough_in_hrs_per_unit', 'WC')).toEqual({ cellKey: 'labor:r1:rough_in_hrs_per_unit', nameKey: 'labor:wc:rough_in_hrs_per_unit' })
  })
})

describe('bidCellPast', () => {
  it('shows a cell’s two newest earlier values and how many more there are', () => {
    const index = buildBidCellHistoryIndex([
      r({ value: 9800, rank: 2, total: 4, changed_at: '2026-10-06T15:00:00Z' }),
      r({ value: 10300, rank: 1, total: 4, changed_by_name: 'Ben' }),
    ])
    expect(bidCellPast(index, priceCellKeys('c1', 'pb1', 'Lav-1'), NOW)).toEqual({ lines: ['$10,300 · Ben · today', '$9,800 · Ann · Tue'], more: 2, borrowed: false })
  })

  it('shows nothing for a cell with no past', () => {
    const index = buildBidCellHistoryIndex([r({})])
    expect(bidCellPast(index, priceCellKeys('c2', 'pb1', 'WC-1'), NOW)).toBeNull()
  })

  it('a new row with no past borrows the value an earlier row of its name had when removed', () => {
    const index = buildBidCellHistoryIndex([r({ kind: 'removed', cell_key: 'price:old:pb1', value: 9800, changed_at: '2026-10-07T15:00:00Z' })])
    expect(bidCellPast(index, priceCellKeys('new', 'pb1', 'lav-1'), NOW)).toEqual({ lines: ['an earlier Lav-1 row · $9,800 · removed Wed'], more: 0, borrowed: true })
    expect(bidCellPast(index, priceCellKeys('new', 'pb2', 'Lav-1'), NOW)).toBeNull()
  })

  it('its own past wins over a borrowed one', () => {
    const index = buildBidCellHistoryIndex([r({ kind: 'removed', cell_key: 'price:old:pb1', value: 8400 }), r({ value: 9800 })])
    expect(bidCellPast(index, priceCellKeys('c1', 'pb1', 'Lav-1'), NOW)!.borrowed).toBe(false)
  })

  it('words each value by its column: hours, counts', () => {
    const index = buildBidCellHistoryIndex([
      r({ cell_key: 'labor:l1:rough_in_hrs_per_unit', name_key: null, column_name: 'rough_in_hrs_per_unit', value: 1.5 }),
      r({ cell_key: 'count:c1', name_key: null, column_name: 'count', value: 4 }),
    ])
    expect(bidCellPast(index, laborCellKeys('l1', 'rough_in_hrs_per_unit'), NOW)!.lines).toEqual(['1.5 h · Ann · today'])
    expect(bidCellPast(index, countCellKeys('c1', 'v1'), NOW)!.lines).toEqual(['4 · Ann · today'])
  })
})

describe('bidCellDay', () => {
  it('today, a weekday within the week, else a date, in Texas time', () => {
    expect(bidCellDay('2026-10-08T15:00:00Z', NOW)).toBe('today')
    expect(bidCellDay('2026-10-05T15:00:00Z', NOW)).toBe('Mon')
    expect(bidCellDay('2026-09-29T15:00:00Z', NOW)).toBe('Sep 29')
    expect(bidCellDay('2026-10-08T03:00:00Z', NOW)).toBe('Wed')
  })
})
