import { describe, expect, it } from 'vitest'
import type { BidHistoryRow } from './bidHistory'
import {
  bidPutBackDoneWords,
  bidPutBackFailWords,
  bidPutBackLabel,
  bidPutBackTarget,
  bidRemovalKey,
  bidRemovedPutBackLabel,
  bidRemovedPutBackTarget,
  bidRemovedRowFromRpc,
  bidRestoreDoneWords,
  mergeBidRemovedRows,
  type BidPutBackResult,
  type BidRemovedRow,
  type BidRestoreResult,
} from './bidHistoryPutBack'

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

// PR 5: a removed row. The ledger's delete and the archive's row of one delete share the table,
// the row and the transaction's time, which PostgREST may write with or without the zone's "Z".
const removed = (over: Partial<BidRemovedRow>): BidRemovedRow => ({
  archiveId: 'ar-1', table: 'bids_count_rows', recordId: 'c-sump', countRowId: 'c-sump', label: 'SUMP', oldValues: { fixture: 'SUMP', count: 2 },
  changed: ['count', 'fixture'], changedBy: 'u-ann', changedByName: 'Ann', changedAt: '2026-10-08T15:00:00.123+00:00', inLedger: true,
  ...over,
})
const removal = (over: Partial<BidHistoryRow>) => row({ table: 'bids_count_rows', recordId: 'c-sump', countRowId: 'c-sump', op: 'delete', changed: ['count', 'fixture'], oldValues: { fixture: 'SUMP', count: 2 }, newValues: null, label: 'SUMP', changedAt: '2026-10-08T15:00:00.123Z', ...over })
const restored = (over: Partial<BidRestoreResult>): BidRestoreResult => ({ ok: true, bid_id: 'bid-1', restored: 1, tables: { bids_count_rows: 1 }, warnings: [], ...over })

describe('bidRemovedRowFromRpc', () => {
  it('reads the function’s row', () => {
    expect(bidRemovedRowFromRpc({
      archive_id: 'ar-9', table_name: 'cost_estimate_labor_rows', record_id: 'l-1', count_row_id: null, label: 'WC-2', old_values: { fixture: 'WC-2' },
      changed: null, changed_by: null, changed_by_name: null, changed_at: '2026-09-30T10:00:00Z', in_ledger: null,
    })).toEqual({
      archiveId: 'ar-9', table: 'cost_estimate_labor_rows', recordId: 'l-1', countRowId: null, label: 'WC-2', oldValues: { fixture: 'WC-2' },
      changed: [], changedBy: null, changedByName: null, changedAt: '2026-09-30T10:00:00Z', inLedger: false,
    })
  })
})

describe('mergeBidRemovedRows', () => {
  const bid = { id: 'bid-1', bidNumber: 'B494' }
  const ledgerRows = [row({ changedAt: '2026-10-08T16:00:00.000Z' }), removal({})]

  it('pairs a removal the ledger holds with its archive row, and adds none for it', () => {
    const m = mergeBidRemovedRows(ledgerRows, [removed({})], bid, false)
    expect(m.rows).toHaveLength(2)
    expect(m.restorable.get(bidRemovalKey('bids_count_rows', 'c-sump', '2026-10-08T15:00:00.123Z'))).toBe('ar-1')
  })

  it('adds a removal from before the ledger as an archive line, newest first', () => {
    const m = mergeBidRemovedRows(ledgerRows, [removed({ archiveId: 'ar-old', table: 'cost_estimate_labor_rows', recordId: 'l-1', countRowId: null, label: 'WC-2', changedAt: '2026-09-30T10:00:00Z', inLedger: false })], bid, false)
    expect(m.rows.map((r) => `${r.source}:${r.label}`)).toEqual(['ledger:Lav-1', 'ledger:SUMP', 'archive:WC-2'])
    expect(m.rows[2]).toMatchObject({ source: 'archive', id: null, archiveId: 'ar-old', bidId: 'bid-1', bidNumber: 'B494', op: 'delete', newValues: null, action: null })
  })

  it('never adds an archive line the history already holds (a dev reads it there)', () => {
    const devRow = row({ source: 'archive', id: null, archiveId: 'ar-old', op: 'delete', changedAt: '2026-09-30T10:00:00Z' })
    const m = mergeBidRemovedRows([...ledgerRows, devRow], [removed({ archiveId: 'ar-old', changedAt: '2026-09-30T10:00:00Z', inLedger: false })], bid, false)
    expect(m.rows.filter((r) => r.archiveId === 'ar-old')).toHaveLength(1)
  })

  it('while older pages remain, an archive line older than the oldest row read waits for them', () => {
    const old = removed({ archiveId: 'ar-old', changedAt: '2026-09-30T10:00:00Z', inLedger: false })
    expect(mergeBidRemovedRows(ledgerRows, [old], bid, true).rows).toHaveLength(2)
    expect(mergeBidRemovedRows(ledgerRows, [old], bid, false).rows).toHaveLength(3)
    const recent = removed({ archiveId: 'ar-new', changedAt: '2026-10-08T15:30:00Z', inLedger: false })
    expect(mergeBidRemovedRows(ledgerRows, [recent], bid, true).rows).toHaveLength(3)
  })
})

describe('bidRemovedPutBackTarget', () => {
  const restorable = new Map([[bidRemovalKey('bids_count_rows', 'c-sump', '2026-10-08T15:00:00.123+00:00'), 'ar-1']])

  it('a removal the ledger holds puts back its archive row', () => {
    const t = bidRemovedPutBackTarget(removal({}), 'bid-1', restorable)
    expect(t).toEqual({ archiveId: 'ar-1', what: 'SUMP' })
    expect(bidRemovedPutBackLabel(t!)).toBe('Put back SUMP')
  })

  it('an archive line puts back its own row', () => {
    expect(bidRemovedPutBackTarget(removal({ source: 'archive', id: null, archiveId: 'ar-7', label: null }), 'bid-1', new Map())).toEqual({ archiveId: 'ar-7', what: 'The removed row' })
  })

  it('offers none for an addition, a changed value, another bid’s row, the bid itself, or a removal with nothing left to put back', () => {
    expect(bidRemovedPutBackTarget(removal({ op: 'insert' }), 'bid-1', restorable)).toBeNull()
    expect(bidRemovedPutBackTarget(removal({ op: 'update' }), 'bid-1', restorable)).toBeNull()
    expect(bidRemovedPutBackTarget(removal({ bidId: 'bid-0' }), 'bid-1', restorable)).toBeNull()
    expect(bidRemovedPutBackTarget(removal({ table: 'bids', recordId: 'bid-1' }), 'bid-1', restorable)).toBeNull()
    expect(bidRemovedPutBackTarget(removal({ changedAt: '2026-10-08T15:00:01Z' }), 'bid-1', restorable)).toBeNull()
  })

  it('a row whose count row was removed with it waits for that count row’s Put back', () => {
    const price = removal({ table: 'bid_count_row_custom_prices', recordId: 'p-1', countRowId: 'c-sump' })
    const both = new Map([...restorable, [bidRemovalKey('bid_count_row_custom_prices', 'p-1', '2026-10-08T15:00:00.123Z'), 'ar-2']])
    expect(bidRemovedPutBackTarget(price, 'bid-1', both, new Set(['c-sump']))).toBeNull()
    expect(bidRemovedPutBackTarget(price, 'bid-1', both)).toEqual({ archiveId: 'ar-2', what: 'SUMP' })
    expect(bidRemovedPutBackTarget(removal({}), 'bid-1', both, new Set(['c-sump']))).toEqual({ archiveId: 'ar-1', what: 'SUMP' })
  })
})

describe('bidRestoreDoneWords', () => {
  const t = { archiveId: 'ar-1', what: 'SUMP' }
  it('says what came back, and what hung on it', () => {
    expect(bidRestoreDoneWords(t, restored({}))).toBe('SUMP is back.')
    expect(bidRestoreDoneWords(t, restored({ restored: 4 }))).toBe('SUMP is back, with 3 rows that hung on it.')
    expect(bidRestoreDoneWords(t, restored({ restored: 2 }))).toBe('SUMP is back, with 1 row that hung on it.')
  })
  it('says when a field came back empty because what it pointed at is gone', () => {
    expect(bidRestoreDoneWords(t, restored({ warnings: ['bids_count_rows.bid_version_id cleared'] }))).toBe('SUMP is back. One field pointed at a row that is gone, so it is empty now.')
    expect(bidRestoreDoneWords(t, restored({ restored: 2, warnings: ['a', 'b'] }))).toBe('SUMP is back, with 1 row that hung on it. 2 fields pointed at rows that are gone, so they are empty now.')
  })
  it('a refusal reads as the function wrote it', () => {
    expect(bidPutBackFailWords('Its count row was removed too. Put that back first.')).toBe('Its count row was removed too. Put that back first.')
    expect(bidPutBackFailWords('function public.restore_bid_removed_row(uuid) does not exist')).toBe('Put back is not ready yet. Try again after the next update.')
  })
})
