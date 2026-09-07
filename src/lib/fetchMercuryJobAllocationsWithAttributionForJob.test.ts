import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A job's Mercury card allocations with who was attributed (Job Summary,
 * Parts tab, the unattributed list, per-person parts cost): the paged read,
 * the Internal-Transfers exclusion, the invoice-linked flag, and the name
 * resolution through attributions → people / users, which fails soft.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string) => { data: unknown; error: { message: string } | null } = () => ({ data: [], error: null })
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(route(table))
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
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))
const attrs = vi.fn(async (_ids: string[], _label: string): Promise<Array<{ mercury_transaction_id: string; person_id: string | null; user_id: string | null }>> => [])
vi.mock('./fetchMercuryRelationsByTxIds', () => ({ fetchAttributionsByMercuryTxIds: (ids: string[], label: string) => attrs(ids, label) }))
const exclusions = vi.fn(async (_ids: readonly string[]) => ({ bucketByTxId: new Map<string, string>(), invoiceLinkedTxIds: new Set<string>() }))
vi.mock('./jobs/loadCardChargeExclusions', () => ({ loadCardChargeExclusions: (ids: readonly string[]) => exclusions(ids) }))

import { fetchMercuryJobAllocationsWithAttributionForJob } from './fetchMercuryJobAllocationsWithAttributionForJob'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const q = (table: string) => queries.find((x) => x.table === table)
const mt = (over: Record<string, unknown> = {}) => ({ posted_at: '2026-09-01', counterparty_name: 'Home Depot', amount: -50, note: null, external_memo: null, mercury_account_id: 'acct', raw: null, ...over })
const rows = [
  { id: 'a1', amount: -50, note: 'PVC', mercury_transaction_id: 'tx1', mercury_transactions: mt() },
  { id: 'a2', amount: -20, note: null, mercury_transaction_id: 'tx2', mercury_transactions: mt({ counterparty_name: 'Ferguson' }) },
  { id: 'a3', amount: -500, note: null, mercury_transaction_id: 'tx3', mercury_transactions: mt({ counterparty_name: 'Transfer' }) }, // internal transfer: dropped
  { id: 'a4', amount: -10, note: null, mercury_transaction_id: 'tx1', mercury_transactions: null }, // second allocation of tx1
]

beforeEach(() => {
  queries.length = 0
  route = (table) => ({ data: table === 'mercury_transaction_job_allocations' ? rows : [], error: null })
  attrs.mockReset()
  attrs.mockResolvedValue([])
  exclusions.mockReset()
  exclusions.mockResolvedValue({ bucketByTxId: new Map(), invoiceLinkedTxIds: new Set() })
})

describe('fetchMercuryJobAllocationsWithAttributionForJob', () => {
  it('reads the job’s allocations paged with the transaction embed, drops Internal-Transfer rows, flags invoice-linked ones, and resolves names through people and users', async () => {
    exclusions.mockResolvedValue({ bucketByTxId: new Map([['tx3', 'internal_transfer'], ['tx2', 'materials']]), invoiceLinkedTxIds: new Set(['tx2']) })
    attrs.mockResolvedValue([
      { mercury_transaction_id: 'tx1', person_id: 'p1', user_id: null },
      { mercury_transaction_id: 'tx2', person_id: null, user_id: 'u1' },
    ])
    route = (table) => {
      if (table === 'mercury_transaction_job_allocations') return { data: rows, error: null }
      if (table === 'people') return { data: [{ id: 'p1', name: 'Pat Person' }], error: null }
      if (table === 'users') return { data: [{ id: 'u1', name: 'Uma User' }], error: null }
      return { data: [], error: null }
    }
    const out = await fetchMercuryJobAllocationsWithAttributionForJob('j1', 'job summary')
    const read = q('mercury_transaction_job_allocations')!
    expect(String(argsOf(read.steps, 'select')[0]![0])).toContain('mercury_transactions(posted_at, counterparty_name, amount, note, external_memo, mercury_account_id, raw)')
    expect(argsOf(read.steps, 'eq')).toEqual([['job_id', 'j1']])
    expect(argsOf(read.steps, 'order')).toEqual([['created_at', { ascending: true }], ['id']])
    expect(argsOf(read.steps, 'range')).toEqual([[0, 999]])
    expect(exclusions).toHaveBeenCalledWith(['tx1', 'tx2', 'tx3'])
    expect(attrs).toHaveBeenCalledWith(['tx1', 'tx2'], 'job summary mercury attr') // the dropped transfer is not looked up
    expect(argsOf(q('people')!.steps, 'in')).toEqual([['id', ['p1']]])
    expect(argsOf(q('users')!.steps, 'in')).toEqual([['id', ['u1']]])
    expect(out).toEqual([
      { id: 'a1', amount: -50, note: 'PVC', mercury_transaction_id: 'tx1', mercury_transactions: mt(), attributionDisplayName: 'Pat Person', linkedToSupplyInvoice: false },
      { id: 'a2', amount: -20, note: null, mercury_transaction_id: 'tx2', mercury_transactions: mt({ counterparty_name: 'Ferguson' }), attributionDisplayName: 'Uma User', linkedToSupplyInvoice: true },
      { id: 'a4', amount: -10, note: null, mercury_transaction_id: 'tx1', mercury_transactions: null, attributionDisplayName: 'Pat Person', linkedToSupplyInvoice: false },
    ])
  })

  it('a person attribution wins over a user one; an attribution whose name is unknown reads as no name; no attributions means no people or users reads', async () => {
    attrs.mockResolvedValue([{ mercury_transaction_id: 'tx1', person_id: 'p-unknown', user_id: 'u1' }])
    route = (table) => ({ data: table === 'mercury_transaction_job_allocations' ? rows.slice(0, 1) : table === 'users' ? [{ id: 'u1', name: 'Uma' }] : [], error: null })
    const out = await fetchMercuryJobAllocationsWithAttributionForJob('j1', 'x')
    expect(out[0]!.attributionDisplayName).toBeNull() // the person id is preferred even when its name is missing
    queries.length = 0
    attrs.mockResolvedValue([])
    await fetchMercuryJobAllocationsWithAttributionForJob('j1', 'x')
    expect(q('people')).toBeUndefined()
    expect(q('users')).toBeUndefined()
  })

  it('a job with no allocations asks for no exclusions or attributions', async () => {
    route = () => ({ data: [], error: null })
    expect(await fetchMercuryJobAllocationsWithAttributionForJob('j1', 'x')).toEqual([])
    expect(exclusions).toHaveBeenCalledWith([])
    expect(attrs).not.toHaveBeenCalled()
  })

  it('name resolution fails soft: the allocations still come back without names; a failed allocation read throws', async () => {
    attrs.mockRejectedValue(new Error('attr rls'))
    const out = await fetchMercuryJobAllocationsWithAttributionForJob('j1', 'x')
    expect(out).toHaveLength(4)
    expect(out.every((r) => r.attributionDisplayName === null)).toBe(true)
    attrs.mockResolvedValue([{ mercury_transaction_id: 'tx1', person_id: 'p1', user_id: null }])
    route = (table) => (table === 'people' ? { data: null, error: { message: 'people rls' } } : { data: table === 'mercury_transaction_job_allocations' ? rows : [], error: null })
    expect((await fetchMercuryJobAllocationsWithAttributionForJob('j1', 'x'))[0]!.attributionDisplayName).toBeNull()
    route = () => ({ data: null, error: { message: 'alloc rls' } })
    await expect(fetchMercuryJobAllocationsWithAttributionForJob('j1', 'x')).rejects.toThrow('alloc rls')
  })
})
