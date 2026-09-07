import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The Mercury relation reads every Banking, Jobs and People surface shares:
 * job splits and person/user attributions, either for a fixed id list
 * (chunked `.in()`, each chunk paged) or the whole table (paged). The paging
 * helpers have their own suite; this pins what this module adds — the 200-id
 * chunk, the query shapes, the per-chunk paging, the retry labels, and that a
 * failure throws rather than reading as "no relations" (J33-N1).
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => { data: unknown; error: { message: string } | null } = () => ({ data: [], error: null })
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(route(table, steps))
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
const labels: string[] = []
vi.mock('../utils/errorHandling', async (orig) => ({
  ...(await orig<typeof import('../utils/errorHandling')>()),
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>, label: string) => {
    labels.push(label)
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))

import {
  fetchAllAttributions,
  fetchAllJobAllocations,
  fetchAttributionsByMercuryTxIds,
  fetchJobAllocationsByMercuryTxIds,
  MERCURY_TRANSACTION_ID_IN_CHUNK_SIZE,
} from './fetchMercuryRelationsByTxIds'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const inChunk = (steps: Step[]) => argsOf(steps, 'in')[0]?.[1] as string[] | undefined
const rangeOf = (steps: Step[]) => argsOf(steps, 'range')[0] as [number, number]
const ids = (n: number) => Array.from({ length: n }, (_, i) => `tx-${i}`)
const alloc = (tx: string, n = 1) => Array.from({ length: n }, (_, i) => ({ mercury_transaction_id: tx, job_id: `j${i}`, amount: 1, note: null }))

beforeEach(() => {
  queries.length = 0
  labels.length = 0
  route = () => ({ data: [], error: null })
})

describe('fetchJobAllocationsByMercuryTxIds', () => {
  it('reads in 200-id chunks — each chunk its own paged, id-ordered query with the split columns — and concatenates in chunk order', async () => {
    expect(MERCURY_TRANSACTION_ID_IN_CHUNK_SIZE).toBe(200)
    route = (_t, steps) => ({ data: alloc(inChunk(steps)![0]!), error: null })
    const rows = await fetchJobAllocationsByMercuryTxIds(ids(201), 'Banking master list')
    expect(queries.map((q) => q.table)).toEqual(['mercury_transaction_job_allocations', 'mercury_transaction_job_allocations'])
    expect(queries.map((q) => inChunk(q.steps)!.length)).toEqual([200, 1])
    expect(inChunk(queries[1]!.steps)).toEqual(['tx-200'])
    const s = queries[0]!.steps
    expect(argsOf(s, 'select')).toEqual([['mercury_transaction_id, job_id, amount, note']])
    expect(argsOf(s, 'in')[0]![0]).toBe('mercury_transaction_id')
    expect(argsOf(s, 'order')).toEqual([['mercury_transaction_id'], ['id']])
    expect(rangeOf(s)).toEqual([0, 999])
    expect(rows.map((r) => r.mercury_transaction_id)).toEqual(['tx-0', 'tx-200'])
    expect(labels).toEqual(['Banking master list mercury_transaction_job_allocations', 'Banking master list mercury_transaction_job_allocations'])
  })

  it('a full 1000-row page for one chunk asks for the next page of that same chunk before moving on; a short page ends the chunk', async () => {
    route = (_t, steps) => {
      const [from] = rangeOf(steps)
      const chunk = inChunk(steps)!
      if (chunk[0] === 'tx-0') return { data: from === 0 ? alloc('tx-0', 1000) : alloc('tx-1', 3), error: null }
      return { data: alloc('tx-200'), error: null }
    }
    const rows = await fetchJobAllocationsByMercuryTxIds(ids(201), 'op')
    expect(queries.map((q) => [inChunk(q.steps)![0], ...rangeOf(q.steps)])).toEqual([
      ['tx-0', 0, 999],
      ['tx-0', 1000, 1999],
      ['tx-200', 0, 999],
    ])
    expect(rows).toHaveLength(1004)
  })

  it('no ids → no read; a null page reads as no rows; a failed page throws instead of reading as "no splits"', async () => {
    expect(await fetchJobAllocationsByMercuryTxIds([], 'op')).toEqual([])
    expect(queries).toEqual([])
    route = () => ({ data: null, error: null })
    expect(await fetchJobAllocationsByMercuryTxIds(['tx-0'], 'op')).toEqual([])
    route = () => ({ data: null, error: { message: 'Failed to fetch' } })
    await expect(fetchJobAllocationsByMercuryTxIds(['tx-0'], 'op')).rejects.toThrow('Failed to fetch')
  })
})

describe('fetchAttributionsByMercuryTxIds', () => {
  it('same chunking and paging with the attribution columns, ordered by transaction only, under its own label', async () => {
    route = (_t, steps) => ({ data: inChunk(steps)!.map((tx) => ({ mercury_transaction_id: tx, person_id: 'p1', user_id: null })), error: null })
    const rows = await fetchAttributionsByMercuryTxIds(ids(401), 'Wheels')
    expect(queries.map((q) => q.table)).toEqual(Array(3).fill('mercury_transaction_attributions'))
    expect(queries.map((q) => inChunk(q.steps)!.length)).toEqual([200, 200, 1])
    const s = queries[0]!.steps
    expect(argsOf(s, 'select')).toEqual([['mercury_transaction_id, person_id, user_id']])
    expect(argsOf(s, 'order')).toEqual([['mercury_transaction_id']])
    expect(rangeOf(s)).toEqual([0, 999])
    expect(rows).toHaveLength(401)
    expect(new Set(labels)).toEqual(new Set(['Wheels mercury_transaction_attributions']))
  })
})

describe('whole-table reads', () => {
  it('fetchAllJobAllocations pages the entire table with no id filter and stops at a short page', async () => {
    route = (_t, steps) => ({ data: rangeOf(steps)[0] === 0 ? alloc('a', 1000) : alloc('b', 60), error: null })
    const rows = await fetchAllJobAllocations('Visuals')
    expect(rows).toHaveLength(1060)
    expect(queries.map((q) => [q.table, ...rangeOf(q.steps)])).toEqual([
      ['mercury_transaction_job_allocations', 0, 999],
      ['mercury_transaction_job_allocations', 1000, 1999],
    ])
    expect(argsOf(queries[0]!.steps, 'in')).toEqual([])
    expect(argsOf(queries[0]!.steps, 'order')).toEqual([['mercury_transaction_id'], ['id']])
    expect(labels).toEqual(['Visuals mercury_transaction_job_allocations (all)', 'Visuals mercury_transaction_job_allocations (all)'])
  })

  it('fetchAllAttributions does the same for attributions; a failed page throws', async () => {
    route = () => ({ data: [{ mercury_transaction_id: 'a', person_id: null, user_id: 'u1' }], error: null })
    expect(await fetchAllAttributions('Accounting')).toHaveLength(1)
    const s = queries[0]!.steps
    expect(argsOf(s, 'select')).toEqual([['mercury_transaction_id, person_id, user_id']])
    expect(argsOf(s, 'in')).toEqual([])
    expect(argsOf(s, 'order')).toEqual([['mercury_transaction_id']])
    expect(labels).toEqual(['Accounting mercury_transaction_attributions (all)'])
    route = () => ({ data: null, error: { message: 'timeout' } })
    await expect(fetchAllAttributions('Accounting')).rejects.toThrow('timeout')
  })
})
