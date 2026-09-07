import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The customer profile modal's one batched fetch: nine reads under existing
 * RLS, assembled into what the modal shows. Pins each read's filters, the
 * contact / address / project mapping (blank names dropped, the primary
 * address hidden, attention from the first workflow's steps), the GC chip
 * inputs, and that only the customer and jobs reads are hard.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => { data?: unknown; count?: number | null; error: { message: string } | null } = () => ({ data: [], error: null })
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
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))
const attention = vi.fn((_steps: unknown[], _today: string, _fn: unknown) => ({ kind: 'built' }))
vi.mock('../projects/projectAttention', () => ({ buildProjectAttention: (s: unknown[], t: string, f: unknown) => attention(s, t, f) }))

import { fetchCustomerProfile } from './fetchCustomerProfile'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const isHead = (steps: Step[]) => steps.some((s) => s.method === 'select' && (s.args[1] as { head?: boolean } | undefined)?.head === true)
const q = (table: string, head = false) => queries.find((x) => x.table === table && isHead(x.steps) === head)!
const customer = { id: 'c1', name: 'Acme', address: '1 Acme Way' }
const data: Record<string, unknown> = {
  customers: customer,
  customer_contact_persons: [{ id: 'p1', name: 'Pat', phone: null, email: 'pat@acme.test' }, { id: 'p2', name: '  ', phone: '5', email: null }],
  jobs_ledger: [{ id: 'j1', hcp_number: '1842', click_number: null, job_name: 'Riverside', status: 'billed', revenue: 1000, payments_made: 200, created_at: '2026-09-01', invoices: [], payments: [] }],
  projects: [
    { id: 'pr1', name: 'Oak Ridge', status: 'active', workflows: [{ id: 'wf1', project_workflow_steps: [{ name: 'Rough-in', status: 'in_progress', sequence_order: 1 }] }, { id: 'wf2', project_workflow_steps: [{ name: 'ignored', status: 'x', sequence_order: 1 }] }] },
    { id: 'pr2', name: 'Empty', status: null, workflows: [] },
  ],
  bids: [{ id: 'b1', bid_number: '77', project_name: 'Oak Ridge', outcome: null, address: null, bid_value: 5000, agreed_value: null, bid_date_sent: null, bid_due_date: null }],
  estimates: [{ id: 'e1', estimate_number: 7, title: 'Heater', status: 'draft', total_cents: 1000, sent_at: null, updated_at: null }],
  customer_addresses: [
    { id: 'a1', address: '1 Acme Way', note: null, sequence_order: 0, is_primary: true }, // mirrors customers.address: hidden
    { id: 'a2', address: '9 Elm', note: 'shop', sequence_order: 1, is_primary: false },
    { id: 'a3', address: '  ', note: null, sequence_order: 2, is_primary: false },
    { id: 'a4', address: '3 Oak', note: null, sequence_order: 3 }, // pre-v2.3008 row without the flag: listed
  ],
  gc_statement_emails: [{ sent_at: '2026-09-05T10:00:00Z' }],
}
const routeScenario = (table: string, steps: Step[]) => {
  if (table === 'jobs_ledger' && isHead(steps)) return { count: 3, error: null }
  return { data: data[table] ?? [], error: null }
}

beforeEach(() => {
  queries.length = 0
  route = routeScenario
  attention.mockClear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-07T18:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('fetchCustomerProfile', () => {
  it('reads the nine sources for the customer with their orders, embeds and caps', async () => {
    await fetchCustomerProfile('c1')
    expect(argsOf(q('customers').steps, 'eq')).toEqual([['id', 'c1']])
    expect(q('customers').steps.some((s) => s.method === 'single')).toBe(true)
    expect(argsOf(q('customer_contact_persons').steps, 'order')).toEqual([['name']])
    const jobs = q('jobs_ledger')
    expect(String(argsOf(jobs.steps, 'select')[0]![0])).toContain('invoices:jobs_ledger_invoices(id, status, amount, billed_at, estimated_bill_date), payments:jobs_ledger_payments(invoice_id, amount, paid_on)')
    expect(argsOf(jobs.steps, 'eq')).toEqual([['customer_id', 'c1']])
    expect(argsOf(jobs.steps, 'order')).toEqual([['created_at', { ascending: false }]])
    expect(String(argsOf(q('projects').steps, 'select')[0]![0])).toContain('workflows:project_workflows(id, project_workflow_steps(')
    for (const t of ['projects', 'bids', 'estimates']) expect(argsOf(q(t).steps, 'eq')).toEqual([['customer_id', 'c1']])
    expect(argsOf(q('customer_addresses').steps, 'select')).toEqual([['*']]) // stays soft until is_primary lands
    expect(argsOf(q('customer_addresses').steps, 'order')).toEqual([['sequence_order', { ascending: true }]])
    expect(argsOf(q('jobs_ledger', true).steps, 'eq')).toEqual([['gc_customer_id', 'c1']])
    expect(argsOf(q('gc_statement_emails').steps, 'order')).toEqual([['sent_at', { ascending: false }]])
    expect(argsOf(q('gc_statement_emails').steps, 'limit')).toEqual([[1]])
  })

  it('assembles the profile: named contacts only, extra addresses without the primary or blanks, attention from the first workflow’s steps, the GC count and last statement', async () => {
    const out = await fetchCustomerProfile('c1')
    expect(out.customer).toEqual(customer)
    expect(out.contactPersons).toEqual([{ id: 'p1', name: 'Pat', phone: null, email: 'pat@acme.test' }])
    expect(out.extraAddresses).toEqual([
      { id: 'a2', address: '9 Elm', note: 'shop' },
      { id: 'a4', address: '3 Oak', note: null },
    ])
    expect(out.jobs).toEqual(data.jobs_ledger)
    expect(out.projects).toEqual([
      { id: 'pr1', name: 'Oak Ridge', status: 'active', attention: { kind: 'built' } },
      { id: 'pr2', name: 'Empty', status: null, attention: null },
    ])
    expect(attention).toHaveBeenCalledTimes(1)
    expect(attention.mock.calls[0]![0]).toEqual([{ name: 'Rough-in', status: 'in_progress', sequence_order: 1 }]) // only the first workflow
    expect(attention.mock.calls[0]![1]).toBe('2026-09-07') // today in the company calendar
    expect(out.bids).toEqual(data.bids)
    expect(out.estimates).toEqual(data.estimates)
    expect(out.gcJobCount).toBe(3)
    expect(out.gcLastStatementSentAt).toBe('2026-09-05T10:00:00Z')
  })

  it('an attention builder that throws leaves that project without attention; empty side reads and a null count read as empty / zero', async () => {
    attention.mockImplementationOnce(() => {
      throw new Error('bad steps')
    })
    const out = await fetchCustomerProfile('c1')
    expect(out.projects[0]!.attention).toBeNull()

    route = (table, steps) => (table === 'customers' ? { data: customer, error: null } : table === 'jobs_ledger' && !isHead(steps) ? { data: [], error: null } : { data: null, count: null, error: null })
    const empty = await fetchCustomerProfile('c1')
    expect(empty).toEqual({ customer, contactPersons: [], extraAddresses: [], jobs: [], projects: [], bids: [], estimates: [], gcJobCount: 0, gcLastStatementSentAt: null })
  })

  it('a missing customer or a failed customer / jobs read throws; the side reads never do', async () => {
    route = (table, steps) => (table === 'customers' ? { data: null, error: null } : routeScenario(table, steps))
    await expect(fetchCustomerProfile('gone')).rejects.toThrow('Customer not found')
    route = (table, steps) => (table === 'jobs_ledger' && !isHead(steps) ? { data: null, error: { message: 'jobs rls' } } : routeScenario(table, steps))
    await expect(fetchCustomerProfile('c1')).rejects.toThrow('jobs rls')
    route = (table, steps) => (table === 'bids' || table === 'projects' ? { data: null, error: { message: 'rls' } } : routeScenario(table, steps))
    const out = await fetchCustomerProfile('c1')
    expect(out.bids).toEqual([])
    expect(out.projects).toEqual([])
  })
})
