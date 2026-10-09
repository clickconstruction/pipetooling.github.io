import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { makeFakeRowCapSupabase } from '../../test/fakeRowCapSupabase'
import type { Database } from '../../types/database'
import { loadBidHistory, loadBidRemovedRows, loadBidUndoUnseen, loadCanEditBid, removeBidAddedRows } from './loadBidHistory'
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

const removedRows = (n: number) => Array.from({ length: n }, (_, i) => ({
  archive_id: `ar-${i}`, table_name: 'bids_count_rows', record_id: `c${i}`, count_row_id: `c${i}`, label: `Row ${i + 1}`, old_values: { count: 1 },
  changed: ['count'], changed_by: null, changed_by_name: null, changed_at: new Date(Date.UTC(2026, 9, 8) - i * 60_000).toISOString(), in_ledger: false,
}))

describe('loadBidRemovedRows (PR 5)', () => {
  it('reads every page, so a bid with 1,001 removed rows lists all of them', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ 'rpc:list_bid_removed_rows': removedRows(1001) })
    const rows = await loadBidRemovedRows('bid-1', client)
    expect(calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999]])
    expect(rows).toHaveLength(1001)
    expect(rows[1000]).toMatchObject({ archiveId: 'ar-1000', table: 'bids_count_rows', inLedger: false })
  })

  it('someone who cannot edit the bid, or a database without the function yet, gets none', async () => {
    for (const failWith of [{ code: '42501', message: 'Only someone who can edit this bid sees what was removed from it.' }, { code: 'PGRST202', message: 'Could not find the function public.list_bid_removed_rows(p_bid_id)' }]) {
      const { client } = makeFakeRowCapSupabase({ 'rpc:list_bid_removed_rows': removedRows(3) }, { failOnCall: 1, failWith })
      expect(await loadBidRemovedRows('bid-1', client)).toEqual([])
    }
  })

  it('any other failure throws', async () => {
    const { client } = makeFakeRowCapSupabase({ 'rpc:list_bid_removed_rows': removedRows(3) }, { failOnCall: 1, failWith: { message: 'canceling statement due to statement timeout', code: '57014' } })
    await expect(loadBidRemovedRows('bid-1', client)).rejects.toThrow('statement timeout')
  })
})

/** A client whose one delete per request records its table, ids and headers, and answers with the ids it removes. */
function deleteStub(opts: { keep?: ReadonlySet<string>; error?: string } = {}) {
  const calls: Array<{ table: string; ids: string[]; headers: Record<string, string> }> = []
  const client = {
    from(table: string) {
      const call = { table, ids: [] as string[], headers: {} as Record<string, string> }
      const b = {
        delete: () => b,
        in: (_col: string, ids: string[]) => { call.ids = ids; return b },
        select: () => b,
        setHeader: (name: string, value: string) => { call.headers[name] = value; return b },
        then: (resolve: (v: unknown) => void) => {
          calls.push(call)
          resolve(opts.error ? { data: null, error: { message: opts.error } } : { data: call.ids.filter((id) => !opts.keep?.has(id)).map((id) => ({ id })), error: null })
        },
      }
      return b
    },
  }
  return { client: client as unknown as SupabaseClient<Database>, calls }
}

describe('removeBidAddedRows (PR 6)', () => {
  it('removes by id, 100 a request, each tagged put-back, and says how many went', async () => {
    const ids = Array.from({ length: 230 }, (_, i) => `c${i}`)
    const { client, calls } = deleteStub({ keep: new Set(['c5']) })
    expect(await removeBidAddedRows('bids_count_rows', ids, client)).toBe(229)
    expect(calls.map((c) => [c.table, c.ids.length])).toEqual([['bids_count_rows', 100], ['bids_count_rows', 100], ['bids_count_rows', 30]])
    expect(calls.every((c) => c.headers['x-bid-action'] === 'put-back')).toBe(true)
  })

  it('throws the refusal', async () => {
    const { client } = deleteStub({ error: 'new row violates row-level security policy' })
    await expect(removeBidAddedRows('bids_count_rows', ['c1'], client)).rejects.toThrow('row-level security')
  })
})

describe('loadCanEditBid (PR 6)', () => {
  const rpcStub = (answer: { data: unknown; error: unknown }) => ({ rpc: async () => answer }) as unknown as SupabaseClient<Database>
  it('is yes only when the function says so, and a failed read is a no', async () => {
    expect(await loadCanEditBid('bid-1', rpcStub({ data: true, error: null }))).toBe(true)
    expect(await loadCanEditBid('bid-1', rpcStub({ data: false, error: null }))).toBe(false)
    expect(await loadCanEditBid('bid-1', rpcStub({ data: null, error: { message: 'no such function' } }))).toBe(false)
  })
})

describe('loadBidUndoUnseen (PR 6)', () => {
  /** Each table answers the rows that name the asked ids. */
  function selectStub(rows: Record<string, Array<Record<string, unknown>>>, failOn?: string) {
    const asked: string[] = []
    const client = {
      from(table: string) {
        let col = ''
        let ids: string[] = []
        const eqs: Array<[string, unknown]> = []
        const b = {
          select: (c: string) => { col = c; return b },
          in: (_c: string, v: string[]) => { ids = v; return b },
          eq: (c: string, v: unknown) => { eqs.push([c, v]); return b },
          then: (resolve: (v: unknown) => void) => {
            asked.push(`${table}.${col}:${ids.length}${eqs.map(([c, v]) => ` ${c}=${String(v)}`).join('')}`)
            const hit = (r: Record<string, unknown>) => ids.includes(r[col] as string) && eqs.every(([c, v]) => r[c] === v)
            resolve(table === failOn ? { data: null, error: { message: 'permission denied' } } : { data: (rows[table] ?? []).filter(hit), error: null })
          },
        }
        return b
      },
    }
    return { client: client as unknown as SupabaseClient<Database>, asked }
  }

  it('counts each kind per count row, reading every table in chunks of 100', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `c${i}`)
    const { client, asked } = selectStub({
      // An untick, or the chooser's save of a fixture it showed, leaves a row with ticked false: no tick.
      bid_submittal_takeoff_choices: [{ count_row_id: 'c1', ticked: true }, { count_row_id: 'c120', ticked: true }, { count_row_id: 'c7', ticked: false }],
      bid_submittal_items: [{ source_count_row_id: 'c1' }, { source_count_row_id: 'c1' }],
      bid_count_row_submission_hides: [{ count_row_id: 'c-not-asked' }],
    })
    const got = await loadBidUndoUnseen(ids, client)
    expect(asked).toEqual([
      'bid_count_row_submission_hides.count_row_id:100', 'bid_count_row_submission_hides.count_row_id:50',
      'bid_submittal_items.source_count_row_id:100', 'bid_submittal_items.source_count_row_id:50',
      'bid_submittal_takeoff_choices.count_row_id:100 ticked=true', 'bid_submittal_takeoff_choices.count_row_id:50 ticked=true',
      'bids_takeoff_template_mappings.count_row_id:100', 'bids_takeoff_template_mappings.count_row_id:50',
    ])
    expect(Object.fromEntries(got)).toEqual({ c1: { ticks: 1, hides: 0, items: 2, mappings: 0 }, c120: { ticks: 1, hides: 0, items: 0, mappings: 0 } })
  })

  it('throws a failed read, so Undo stays off', async () => {
    const { client } = selectStub({}, 'bid_submittal_items')
    await expect(loadBidUndoUnseen(['c1'], client)).rejects.toThrow('permission denied')
  })
})
