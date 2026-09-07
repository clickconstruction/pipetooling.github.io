import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The job materials-cost snapshot (Edit Job parts cost, Job Detail materials,
 * the charges timeline, combine / migrate). Four independent reads, each
 * failing soft on its own; this pins what each is asked, how PostgREST's
 * object-or-array embeds are read, the allocation and tally arithmetic, and
 * the per-source failure flags.
 */
type Step = { method: string; args: unknown[] }
const calls: Array<{ kind: 'from' | 'rpc'; name: string; args: unknown[]; steps: Step[] }> = []
let route: (kind: 'from' | 'rpc', name: string) => unknown = () => []
function recorder(kind: 'from' | 'rpc', name: string, args: unknown[]) {
  const steps: Step[] = []
  calls.push({ kind, name, args, steps })
  const p: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') {
          return (resolve: (v: { data: unknown; error: null }) => void, reject: (e: unknown) => void) => {
            try {
              resolve({ data: route(kind, name), error: null })
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
}
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => recorder('from', table, []),
    rpc: (fn: string, args?: unknown) => recorder('rpc', fn, args === undefined ? [] : [args]),
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: null }>) => (await op()).data,
}))
vi.mock('./mercuryRawDebitCard', () => ({ mercuryDebitCardIdFromRaw: (raw: { cardId?: string } | null) => raw?.cardId ?? null }))

import { fetchJobMaterialsCostSnapshot, mercuryCardTotalFromLines, tallyPartsTotalFromLines } from './fetchJobMaterialsCostSnapshot'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const call = (name: string) => calls.find((c) => c.name === name)!
const full: Record<string, unknown> = {
  get_invoice_amounts_for_jobs: [{ job_id: 'other', invoice_amount: '999' }, { job_id: 'j1', invoice_amount: '1250.5' }],
  supply_house_invoice_job_allocations: [
    { pct: 50, supply_house_invoices: { invoice_number: 'INV-1', invoice_date: '2026-09-01T00:00:00', amount: '200', supply_houses: { name: 'Ferguson' } } },
    { pct: '25', supply_house_invoices: [{ invoice_number: 'INV-2', invoice_date: '2026-08-15', amount: 80, supply_houses: [{ name: 'Winsupply' }] }] }, // embeds as 1-element arrays
    { pct: 10, supply_house_invoices: { invoice_number: 'INV-3', invoice_date: null, amount: null, supply_houses: null } },
    { pct: 10, supply_house_invoices: null }, // orphan allocation: skipped
  ],
  mercury_transaction_job_allocations: [
    { id: 'a1', amount: '-45.25', note: 'PVC', mercury_transaction_id: 'tx1', mercury_transactions: { posted_at: '2026-09-02', counterparty_name: 'Home Depot', amount: -45.25, raw: { cardId: 'card-a' } } },
    { id: 'a2', amount: 10, note: null, mercury_transaction_id: 'tx2', mercury_transactions: [{ posted_at: null, counterparty_name: null, amount: null, raw: null }] },
    { id: 'a3', amount: '5', note: 'orphan', mercury_transaction_id: 'tx3', mercury_transactions: null },
  ],
  list_tally_parts_with_po: [
    { id: 't1', job_id: 'j1', fixture_name: 'Lavatory', quantity: '2', part_id: 'p1', part_name: ' 1/2 PEX ', price_at_time: '3.5', fixture_cost: '100', created_at: '2026-09-03T12:00:00Z', created_by_name: 'Ana' },
    { id: 't2', job_id: 'j1', fixture_name: null, quantity: 3, part_id: null, part_name: '  ', price_at_time: null, fixture_cost: 40, created_at: null, created_by_name: '   ' }, // no part: fixture cost × qty
    { id: 't3', job_id: 'j1', fixture_name: 'Sink', quantity: 1, part_id: '', part_name: null, price_at_time: 9, fixture_cost: 7, created_at: null, created_by_name: null }, // blank part id counts as no part
    { id: 't9', job_id: 'other', fixture_name: 'X', quantity: 1, part_id: null, part_name: null, price_at_time: null, fixture_cost: 1, created_at: null, created_by_name: null },
  ],
}

beforeEach(() => {
  calls.length = 0
  route = (_k, name) => full[name] ?? []
})

describe('fetchJobMaterialsCostSnapshot', () => {
  it('asks the four sources for the job and maps each into lines', async () => {
    const snap = await fetchJobMaterialsCostSnapshot('j1')
    expect(call('get_invoice_amounts_for_jobs')).toMatchObject({ kind: 'rpc', args: [{ p_job_ids: ['j1'] }] })
    expect(argsOf(call('supply_house_invoice_job_allocations').steps, 'eq')).toEqual([['job_id', 'j1']])
    expect(String(argsOf(call('supply_house_invoice_job_allocations').steps, 'select')[0]![0])).toContain('supply_house_invoices(invoice_number, invoice_date, amount, supply_houses(name))')
    expect(argsOf(call('mercury_transaction_job_allocations').steps, 'eq')).toEqual([['job_id', 'j1']])
    expect(argsOf(call('mercury_transaction_job_allocations').steps, 'order')).toEqual([['created_at', { ascending: true }]])
    expect(call('list_tally_parts_with_po')).toMatchObject({ kind: 'rpc', args: [] })

    expect(snap.supplyInvoiceTotal).toBe(1250.5) // this job's row, not the other job's
    expect(snap.supplyInvoiceLines).toEqual([
      { pct: 50, invoiceNumber: 'INV-1', invoiceDate: '2026-09-01', invoiceAmount: 200, allocatedAmount: 100, supplyHouseName: 'Ferguson' },
      { pct: 25, invoiceNumber: 'INV-2', invoiceDate: '2026-08-15', invoiceAmount: 80, allocatedAmount: 20, supplyHouseName: 'Winsupply' },
      { pct: 10, invoiceNumber: 'INV-3', invoiceDate: '', invoiceAmount: 0, allocatedAmount: 0, supplyHouseName: null },
    ])
    expect(snap.mercuryAllocLines).toEqual([
      { id: 'a1', allocationAmount: -45.25, note: 'PVC', postedAt: '2026-09-02', counterpartyName: 'Home Depot', debitCardId: 'card-a' },
      { id: 'a2', allocationAmount: 10, note: null, postedAt: null, counterpartyName: null, debitCardId: null },
      { id: 'a3', allocationAmount: 5, note: 'orphan', postedAt: null, counterpartyName: null, debitCardId: null },
    ])
    expect(snap.tallyPartLines).toEqual([
      { id: 't1', fixtureName: 'Lavatory', quantity: 2, partName: ' 1/2 PEX ', lineTotal: 7, createdAt: '2026-09-03T12:00:00Z', createdByName: 'Ana' },
      { id: 't2', fixtureName: '', quantity: 3, partName: null, lineTotal: 120, createdAt: null, createdByName: null },
      { id: 't3', fixtureName: 'Sink', quantity: 1, partName: null, lineTotal: 7, createdAt: null, createdByName: null },
    ])
    expect(snap).toMatchObject({ supplyInvoiceRpcFailed: false, mercuryFetchFailed: false, tallyFetchFailed: false })
  })

  it('the totals helpers sum absolute card allocations and tally line totals', async () => {
    const snap = await fetchJobMaterialsCostSnapshot('j1')
    expect(mercuryCardTotalFromLines(snap.mercuryAllocLines)).toBe(60.25)
    expect(tallyPartsTotalFromLines(snap.tallyPartLines)).toBe(134)
    expect(mercuryCardTotalFromLines([])).toBe(0)
  })

  it('a job with nothing filed comes back empty, not failed', async () => {
    route = () => []
    expect(await fetchJobMaterialsCostSnapshot('j1')).toEqual({
      supplyInvoiceTotal: 0,
      supplyInvoiceRpcFailed: false,
      supplyInvoiceLines: [],
      mercuryAllocLines: [],
      mercuryFetchFailed: false,
      tallyPartLines: [],
      tallyFetchFailed: false,
    })
    route = () => null
    expect((await fetchJobMaterialsCostSnapshot('j1')).supplyInvoiceLines).toEqual([])
  })

  it('each source fails on its own: the flag is raised for that source and the others still load', async () => {
    const failing = (name: string) => (_k: 'from' | 'rpc', n: string) => {
      if (n === name) throw new Error(`${name} down`)
      return full[n] ?? []
    }
    route = failing('get_invoice_amounts_for_jobs')
    let snap = await fetchJobMaterialsCostSnapshot('j1')
    expect(snap.supplyInvoiceRpcFailed).toBe(true)
    expect(snap.supplyInvoiceTotal).toBe(0)
    expect(snap.supplyInvoiceLines).toHaveLength(3)
    expect(snap.mercuryAllocLines).toHaveLength(3)

    route = failing('supply_house_invoice_job_allocations')
    snap = await fetchJobMaterialsCostSnapshot('j1')
    expect(snap.supplyInvoiceLines).toEqual([]) // no flag for the lines read: the RPC total still stands
    expect(snap.supplyInvoiceTotal).toBe(1250.5)
    expect(snap.supplyInvoiceRpcFailed).toBe(false)

    route = failing('mercury_transaction_job_allocations')
    snap = await fetchJobMaterialsCostSnapshot('j1')
    expect(snap).toMatchObject({ mercuryFetchFailed: true, mercuryAllocLines: [], tallyFetchFailed: false })
    expect(snap.tallyPartLines).toHaveLength(3)

    route = failing('list_tally_parts_with_po')
    snap = await fetchJobMaterialsCostSnapshot('j1')
    expect(snap).toMatchObject({ tallyFetchFailed: true, tallyPartLines: [], mercuryFetchFailed: false })
  })
})
