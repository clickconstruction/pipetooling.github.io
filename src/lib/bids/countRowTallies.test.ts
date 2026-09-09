import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { loadCountRowTalliesByBid, tallyRowsByBidId } from './countRowTallies'

/**
 * Fake client that mimics PostgREST's silent `max_rows` cap: un-ranged
 * queries return at most 1000 rows with NO error, ranged queries slice.
 * (Same shape as `src/lib/materials/partsCatalog.test.ts`.)
 */
function makeFakeSupabase(tables: Record<string, Array<Record<string, unknown>>>) {
  const calls: Array<{ table: string; ranged: boolean; inSize: number }> = []
  function builder(table: string) {
    let range: [number, number] | null = null
    let inFilter: [string, unknown[]] | null = null
    const b = {
      select: () => b,
      in: (col: string, vals: unknown[]) => { inFilter = [col, vals]; return b },
      order: () => b,
      range: (from: number, to: number) => { range = [from, to]; return b },
      then: (resolve: (r: { data: unknown[]; error: null }) => unknown, reject?: (e: unknown) => unknown) => {
        calls.push({ table, ranged: range != null, inSize: inFilter?.[1].length ?? 0 })
        let rows = tables[table] ?? []
        if (inFilter) rows = rows.filter((r) => (inFilter![1] as unknown[]).includes(r[inFilter![0]]))
        const data = range ? rows.slice(range[0], range[1] + 1) : rows.slice(0, 1000)
        return Promise.resolve({ data, error: null }).then(resolve, reject)
      },
    }
    return b
  }
  const client = { from: (table: string) => builder(table) } as unknown as SupabaseClient<Database>
  return { client, calls }
}

// 120 bids × 30 count rows = 3,600 rows — one 100-bid chunk alone is 3,000
// rows, three times the cap. Sorted by bid_id then id, like the query orders.
const bidIds = Array.from({ length: 120 }, (_, i) => `bid-${String(i).padStart(3, '0')}`)
const countRows = bidIds.flatMap((bid_id, b) => Array.from({ length: 30 }, (_, j) => ({ id: `row-${b}-${j}`, bid_id })))

describe('tallyRowsByBidId', () => {
  it('counts rows per bid and leaves bids with no rows absent', () => {
    const t = tallyRowsByBidId([{ bid_id: 'a' }, { bid_id: 'b' }, { bid_id: 'a' }])
    expect(t.get('a')).toBe(2)
    expect(t.get('b')).toBe(1)
    expect(t.has('c')).toBe(false)
  })
})

describe('loadCountRowTalliesByBid', () => {
  it('pages past the 1000-row cap so every bid keeps its full count', async () => {
    const { client, calls } = makeFakeSupabase({ bids_count_rows: countRows })
    const tally = await loadCountRowTalliesByBid(client, bidIds)
    expect(tally.size).toBe(120)
    expect(bidIds.every((id) => tally.get(id) === 30)).toBe(true)
    expect(calls.every((c) => c.ranged)).toBe(true)
    // The old un-ranged read would have returned 1,000 of the first chunk's 3,000 rows.
    expect(calls.some((c) => c.inSize > 0)).toBe(true)
    expect(calls.length).toBeGreaterThan(1)
  })

  it('returns an empty map for no ids without touching the client', async () => {
    const { client, calls } = makeFakeSupabase({ bids_count_rows: countRows })
    expect((await loadCountRowTalliesByBid(client, [])).size).toBe(0)
    expect(calls).toHaveLength(0)
  })

  it('reports zero rows for a bid that has none by leaving it absent', async () => {
    const { client } = makeFakeSupabase({ bids_count_rows: countRows })
    const tally = await loadCountRowTalliesByBid(client, ['bid-000', 'bid-none'])
    expect(tally.get('bid-000')).toBe(30)
    expect(tally.get('bid-none')).toBeUndefined()
  })
})
