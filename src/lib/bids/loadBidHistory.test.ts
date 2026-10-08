import { describe, expect, it } from 'vitest'
import { makeFakeRowCapSupabase } from '../../test/fakeRowCapSupabase'
import { loadBidHistory } from './loadBidHistory'
import { BID_HISTORY_PAGE } from './bidHistory'
import { loadBidCellHistory } from '../../hooks/useBidHistoryCells'

// The reads behind bid history, against a client that caps an unranged read at 1,000 rows with
// no error, as PostgREST does (docs/TROUBLESHOOTING.md [row-cap]). Made-up rows.
const historyRows = (n: number) => Array.from({ length: n }, (_, i) => ({
  source: 'ledger', id: n - i, archive_id: null, bid_id: 'bid-1', bid_number: 'B900', table_name: 'bids_count_rows', record_id: `r${i}`,
  count_row_id: null, op: 'insert', changed: ['count'], old_values: null, new_values: { count: 1 }, label: `Row ${i + 1}`,
  changed_by: 'u-ann', changed_by_name: 'Ann', changed_at: new Date(Date.UTC(2026, 9, 8) - i * 60_000).toISOString(), action: null, by_app: null,
}))
const cellRows = (n: number) => Array.from({ length: n }, (_, i) => ({
  cell_key: `count:c${String(i).padStart(5, '0')}`, name_key: null, kind: 'changed', column_name: 'count', label: `Row ${i + 1}`, value: i,
  changed_by_name: 'Ann', changed_at: '2026-10-08T15:00:00Z', rank: 1, total: 1,
}))

describe('loadBidHistory', () => {
  it('reads one page a call, by range, so row 1,001 is a second page and not lost', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ 'rpc:list_bid_history': historyRows(1001) })
    const first = await loadBidHistory('bid-1', 0, client)
    const second = await loadBidHistory('bid-1', BID_HISTORY_PAGE, client)
    expect(calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999]])
    expect(first).toHaveLength(1000)
    expect(second.map((r) => r.label)).toEqual(['Row 1001'])
  })

  it('throws the read’s error', async () => {
    const { client } = makeFakeRowCapSupabase({ 'rpc:list_bid_history': historyRows(3) }, { failOnCall: 1, failWith: { message: 'no such function' } })
    await expect(loadBidHistory('bid-1', 0, client)).rejects.toThrow('no such function')
  })
})

describe('loadBidCellHistory', () => {
  it('reads every page, so a bid with 1,001 cell rows draws all of them', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ 'rpc:latest_bid_cell_history': cellRows(1001) })
    const rows = await loadBidCellHistory('bid-1', client)
    expect(calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999]])
    expect(rows).toHaveLength(1001)
    expect(rows[1000]!.cell_key).toBe('count:c01000')
  })

  it('one short page is one read', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ 'rpc:latest_bid_cell_history': cellRows(12) })
    expect(await loadBidCellHistory('bid-1', client)).toHaveLength(12)
    expect(calls).toHaveLength(1)
  })
})
