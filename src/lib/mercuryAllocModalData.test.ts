import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Opening the Mercury allocations modal for one transaction from a job: the
 * full row, its current job splits and attribution, the job labels, the
 * legacy person name when only a person is attributed, and the account /
 * card nicknames (soft). Pins the reads, the mapping and the failure shapes.
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
const allocs = vi.fn(async (_ids: string[], _label: string): Promise<Array<{ mercury_transaction_id: string; job_id: string; amount: string | number; note: string | null }>> => [])
const attrs = vi.fn(async (_ids: string[], _label: string): Promise<Array<{ mercury_transaction_id: string; person_id: string | null; user_id: string | null }>> => [])
vi.mock('./fetchMercuryRelationsByTxIds', () => ({
  fetchJobAllocationsByMercuryTxIds: (ids: string[], label: string) => allocs(ids, label),
  fetchAttributionsByMercuryTxIds: (ids: string[], label: string) => attrs(ids, label),
}))

import { loadMercuryAllocModalDataForTransaction } from './mercuryAllocModalData'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const q = (table: string) => queries.find((x) => x.table === table)
const tx = { id: 'tx1', amount: -120.5, counterparty_name: 'Home Depot' }
const data: Record<string, unknown> = {
  mercury_transactions: tx,
  mercury_account_nicknames: [{ mercury_account_id: 'acct-1', nickname: 'Operating' }],
  mercury_debit_card_nicknames: [{ mercury_debit_card_id: 'CARD-ABC', nickname: 'Truck 2' }],
  jobs_ledger: [
    { id: 'j1', hcp_number: '1842', job_name: 'Riverside' },
    { id: 'j2', hcp_number: null, job_name: null },
  ],
  people: { id: 'p1', name: 'Legacy Pat' },
}

beforeEach(() => {
  queries.length = 0
  route = (table) => ({ data: data[table] ?? [], error: null })
  allocs.mockReset()
  allocs.mockResolvedValue([])
  attrs.mockReset()
  attrs.mockResolvedValue([])
})

describe('loadMercuryAllocModalDataForTransaction', () => {
  it('reads the full row, the splits and attribution for this transaction, the nickname maps, then the labels of the split jobs', async () => {
    allocs.mockResolvedValue([
      { mercury_transaction_id: 'tx1', job_id: 'j1', amount: '-100.5', note: 'PVC' },
      { mercury_transaction_id: 'tx1', job_id: 'j2', amount: -20, note: '' },
      { mercury_transaction_id: 'other', job_id: 'j9', amount: 5, note: null }, // not this transaction: ignored for splits
    ])
    attrs.mockResolvedValue([
      { mercury_transaction_id: 'other', person_id: 'p9', user_id: 'u9' },
      { mercury_transaction_id: 'tx1', person_id: 'p1', user_id: 'u1' },
    ])
    const out = await loadMercuryAllocModalDataForTransaction('tx1', 'job detail')
    expect(argsOf(q('mercury_transactions')!.steps, 'eq')).toEqual([['id', 'tx1']])
    expect(q('mercury_transactions')!.steps.some((s) => s.method === 'maybeSingle')).toBe(true)
    expect(allocs).toHaveBeenCalledWith(['tx1'], 'job detail job allocs')
    expect(attrs).toHaveBeenCalledWith(['tx1'], 'job detail attrs')
    expect(argsOf(q('jobs_ledger')!.steps, 'in')).toEqual([['id', ['j1', 'j2', 'j9']]]) // labels for every split job seen, this transaction's or not
    expect(out).toEqual({
      fullTx: tx,
      initialAllocations: [
        { job_id: 'j1', amount: -100.5, note: 'PVC' },
        { job_id: 'j2', amount: -20 }, // a blank note is left off
      ],
      initialPersonId: 'p1',
      initialUserId: 'u1',
      jobLabelById: { j1: '1842 · Riverside', j2: '·' },
      legacyPersonDisplayName: null, // a user is attributed: no legacy lookup
      nicknameByDebitCard: { 'card-abc': 'Truck 2' }, // card ids are lower-cased
      nicknameByAccount: { 'acct-1': 'Operating' },
    })
    expect(q('people')).toBeUndefined()
  })

  it('with only a person attributed (legacy), looks up that person’s name; with no splits, asks for no labels', async () => {
    attrs.mockResolvedValue([{ mercury_transaction_id: 'tx1', person_id: 'p1', user_id: null }])
    const out = await loadMercuryAllocModalDataForTransaction('tx1', 'x')
    expect(argsOf(q('people')!.steps, 'eq')).toEqual([['id', 'p1']])
    expect(out.legacyPersonDisplayName).toBe('Legacy Pat')
    expect(out.initialAllocations).toEqual([])
    expect(q('jobs_ledger')).toBeUndefined()
    route = (table) => (table === 'people' ? { data: null, error: null } : { data: data[table] ?? [], error: null })
    expect((await loadMercuryAllocModalDataForTransaction('tx1', 'x')).legacyPersonDisplayName).toBeNull()
  })

  it('a missing or invisible transaction throws; nickname reads fail soft to empty maps; a failed label read throws', async () => {
    route = (table) => (table === 'mercury_transactions' ? { data: null, error: null } : { data: data[table] ?? [], error: null })
    await expect(loadMercuryAllocModalDataForTransaction('gone', 'x')).rejects.toThrow('Mercury transaction not found or no access.')

    route = (table) => (table.endsWith('_nicknames') ? { data: null, error: { message: 'rls' } } : { data: data[table] ?? [], error: null })
    const out = await loadMercuryAllocModalDataForTransaction('tx1', 'x')
    expect(out.nicknameByAccount).toEqual({})
    expect(out.nicknameByDebitCard).toEqual({})

    allocs.mockResolvedValue([{ mercury_transaction_id: 'tx1', job_id: 'j1', amount: 1, note: null }])
    route = (table) => (table === 'jobs_ledger' ? { data: null, error: { message: 'labels rls' } } : { data: data[table] ?? [], error: null })
    await expect(loadMercuryAllocModalDataForTransaction('tx1', 'x')).rejects.toThrow('labels rls')
  })
})
