import { beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { chunkPayStubIds, fetchPayStubLineMaps, fetchPayStubRows, groupByPayStubId, withoutPayStub } from './payStubsData'

type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => { data: unknown; error: null } = () => ({ data: [], error: null })
const supabase = {
  from: (table: string) => {
    const steps: Step[] = []
    queries.push({ table, steps })
    const p: unknown = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(route(table, steps))
        return (...a: unknown[]) => { steps.push({ method: String(prop), args: a }); return p }
      },
    })
    return p
  },
} as unknown as SupabaseClient

const step = (q: { steps: Step[] }, method: string) => q.steps.find((s) => s.method === method)

beforeEach(() => {
  queries.length = 0
  route = () => ({ data: [], error: null })
})

describe('chunkPayStubIds', () => {
  it('cuts the ids into runs of the size, the last one short', () => {
    expect(chunkPayStubIds(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']])
  })
  it('is no chunks for no ids, and 200 at a time by default', () => {
    expect(chunkPayStubIds([])).toEqual([])
    const ids = Array.from({ length: 401 }, (_, i) => `s${i}`)
    expect(chunkPayStubIds(ids).map((c) => c.length)).toEqual([200, 200, 1])
  })
})

describe('groupByPayStubId', () => {
  it('lists each row under its stub in the order read', () => {
    const rows = [
      { pay_stub_id: 's1', id: 'a' },
      { pay_stub_id: 's2', id: 'b' },
      { pay_stub_id: 's1', id: 'c' },
    ]
    expect(groupByPayStubId(rows)).toEqual({ s1: [rows[0], rows[2]], s2: [rows[1]] })
  })
  it('adds to the map it is handed, so chunks accumulate', () => {
    const into = groupByPayStubId([{ pay_stub_id: 's1', id: 'a' }])
    groupByPayStubId([{ pay_stub_id: 's1', id: 'b' }, { pay_stub_id: 's3', id: 'c' }], into)
    expect(Object.keys(into)).toEqual(['s1', 's3'])
    expect(into.s1?.map((r) => r.id)).toEqual(['a', 'b'])
  })
})

describe('withoutPayStub', () => {
  it('drops the stub from a copy and leaves the map it was handed', () => {
    const map = { s1: [1], s2: [2] }
    expect(withoutPayStub(map, 's1')).toEqual({ s2: [2] })
    expect(map).toEqual({ s1: [1], s2: [2] })
  })
  it('is a plain copy when the stub is not there', () => {
    expect(withoutPayStub({ s1: [1] }, 'nope')).toEqual({ s1: [1] })
  })
})

describe('fetchPayStubRows', () => {
  it('reads every pay report, newest first', async () => {
    route = () => ({ data: [{ id: 's1' }], error: null })
    expect(await fetchPayStubRows(supabase)).toEqual([{ id: 's1' }])
    expect(queries.map((q) => q.table)).toEqual(['pay_stubs'])
    expect(step(queries[0]!, 'order')?.args).toEqual(['created_at', { ascending: false }])
  })
  it('is an empty list when the read comes back null', async () => {
    route = () => ({ data: null, error: null })
    expect(await fetchPayStubRows(supabase)).toEqual([])
  })
})

describe('fetchPayStubLineMaps', () => {
  it('reads nothing for no stubs', async () => {
    expect(await fetchPayStubLineMaps(supabase, [])).toEqual({ paymentsByStubId: {}, deductionsByStubId: {}, additionalByStubId: {} })
    expect(queries).toEqual([])
  })

  it('reads the three child tables for the ids and files each row under its stub', async () => {
    route = (table) => {
      if (table === 'pay_stub_payments') return { data: [{ id: 'p1', pay_stub_id: 's1', amount: 100 }, { id: 'p2', pay_stub_id: 's1', amount: 50 }], error: null }
      if (table === 'pay_stub_deductions') return { data: [{ id: 'd1', pay_stub_id: 's2', amount: 25 }], error: null }
      return { data: [], error: null }
    }
    const maps = await fetchPayStubLineMaps(supabase, ['s1', 's2'])
    expect(queries.map((q) => q.table).sort()).toEqual(['pay_stub_additional_lines', 'pay_stub_deductions', 'pay_stub_payments'])
    for (const q of queries) expect(step(q, 'in')?.args).toEqual(['pay_stub_id', ['s1', 's2']])
    expect(step(queries.find((q) => q.table === 'pay_stub_payments')!, 'order')?.args).toEqual(['paid_at', { ascending: true }])
    expect(maps.paymentsByStubId.s1?.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(maps.deductionsByStubId).toEqual({ s2: [{ id: 'd1', pay_stub_id: 's2', amount: 25 }] })
    expect(maps.additionalByStubId).toEqual({})
  })

  it('asks again for each 200 stubs and keeps one map across the chunks', async () => {
    route = (table, steps) => {
      if (table !== 'pay_stub_payments') return { data: [], error: null }
      const ids = (steps.find((s) => s.method === 'in')?.args[1] ?? []) as string[]
      return { data: [{ id: `p-${ids[0]}`, pay_stub_id: ids[0] }], error: null }
    }
    const ids = Array.from({ length: 201 }, (_, i) => `s${i}`)
    const maps = await fetchPayStubLineMaps(supabase, ids)
    expect(queries.filter((q) => q.table === 'pay_stub_payments')).toHaveLength(2)
    expect(Object.keys(maps.paymentsByStubId)).toEqual(['s0', 's200'])
  })
})
