import { describe, expect, it } from 'vitest'
import type { BidHistoryRow } from './bidHistory'
import { bidPutBackDoneWords, bidPutBackFailWords, bidPutBackLabel, bidPutBackTarget, type BidPutBackResult } from './bidHistoryPutBack'

// Made-up people and values.
const row = (over: Partial<BidHistoryRow>): BidHistoryRow => ({
  source: 'ledger', id: 7, archiveId: null, bidId: 'bid-1', bidNumber: 'B494', table: 'bid_count_row_custom_prices', recordId: 'p-1',
  countRowId: 'c1', op: 'update', changed: ['unit_price'], oldValues: { unit_price: 9800 }, newValues: { unit_price: 10300 },
  label: 'Lav-1', changedBy: 'u-ann', changedByName: 'Ann', changedAt: '2026-10-08T15:00:00.000Z', action: null, byApp: null,
  ...over,
})
const result = (before: unknown, after: unknown): BidPutBackResult => ({
  table: 'bid_count_row_custom_prices', record_id: 'p-1', label: 'Lav-1', columns: ['unit_price'], before: { unit_price: before }, after: { unit_price: after },
})

describe('bidPutBackTarget', () => {
  it('a changed value on the open bid goes back to its old value', () => {
    const t = bidPutBackTarget(row({}), 'unit_price', 'bid-1')
    expect(t).toEqual({ changeId: 7, column: 'unit_price', what: 'Lav-1 price', value: '$9,800' })
    expect(bidPutBackLabel(t!)).toBe('Put back Lav-1 price to $9,800')
  })

  it('an Edit Bid value reads as the bid’s', () => {
    expect(bidPutBackTarget(row({ table: 'bids', label: null, changed: ['bid_value'], oldValues: { bid_value: 120000 } }), 'bid_value', 'bid-1')!.what).toBe('Bid value')
  })

  it('offers none for an addition, a removal, the archive, an adopted bid, or a column the change never touched', () => {
    expect(bidPutBackTarget(row({ op: 'insert' }), 'unit_price', 'bid-1')).toBeNull()
    expect(bidPutBackTarget(row({ op: 'delete' }), 'unit_price', 'bid-1')).toBeNull()
    expect(bidPutBackTarget(row({ source: 'archive', id: null, archiveId: 'a1' }), 'unit_price', 'bid-1')).toBeNull()
    expect(bidPutBackTarget(row({ bidId: 'bid-0' }), 'unit_price', 'bid-1')).toBeNull()
    expect(bidPutBackTarget(row({}), 'count', 'bid-1')).toBeNull()
    expect(bidPutBackTarget(row({}), undefined, 'bid-1')).toBeNull()
  })
})

describe('the words around it', () => {
  const t = bidPutBackTarget(row({}), 'unit_price', 'bid-1')!
  it('says the value is back, or that it already was', () => {
    expect(bidPutBackDoneWords(t, result(10300, 9800))).toBe('Lav-1 price is $9,800 again.')
    expect(bidPutBackDoneWords(t, result(9800, 9800))).toBe('Lav-1 price was already $9,800.')
  })

  it('passes the function’s own refusals through, and words the rest', () => {
    expect(bidPutBackFailWords('That row was removed since. Put the row back first.')).toBe('That row was removed since. Put the row back first.')
    expect(bidPutBackFailWords('You cannot change this bid, so nothing was put back.')).toBe('You cannot change this bid, so nothing was put back.')
    expect(bidPutBackFailWords('Could not find the function public.put_back_bid_change(p_change_id, p_column) in the schema cache')).toBe('Put back is not ready yet. Try again after the next update.')
    expect(bidPutBackFailWords('new row violates row-level security policy')).toBe('It was not put back: new row violates row-level security policy')
  })
})
