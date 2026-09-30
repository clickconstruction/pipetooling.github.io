import { describe, expect, it } from 'vitest'
import { fetchTallyLinkedMercuryRows, TALLY_LINKED_ROWS_RPC, type TallyRpcClient } from './fetchTallyLinkedMercuryRows'

/** A stub of `supabase.rpc(...).range(...)` that caps an un-ranged read at 1,000 rows, as PostgREST does. */
function makeRpcStub(total: number, opts: { failOnCall?: number } = {}) {
  const rows = Array.from({ length: total }, (_, i) => ({
    mercury_transaction_id: `tx${i}`,
    posted_at: new Date(Date.UTC(2026, 0, 1) - i * 3600_000).toISOString(),
  }))
  const calls: Array<{ rpc: string; range: [number, number] | null }> = []
  const client = {
    rpc: (name: string) => {
      const call = { rpc: name, range: null as [number, number] | null }
      const builder = {
        range: (from: number, to: number) => {
          call.range = [from, to]
          return builder
        },
        then: (resolve: (r: { data: unknown[] | null; error: { message: string } | null }) => unknown) => {
          calls.push(call)
          if (opts.failOnCall === calls.length) return Promise.resolve({ data: null, error: { message: 'boom' } }).then(resolve)
          const slice = call.range ? rows.slice(call.range[0], call.range[1] + 1) : rows.slice(0, 1000)
          return Promise.resolve({ data: slice, error: null }).then(resolve)
        },
      }
      return builder
    },
  } as unknown as TallyRpcClient
  return { client, calls }
}

describe('fetchTallyLinkedMercuryRows', () => {
  it('pages past the 1,000-row cap so a card with 1,400 charges keeps its oldest rows', async () => {
    const { client, calls } = makeRpcStub(1400)
    const rows = await fetchTallyLinkedMercuryRows(client)
    expect(calls.map((c) => c.rpc)).toEqual([TALLY_LINKED_ROWS_RPC, TALLY_LINKED_ROWS_RPC])
    expect(calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999]])
    expect(rows).toHaveLength(1400)
    expect(rows[1399]?.mercury_transaction_id).toBe('tx1399')
  })

  it('reads one page when it comes back short', async () => {
    const { client, calls } = makeRpcStub(40)
    const rows = await fetchTallyLinkedMercuryRows(client)
    expect(calls).toHaveLength(1)
    expect(rows).toHaveLength(40)
  })

  it('throws on a failed page instead of returning a partial list', async () => {
    const { client } = makeRpcStub(1400, { failOnCall: 2 })
    await expect(fetchTallyLinkedMercuryRows(client, 'tally test')).rejects.toThrow()
  })
})
