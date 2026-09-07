import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Bid Board unread-note badges: per bid, the count of bid-submission notes and
 * customer-contact notes written by OTHER people after the viewer's last-seen
 * watermarks. The pure count and the three-read fetch that feeds it.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string) => unknown = () => []
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') {
              return (resolve: (v: { data: unknown; error: null }) => void, reject: (e: unknown) => void) => {
                try {
                  resolve({ data: route(table), error: null })
                } catch (e) {
                  reject(e)
                }
              }
            }
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: null }>) => (await op()).data,
}))

import { computeBidBoardNotesUnreadCounts, fetchBidBoardNotesUnreadCounts } from './bidBoardNotesUnreadCounts'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const bids = [
  { id: 'b1', customer_id: 'c1' },
  { id: 'b2', customer_id: 'c1' }, // same customer: shares its contact notes
  { id: 'b3', customer_id: null },
]

beforeEach(() => {
  queries.length = 0
  route = () => []
})

describe('computeBidBoardNotesUnreadCounts', () => {
  it('counts notes by other people after each watermark; no watermark means everything is unread; own notes never count', () => {
    const counts = computeBidBoardNotesUnreadCounts(
      'me',
      bids,
      [{ bid_id: 'b1', last_seen_bid_submission_at: '2026-09-05T00:00:00Z', last_seen_customer_contact_at: null }],
      [
        { bid_id: 'b1', created_at: '2026-09-06T00:00:00Z', created_by: 'ana' }, // after the watermark: unread
        { bid_id: 'b1', created_at: '2026-09-04T00:00:00Z', created_by: 'ana' }, // before: read
        { bid_id: 'b1', created_at: '2026-09-05T00:00:00Z', created_by: 'ana' }, // exactly at the watermark: read
        { bid_id: 'b1', created_at: '2026-09-07T00:00:00Z', created_by: 'me' }, // mine: never counted
        { bid_id: 'b1', created_at: '2026-09-07T00:00:00Z', created_by: null }, // no author: skipped
        { bid_id: 'b1', created_at: null, created_by: 'ana' }, // no time: skipped
        { bid_id: 'b3', created_at: '2026-01-01T00:00:00Z', created_by: 'ana' }, // b3 has no read state: unread
        { bid_id: 'stranger', created_at: '2026-01-01T00:00:00Z', created_by: 'ana' }, // not on the board: ignored
      ],
      [],
    )
    expect(counts).toEqual({ b1: 1, b2: 0, b3: 1 })
  })
  it('customer-contact notes count once per bid of that customer, against each bid’s own contact watermark', () => {
    const counts = computeBidBoardNotesUnreadCounts(
      'me',
      bids,
      [{ bid_id: 'b2', last_seen_bid_submission_at: null, last_seen_customer_contact_at: '2026-09-06T00:00:00Z' }],
      [],
      [
        { customer_id: 'c1', created_at: '2026-09-05T00:00:00Z', created_by: 'ana' }, // b1 unread (no watermark), b2 read
        { customer_id: 'c1', created_at: '2026-09-07T00:00:00Z', created_by: 'bob' }, // both unread
        { customer_id: 'c1', created_at: '2026-09-07T00:00:00Z', created_by: 'me' },
        { customer_id: 'c9', created_at: '2026-09-07T00:00:00Z', created_by: 'ana' }, // no bid for that customer
      ],
    )
    expect(counts).toEqual({ b1: 2, b2: 1, b3: 0 })
  })
  it('adds the two kinds and gives every bid a number, even with nothing to count', () => {
    expect(computeBidBoardNotesUnreadCounts('me', bids, [], [], [])).toEqual({ b1: 0, b2: 0, b3: 0 })
    expect(
      computeBidBoardNotesUnreadCounts('me', bids, [], [{ bid_id: 'b1', created_at: '2026-09-01T00:00:00Z', created_by: 'ana' }], [{ customer_id: 'c1', created_at: '2026-09-01T00:00:00Z', created_by: 'ana' }]),
    ).toEqual({ b1: 2, b2: 1, b3: 0 })
    expect(computeBidBoardNotesUnreadCounts('me', [], [], [], [])).toEqual({})
  })
})

describe('fetchBidBoardNotesUnreadCounts', () => {
  it('asks nothing without a viewer or bids, otherwise reads the viewer’s read state, the submission entries and the contacts for the bids’ customers', async () => {
    expect(await fetchBidBoardNotesUnreadCounts('', bids)).toEqual({})
    expect(await fetchBidBoardNotesUnreadCounts('me', [])).toEqual({})
    expect(queries).toHaveLength(0)

    route = (table) => {
      if (table === 'user_bid_notes_read_state') return [{ bid_id: 'b1', last_seen_bid_submission_at: '2026-09-05T00:00:00Z', last_seen_customer_contact_at: null }]
      if (table === 'bids_submission_entries') return [{ bid_id: 'b1', created_at: '2026-09-06T00:00:00Z', created_by: 'ana' }]
      if (table === 'customer_contacts') return [{ customer_id: 'c1', created_at: '2026-09-06T00:00:00Z', created_by: 'ana' }]
      return []
    }
    const counts = await fetchBidBoardNotesUnreadCounts('me', [...bids, { id: 'b1', customer_id: 'c1' }]) // duplicate bid rows are folded
    const rs = queries.find((q) => q.table === 'user_bid_notes_read_state')!
    expect(argsOf(rs.steps, 'eq')).toEqual([['user_id', 'me']])
    expect(argsOf(rs.steps, 'in')).toEqual([['bid_id', ['b1', 'b2', 'b3']]])
    expect(argsOf(queries.find((q) => q.table === 'bids_submission_entries')!.steps, 'in')).toEqual([['bid_id', ['b1', 'b2', 'b3']]])
    expect(argsOf(queries.find((q) => q.table === 'customer_contacts')!.steps, 'in')).toEqual([['customer_id', ['c1']]])
    expect(counts).toEqual({ b1: 2, b2: 1, b3: 0 })
  })
  it('skips the contacts read when no bid has a customer, and treats null results as empty', async () => {
    route = () => null
    expect(await fetchBidBoardNotesUnreadCounts('me', [{ id: 'b3', customer_id: null }, { id: 'b4', customer_id: '' }])).toEqual({ b3: 0, b4: 0 })
    expect(queries.map((q) => q.table)).toEqual(['user_bid_notes_read_state', 'bids_submission_entries'])
  })
  it('a failed read throws to the caller', async () => {
    route = (table) => {
      if (table === 'bids_submission_entries') throw new Error('rls')
      return []
    }
    await expect(fetchBidBoardNotesUnreadCounts('me', bids)).rejects.toThrow('rls')
  })
})
