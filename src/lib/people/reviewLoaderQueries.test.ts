import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseError } from '../../utils/errorHandling'
import { SUPABASE_IN_CHUNK_SIZE, SUPABASE_PAGE_SIZE } from '../supabasePaging'

type Step = { method: string; args: unknown[] }
type Result = { data: unknown; error: { message: string } | null }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => Result = () => ({ data: [], error: null })
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') {
              return (resolve: (v: Result) => void, reject: (e: unknown) => void) => {
                try {
                  resolve(route(table, steps))
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

import { fetchJobStatusesByIds, laborRowJobId, paged, throwIfQueryError } from './reviewLoaderQueries'

const argsOf = (steps: Step[], method: string) => steps.find((s) => s.method === method)?.args

beforeEach(() => {
  queries.length = 0
  route = () => ({ data: [], error: null })
})

describe('throwIfQueryError', () => {
  it('passes a wave with no failures, stubs included', () => {
    expect(() =>
      throwIfQueryError([{ data: [1], error: null }, { data: [] }, { data: null, error: undefined }], 'load review data'),
    ).not.toThrow()
  })

  it('throws a DatabaseError naming the load, with the code and details', () => {
    let caught: unknown
    try {
      throwIfQueryError(
        [{ data: [], error: null }, { data: null, error: { message: 'permission denied', code: '42501', details: 'rls' } }],
        'load review data',
      )
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(DatabaseError)
    const err = caught as DatabaseError
    expect(err.message).toBe('Failed to load review data: permission denied')
    expect(err.code).toBe('42501')
    expect(err.details).toBe('rls')
  })

  it('reports the first failure in the wave', () => {
    expect(() =>
      throwIfQueryError([{ error: { message: 'first' } }, { error: { message: 'second' } }], 'load team review'),
    ).toThrow('Failed to load team review: first')
  })
})

describe('paged', () => {
  it('wraps the rows back into a { data, error } result', async () => {
    const res = await paged(() => Promise.resolve({ data: [{ id: 'a' }, { id: 'b' }], error: null }), 'load rows')
    expect(res).toEqual({ data: [{ id: 'a' }, { id: 'b' }], error: null })
  })

  it('reads a null page as no rows', async () => {
    const res = await paged<{ id: string }>(() => Promise.resolve({ data: null, error: null }), 'load rows')
    expect(res.data).toEqual([])
  })

  it('keeps asking until a short page arrives', async () => {
    const ranges: Array<[number, number]> = []
    const full = Array.from({ length: SUPABASE_PAGE_SIZE }, (_, i) => ({ id: i }))
    const res = await paged((from, to) => {
      ranges.push([from, to])
      return Promise.resolve({ data: from === 0 ? full : [{ id: -1 }], error: null })
    }, 'load rows')
    expect(ranges).toEqual([
      [0, SUPABASE_PAGE_SIZE - 1],
      [SUPABASE_PAGE_SIZE, 2 * SUPABASE_PAGE_SIZE - 1],
    ])
    expect(res.data).toHaveLength(SUPABASE_PAGE_SIZE + 1)
  })

  it('rejects when a page fails — never an empty result', async () => {
    await expect(paged(() => Promise.resolve({ data: null, error: { message: 'timeout' } }), 'load rows')).rejects.toBeInstanceOf(
      DatabaseError,
    )
  })
})

describe('laborRowJobId', () => {
  it('is the sheet’s link', () => {
    expect(laborRowJobId({ job_ledger_id: 'job-1' })).toBe('job-1')
  })

  it('is null without one', () => {
    expect(laborRowJobId({ job_ledger_id: null })).toBeNull()
    expect(laborRowJobId({ job_ledger_id: '' })).toBeNull()
    expect(laborRowJobId({})).toBeNull()
  })
})

describe('fetchJobStatusesByIds', () => {
  let warn: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warn.mockRestore()
  })

  it('asks nothing for no ids', async () => {
    expect((await fetchJobStatusesByIds([])).size).toBe(0)
    expect(queries).toHaveLength(0)
  })

  it('reads id and status from jobs_ledger, ordered by id', async () => {
    route = () => ({ data: [{ id: 'a', status: 'billed' }, { id: 'b', status: 'working' }], error: null })
    const out = await fetchJobStatusesByIds(['a', 'b'])
    expect([...out]).toEqual([
      ['a', 'billed'],
      ['b', 'working'],
    ])
    expect(queries).toHaveLength(1)
    expect(queries[0]!.table).toBe('jobs_ledger')
    expect(argsOf(queries[0]!.steps, 'select')).toEqual(['id, status'])
    expect(argsOf(queries[0]!.steps, 'in')).toEqual(['id', ['a', 'b']])
    expect(argsOf(queries[0]!.steps, 'order')).toEqual(['id'])
    expect(argsOf(queries[0]!.steps, 'range')).toEqual([0, SUPABASE_PAGE_SIZE - 1])
  })

  it('leaves out a job with no status', async () => {
    route = () => ({ data: [{ id: 'a', status: null }, { id: 'b', status: 'paid' }], error: null })
    const out = await fetchJobStatusesByIds(['a', 'b'])
    expect([...out]).toEqual([['b', 'paid']])
  })

  it('asks in chunks for a long list', async () => {
    const ids = Array.from({ length: SUPABASE_IN_CHUNK_SIZE + 1 }, (_, i) => `job-${i}`)
    route = (_table, steps) => {
      const chunk = (argsOf(steps, 'in')?.[1] ?? []) as string[]
      return { data: chunk.map((id) => ({ id, status: 'working' })), error: null }
    }
    const out = await fetchJobStatusesByIds(ids)
    expect(queries).toHaveLength(2)
    expect(out.size).toBe(SUPABASE_IN_CHUNK_SIZE + 1)
  })

  it('fails soft: a failed read is an empty map and a warning', async () => {
    route = () => ({ data: null, error: { message: 'permission denied' } })
    const out = await fetchJobStatusesByIds(['a'])
    expect(out.size).toBe(0)
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
