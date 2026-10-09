import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The reads the payment rule needs beyond a billed read (v2.5010): the unlinked payments of the jobs
 * with a billed bill, the paid bills of the jobs that have unlinked money, and — when the caller
 * read only the open bills' payments — those paid bills' own payments.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => { data: unknown; error: null } = () => ({ data: [], error: null })
vi.mock('../supabase', () => ({
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
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: null }>) => (await op()).data,
}))

import { loadUnlinkedMoney } from './loadUnlinkedMoney'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const has = (steps: Step[], m: string, col: string, v?: unknown) => argsOf(steps, m).some(([c, x]) => c === col && (v === undefined || x === v))
const OPTS = { paymentColumns: 'job_id, invoice_id, amount, paid_on', invoiceColumns: 'id, job_id, amount, status', label: 'test' }

beforeEach(() => {
  queries.length = 0
  route = (table, steps) => {
    if (table === 'jobs_ledger_payments' && has(steps, 'is', 'invoice_id', null)) {
      // A stray linked row the filter let through is dropped.
      return { data: [{ job_id: 'J', invoice_id: null, amount: 500 }, { job_id: 'J', invoice_id: 'x1', amount: 9 }], error: null }
    }
    if (table === 'jobs_ledger_invoices') return { data: [{ id: 'x0', job_id: 'J', amount: 1000, status: 'paid' }, { id: 'x1', job_id: 'J', amount: 500, status: 'billed' }], error: null }
    if (table === 'jobs_ledger_payments') return { data: [{ job_id: 'J', invoice_id: 'x0', amount: 1000 }], error: null }
    return { data: [], error: null }
  }
})

describe('loadUnlinkedMoney', () => {
  it('sends nothing for no billed jobs', async () => {
    expect(await loadUnlinkedMoney([], OPTS)).toEqual({ unlinkedPayments: [], paidBills: [], paidBillPayments: [] })
    expect(queries).toHaveLength(0)
  })

  it('reads the unlinked payments of the billed jobs, then the paid bills of the jobs with unlinked money', async () => {
    const r = await loadUnlinkedMoney(['J', 'J'], OPTS)
    expect(queries.map((q) => q.table)).toEqual(['jobs_ledger_payments', 'jobs_ledger_invoices'])
    expect(argsOf(queries[0]!.steps, 'in')).toEqual([['job_id', ['J']]])
    expect(has(queries[1]!.steps, 'eq', 'status', 'paid')).toBe(true)
    expect(r.unlinkedPayments).toEqual([{ job_id: 'J', invoice_id: null, amount: 500 }])
    expect(r.paidBills.map((b) => b.id)).toEqual(['x0'])
    expect(r.paidBillPayments).toEqual([])
  })

  it("with withPaidBillPayments, also reads those paid bills' own payments", async () => {
    const r = await loadUnlinkedMoney(['J'], { ...OPTS, withPaidBillPayments: true })
    expect(queries.map((q) => q.table)).toEqual(['jobs_ledger_payments', 'jobs_ledger_invoices', 'jobs_ledger_payments'])
    expect(argsOf(queries[2]!.steps, 'in')).toEqual([['invoice_id', ['x0']]])
    expect(r.paidBillPayments).toEqual([{ job_id: 'J', invoice_id: 'x0', amount: 1000 }])
  })

  it('skips the paid-bill read when no billed job has unlinked money', async () => {
    route = (table) => ({ data: table === 'jobs_ledger_payments' ? [] : [{ id: 'x0', job_id: 'J', status: 'paid' }], error: null })
    const r = await loadUnlinkedMoney(['J'], { ...OPTS, withPaidBillPayments: true })
    expect(queries.map((q) => q.table)).toEqual(['jobs_ledger_payments'])
    expect(r).toEqual({ unlinkedPayments: [], paidBills: [], paidBillPayments: [] })
  })
})
