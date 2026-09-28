import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { loadBidEntryRecency } from './bidEntryRecency'

type Entry = { id: string; bid_id: string; occurred_at: string; contact_method: string | null }

/**
 * Fake client that mimics PostgREST's silent `max_rows` cap: un-ranged queries return at most
 * 1000 rows with NO error, ranged queries slice. (Same shape as `countRowTallies.test.ts`.)
 */
function makeFakeSupabase(entries: Entry[], failOnCall?: number) {
  const calls: Array<{ table: string; ranged: boolean; inSize: number; orders: string[] }> = []
  function builder(table: string) {
    let range: [number, number] | null = null
    let inFilter: [string, unknown[]] | null = null
    const orders: string[] = []
    const b = {
      select: () => b,
      in: (col: string, vals: unknown[]) => { inFilter = [col, vals]; return b },
      order: (col: string) => { orders.push(col); return b },
      range: (from: number, to: number) => { range = [from, to]; return b },
      then: (resolve: (r: { data: unknown[] | null; error: { message: string } | null }) => unknown, reject?: (e: unknown) => unknown) => {
        calls.push({ table, ranged: range != null, inSize: inFilter?.[1].length ?? 0, orders })
        if (failOnCall === calls.length) return Promise.resolve({ data: null, error: { message: 'timeout' } }).then(resolve, reject)
        let rows = entries as Array<Record<string, unknown>>
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

const day = (n: number) => `2026-${String(1 + Math.floor(n / 28)).padStart(2, '0')}-${String(1 + (n % 28)).padStart(2, '0')}T12:00:00Z`

// 200 bids × 12 entries = 2,400 rows — more than twice the cap. Each bid's newest entry is a
// note (no method); its newest contact is the one before it. Sorted by bid_id then id.
const bidIds = Array.from({ length: 200 }, (_, i) => `bid-${String(i).padStart(3, '0')}`)
const entries: Entry[] = bidIds.flatMap((bid_id, b) =>
  Array.from({ length: 12 }, (_, j) => ({ id: `e-${String(b).padStart(3, '0')}-${String(j).padStart(2, '0')}`, bid_id, occurred_at: day(j), contact_method: j === 11 ? null : 'phone' })),
)

describe('loadBidEntryRecency', () => {
  it('pages past the 1000-row cap so every bid keeps its newest entry', async () => {
    const { client, calls } = makeFakeSupabase(entries)
    const out = await loadBidEntryRecency(client, bidIds)
    expect(Object.keys(out.lastActivityByBid)).toHaveLength(200)
    expect(Object.keys(out.lastContactByBid)).toHaveLength(200)
    for (const id of bidIds) {
      expect(out.lastActivityByBid[id]).toBe(day(11))
      expect(out.lastContactByBid[id]).toBe(day(10))
    }
    expect(calls.every((c) => c.ranged)).toBe(true)
  })

  it('the old un-ranged read would have lost most of them', () => {
    const capped = entries.slice(0, 1000)
    expect(new Set(capped.map((e) => e.bid_id)).size).toBeLessThan(200)
  })

  it('asks in chunks of 150 bids, each in a stable order', async () => {
    const { client, calls } = makeFakeSupabase(entries)
    await loadBidEntryRecency(client, bidIds)
    expect(new Set(calls.map((c) => c.inSize))).toEqual(new Set([150, 50]))
    expect(calls.every((c) => c.table === 'bids_submission_entries')).toBe(true)
    expect(calls.every((c) => c.orders.join(',') === 'bid_id,id')).toBe(true)
    // chunk 1: 150 bids × 12 = 1,800 rows → two pages; chunk 2: 50 × 12 = 600 → one
    expect(calls).toHaveLength(3)
  })

  it('reads only the bids in hand', async () => {
    const { client } = makeFakeSupabase(entries)
    const out = await loadBidEntryRecency(client, ['bid-003', 'bid-150'])
    expect(Object.keys(out.lastActivityByBid).sort()).toEqual(['bid-003', 'bid-150'])
  })

  it('a bid with notes only has activity and no contact', async () => {
    const { client } = makeFakeSupabase([{ id: 'e-1', bid_id: 'bid-x', occurred_at: day(3), contact_method: null }])
    const out = await loadBidEntryRecency(client, ['bid-x'])
    expect(out.lastActivityByBid['bid-x']).toBe(day(3))
    expect(out.lastContactByBid['bid-x']).toBeUndefined()
  })

  it('no bids, no read', async () => {
    const { client, calls } = makeFakeSupabase(entries)
    expect(await loadBidEntryRecency(client, [])).toEqual({ lastActivityByBid: {}, lastContactByBid: {} })
    expect(calls).toEqual([])
  })

  it('a failed page throws — it is never read as "no entries"', async () => {
    const { client } = makeFakeSupabase(entries, 2)
    await expect(loadBidEntryRecency(client, bidIds)).rejects.toThrow()
  })
})
