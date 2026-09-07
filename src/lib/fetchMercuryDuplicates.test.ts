import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Banking → Mercury duplicates: the detection RPC mapped into pairs for the
 * clustering kernel, the excluded-duplicates list for undo, and the three
 * decision RPCs. Pins the RPC arguments and defaults, the a/b row mapping,
 * the list's filters, and that failures throw.
 */
type Step = { method: string; args: unknown[] }
const calls: Array<{ kind: 'from' | 'rpc'; name: string; args: unknown[]; steps: Step[] }> = []
let route: (kind: 'from' | 'rpc', name: string) => { data: unknown; error: { message: string } | null } = () => ({ data: [], error: null })
function recorder(kind: 'from' | 'rpc', name: string, args: unknown[]) {
  const steps: Step[] = []
  calls.push({ kind, name, args, steps })
  const p: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(route(kind, name))
        return (...a: unknown[]) => {
          steps.push({ method: String(prop), args: a })
          return p
        }
      },
    },
  )
  return p
}
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => recorder('from', table, []),
    rpc: (fn: string, args: unknown) => recorder('rpc', fn, [args]),
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))

import { clearMercuryTransactionDuplicate, dismissMercuryDuplicatePair, fetchExcludedDuplicates, fetchMercuryDuplicatePairs, markMercuryTransactionDuplicate } from './fetchMercuryDuplicates'

const rpcs = () => calls.filter((c) => c.kind === 'rpc').map((c) => [c.name, c.args[0]])
const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)

beforeEach(() => {
  calls.length = 0
  route = () => ({ data: [], error: null })
})

describe('fetchMercuryDuplicatePairs', () => {
  it('calls the detection RPC with a 3-day window, manual-only and 500 by default, or the given options, and maps each row into an a/b pair', async () => {
    route = () => ({
      data: [
        {
          a_id: 'A', a_amount: '-45.25', a_counterparty_name: 'Shell', a_posted_at: '2026-09-01', a_created_at: '2026-09-01T10:00:00Z', a_kind: 'debitCardTransaction', a_mercury_account_id: 'acct', a_source: 'sync', a_raw: { x: 1 },
          b_id: 'B', b_amount: -45.25, b_counterparty_name: null, b_posted_at: null, b_created_at: '2026-09-03T10:00:00Z', b_kind: 'manual', b_mercury_account_id: 'acct', b_source: 'manual', b_raw: null,
          manual_involved: true, days_apart: '2',
        },
      ],
      error: null,
    })
    const pairs = await fetchMercuryDuplicatePairs()
    expect(rpcs()).toEqual([['find_possible_duplicate_mercury_transactions', { p_window_days: 3, p_manual_only: true, p_limit: 500 }]])
    expect(pairs).toEqual([
      {
        a: { id: 'A', amount: -45.25, counterpartyName: 'Shell', postedAt: '2026-09-01', createdAt: '2026-09-01T10:00:00Z', kind: 'debitCardTransaction', mercuryAccountId: 'acct', source: 'sync', raw: { x: 1 } },
        b: { id: 'B', amount: -45.25, counterpartyName: null, postedAt: null, createdAt: '2026-09-03T10:00:00Z', kind: 'manual', mercuryAccountId: 'acct', source: 'manual', raw: null },
        manualInvolved: true,
        daysApart: 2,
      },
    ])
    calls.length = 0
    await fetchMercuryDuplicatePairs({ windowDays: 7, manualOnly: false, limit: 50 })
    expect(rpcs()).toEqual([['find_possible_duplicate_mercury_transactions', { p_window_days: 7, p_manual_only: false, p_limit: 50 }]])
    route = () => ({ data: null, error: null })
    expect(await fetchMercuryDuplicatePairs()).toEqual([])
  })
})

describe('fetchExcludedDuplicates', () => {
  it('lists rows marked as duplicates, newest posted first with nulls last, capped at 500, mapped with their keeper', async () => {
    route = () => ({ data: [{ id: 'D', amount: '12', counterparty_name: 'Shell', posted_at: '2026-09-01', raw: null, duplicate_of_transaction_id: 'K' }], error: null })
    expect(await fetchExcludedDuplicates()).toEqual([{ id: 'D', amount: 12, counterpartyName: 'Shell', postedAt: '2026-09-01', raw: null, keeperId: 'K' }])
    const read = calls[0]!
    expect(read.name).toBe('mercury_transactions')
    expect(argsOf(read.steps, 'not')).toEqual([['duplicate_of_transaction_id', 'is', null]])
    expect(argsOf(read.steps, 'order')).toEqual([['posted_at', { ascending: false, nullsFirst: false }]])
    expect(argsOf(read.steps, 'limit')).toEqual([[500]])
    route = () => ({ data: null, error: null })
    expect(await fetchExcludedDuplicates()).toEqual([])
  })
})

describe('decisions', () => {
  it('mark, clear and dismiss each go through their RPC with the ids, and a failure throws', async () => {
    await markMercuryTransactionDuplicate('dup', 'keep')
    await clearMercuryTransactionDuplicate('dup')
    await dismissMercuryDuplicatePair('A', 'B')
    expect(rpcs()).toEqual([
      ['set_mercury_transaction_duplicate', { p_duplicate_id: 'dup', p_keeper_id: 'keep' }],
      ['clear_mercury_transaction_duplicate', { p_id: 'dup' }],
      ['dismiss_mercury_duplicate_pair', { p_id_a: 'A', p_id_b: 'B' }],
    ])
    route = () => ({ data: null, error: { message: 'not allowed' } })
    await expect(markMercuryTransactionDuplicate('dup', 'keep')).rejects.toThrow('not allowed')
    await expect(fetchMercuryDuplicatePairs()).rejects.toThrow('not allowed')
    await expect(fetchExcludedDuplicates()).rejects.toThrow('not allowed')
  })
})
