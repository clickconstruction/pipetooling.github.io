import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The shared Stages / Job Summary / AR loader: one primary `jobs_ledger` query
 * shaped by scope, then batched enrichment (materials, fixtures, schedule
 * blocks, estimates) in chunks of 150. The tests pin the filters each scope
 * sends, the companion ready-to-bill query, the min-HCP floor, the row mapping,
 * the chunking, and that a failed batch degrades instead of failing the load.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => unknown = () => []
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') {
              return (resolve: (v: { data: unknown; error: null }) => void, reject: (e: unknown) => void) => {
                try {
                  resolve({ data: route(table, steps), error: null })
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
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: null }>) => (await op()).data,
  formatErrorMessage: (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback),
}))

import {
  enrichJobsLedgerPrimaryRows,
  fetchJobsLedgerWithDetailsForStages,
  type JobsLedgerStagesPrimaryRow,
} from './fetchJobsLedgerWithDetailsForStages'

const primary = () => queries.filter((q) => q.table === 'jobs_ledger')
const stepArgs = (q: { steps: Step[] }, m: string) => q.steps.filter((s) => s.method === m).map((s) => s.args)
const tables = () => queries.map((q) => q.table)

const row = (over: Partial<JobsLedgerStagesPrimaryRow> & { id: string }): JobsLedgerStagesPrimaryRow =>
  ({ hcp_number: '100', job_name: 'Job', status: 'working', ...over }) as unknown as JobsLedgerStagesPrimaryRow

let warn: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  queries.length = 0
  route = () => []
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => warn.mockRestore())

describe('the primary query per scope', () => {
  const scopes: Array<[string, (q: { steps: Step[] }) => void]> = [
    ['all', (q) => expect(q.steps.some((s) => s.method === 'or' || (s.method === 'eq' && s.args[0] === 'status'))).toBe(false)],
    ['non_paid', (q) => expect(stepArgs(q, 'or')).toEqual([['status.is.null,status.neq.paid']])],
    ['paid', (q) => expect(stepArgs(q, 'eq')).toEqual([['status', 'paid']])],
    ['waiting', (q) => expect(stepArgs(q, 'eq')).toEqual([['status', 'waiting']])],
    ['working', (q) => expect(stepArgs(q, 'or')).toEqual([['status.is.null,status.eq.working']])],
    ['billed_all', (q) => expect(stepArgs(q, 'eq')).toEqual([['status', 'billed']])],
  ]
  for (const [scope, check] of scopes) {
    it(`${scope}: sends its status filter, ordered by HCP number descending`, async () => {
      const r = await fetchJobsLedgerWithDetailsForStages({ statusScope: scope as never })
      expect(r).toEqual({ ok: true, jobs: [], hiddenByMinHcp: undefined })
      expect(primary()).toHaveLength(1)
      const q = primary()[0]!
      expect(stepArgs(q, 'order')).toEqual([['hcp_number', { ascending: false }]])
      check(q)
    })
  }

  it('a customer filter is trimmed onto the query; a blank one is dropped', async () => {
    await fetchJobsLedgerWithDetailsForStages({ customerFilter: '  c1 ', statusScope: 'paid' })
    expect(stepArgs(primary()[0]!, 'eq')).toEqual([
      ['customer_id', 'c1'],
      ['status', 'paid'],
    ])
    queries.length = 0
    await fetchJobsLedgerWithDetailsForStages({ customerFilter: '   ' })
    expect(stepArgs(primary()[0]!, 'eq')).toEqual([])
  })

  it('ready_to_bill also runs the working-with-RTB-invoice companion and merges it without duplicates', async () => {
    route = (table, steps) => {
      if (table !== 'jobs_ledger') return []
      const isCompanion = steps.some((s) => s.method === 'eq' && s.args[0] === 'rtb_gate.status')
      return isCompanion
        ? [{ ...row({ id: 'b', status: 'working' }), rtb_gate: [{ id: 'inv9' }] }, { ...row({ id: 'a' }), rtb_gate: [{ id: 'inv1' }] }]
        : [row({ id: 'a', status: 'ready_to_bill' })]
    }
    const r = await fetchJobsLedgerWithDetailsForStages({ statusScope: 'ready_to_bill', customerFilter: 'c1' })
    expect(primary()).toHaveLength(2)
    const [main, companion] = primary()
    expect(stepArgs(main!, 'eq')).toEqual([
      ['customer_id', 'c1'],
      ['status', 'ready_to_bill'],
    ])
    expect(String(companion!.steps.find((s) => s.method === 'select')!.args[0])).toContain('rtb_gate:jobs_ledger_invoices!inner(id)')
    expect(stepArgs(companion!, 'or')).toEqual([['status.is.null,status.eq.working']])
    expect(stepArgs(companion!, 'eq')).toEqual([
      ['rtb_gate.status', 'ready_to_bill'],
      ['customer_id', 'c1'],
    ])
    expect(r.ok && r.jobs.map((j) => j.id)).toEqual(['a', 'b'])
    expect(r.ok && 'rtb_gate' in r.jobs[1]!).toBe(false) // the gate alias never reaches the board
  })

  it('an ids list fetches exactly those jobs and ignores the scope (no companion)', async () => {
    route = (table) => (table === 'jobs_ledger' ? [row({ id: 'x' })] : [])
    const r = await fetchJobsLedgerWithDetailsForStages({ ids: ['x', 'y'], statusScope: 'ready_to_bill' })
    expect(primary()).toHaveLength(1)
    expect(stepArgs(primary()[0]!, 'in')).toEqual([['id', ['x', 'y']]])
    expect(stepArgs(primary()[0]!, 'order')).toEqual([['hcp_number', { ascending: false }]])
    expect(r.ok && r.jobs.map((j) => j.id)).toEqual(['x'])
  })

  it('a failed primary query reports ok:false with the message, or the fallback', async () => {
    route = () => {
      throw new Error('timeout')
    }
    expect(await fetchJobsLedgerWithDetailsForStages()).toEqual({ ok: false, error: 'timeout' })
    route = () => {
      throw 'weird'
    }
    expect(await fetchJobsLedgerWithDetailsForStages()).toEqual({ ok: false, error: 'Failed to load jobs' })
  })
})

describe('the min-HCP floor (Job Summary)', () => {
  beforeEach(() => {
    route = (table) => (table === 'jobs_ledger' ? [row({ id: 'a', hcp_number: '250' }), row({ id: 'b', hcp_number: '100' }), row({ id: 'c', hcp_number: 'ABC' }), row({ id: 'd', hcp_number: null as never })] : [])
  })
  it('drops numeric HCPs at or below the floor before enrichment, keeps non-numeric and blank, and counts the hidden', async () => {
    const r = await fetchJobsLedgerWithDetailsForStages({ minHcpExclusive: 100, jobSummaryEnrich: true })
    expect(r.ok && r.jobs.map((j) => j.id)).toEqual(['a', 'c', 'd'])
    expect(r.ok && r.hiddenByMinHcp).toBe(1)
    const mats = queries.find((q) => q.table === 'jobs_ledger_materials')!
    expect(stepArgs(mats, 'in')).toEqual([['job_id', ['a', 'c', 'd']]])
  })
  it('a floor that hides every row short-circuits enrichment', async () => {
    route = (table) => (table === 'jobs_ledger' ? [row({ id: 'a', hcp_number: '250' }), row({ id: 'b', hcp_number: '100' })] : [])
    const r = await fetchJobsLedgerWithDetailsForStages({ minHcpExclusive: 999, jobSummaryEnrich: true })
    expect(r).toEqual({ ok: true, jobs: [], hiddenByMinHcp: 2 })
    expect(tables()).toEqual(['jobs_ledger'])
  })
  it('-1 is the lowest floor (nothing hidden); NaN and null apply no floor', async () => {
    const r1 = await fetchJobsLedgerWithDetailsForStages({ minHcpExclusive: -1, jobSummaryEnrich: true })
    expect(r1.ok && r1.hiddenByMinHcp).toBe(0)
    const r2 = await fetchJobsLedgerWithDetailsForStages({ minHcpExclusive: Number.NaN, jobSummaryEnrich: true })
    expect(r2.ok && r2.hiddenByMinHcp).toBeUndefined()
    const r3 = await fetchJobsLedgerWithDetailsForStages({ minHcpExclusive: null, jobSummaryEnrich: true })
    expect(r3.ok && r3.hiddenByMinHcp).toBeUndefined()
  })
})

describe('enrichJobsLedgerPrimaryRows', () => {
  const fullRow = row({
    id: 'j1',
    jobs_ledger_payments: [{ id: 'p2', sequence_order: 2 }, { id: 'p1', sequence_order: 1 }] as never,
    jobs_ledger_invoices: [{ id: 'i2', sequence_order: 2 }, { id: 'i1', sequence_order: 1 }] as never,
    jobs_ledger_team_members: [{ id: 't1', user_id: 'u1', users: { name: 'Ana' } }] as never,
    reports: [{ job_ledger_id: 'j1' }, { job_ledger_id: 'j1' }],
    projects: { id: 'pr1', name: 'Project' },
    bids: { id: 'b1', project_name: 'Bid', bid_number: '7', service_type_id: null },
    gc_customer: [{ id: 'gc1', name: 'GC' }], // PostgREST may hand a to-one embed back as a 1-element array
    development: { id: 'd1', name: 'Dev' },
    account_manager: null,
    service_types: { name: 'Plumbing' },
  })

  it('maps embeds onto the job shape (sorted payments/invoices, one-of embeds, linked bid, service type) and batches the four enrichments', async () => {
    route = (table) => {
      switch (table) {
        case 'jobs_ledger_materials':
          return [{ id: 'm2', job_id: 'j1', sequence_order: 2 }, { id: 'm1', job_id: 'j1', sequence_order: 1 }]
        case 'jobs_ledger_fixtures':
          return [{ id: 'f1', job_id: 'j1', sequence_order: 1 }, { id: 'f0', job_id: 'other', sequence_order: 0 }]
        case 'job_schedule_blocks':
          return [{ job_id: 'j1', work_date: '2026-09-01' }, { job_id: 'j1', work_date: '2026-09-09' }, { job_id: 'j1', work_date: 'junk' }]
        case 'estimates':
          return [
            { job_ledger_id: 'j1', estimate_number: 3, title: 'Draft', status: 'draft', updated_at: '2026-09-05' },
            { job_ledger_id: 'j1', estimate_number: 2, title: 'Accepted', status: 'customer_accepted', updated_at: '2026-09-01' },
            { job_ledger_id: null, estimate_number: 9, title: 'Orphan', status: 'draft', updated_at: '2026-09-09' },
          ]
        default:
          return []
      }
    }
    const [job] = await enrichJobsLedgerPrimaryRows([fullRow])
    expect(tables()).toEqual(['jobs_ledger_materials', 'jobs_ledger_fixtures', 'job_schedule_blocks', 'estimates'])
    for (const q of queries) expect(stepArgs(q, 'in')[0]![1]).toEqual(['j1'])
    expect(job).toMatchObject({
      id: 'j1',
      serviceType: { name: 'Plumbing' },
      payments: [{ id: 'p1' }, { id: 'p2' }],
      invoices: [{ id: 'i1' }, { id: 'i2' }],
      team_members: [{ id: 't1' }],
      report_count: 2,
      project: { id: 'pr1', name: 'Project' },
      gcCustomer: { id: 'gc1', name: 'GC' },
      development: { id: 'd1', name: 'Dev' },
      account_manager: null,
      linkedBid: { id: 'b1', project_name: 'Bid', bid_number: '7', service_type_id: null },
      materials: [{ id: 'm1' }, { id: 'm2' }],
      fixtures: [{ id: 'f1' }],
      last_schedule_work_date: '2026-09-09',
      linkedEstimateForStages: { estimate_number: 2, title: 'Accepted', status: 'customer_accepted' },
    })
    expect('jobs_ledger_payments' in job!).toBe(false) // raw embeds do not leak through
    expect('service_types' in job!).toBe(false)
  })

  it('defaults for a bare row: empty lists, zero reports, nulls, and Stages fields unset', async () => {
    const [job] = await enrichJobsLedgerPrimaryRows([row({ id: 'j2' })])
    expect(job).toMatchObject({
      id: 'j2',
      serviceType: null,
      payments: [],
      invoices: [],
      team_members: [],
      report_count: 0,
      project: null,
      gcCustomer: null,
      development: null,
      account_manager: null,
      linkedBid: null,
      materials: [],
      fixtures: [],
      last_schedule_work_date: null,
      linkedEstimateForStages: null,
    })
  })

  it('splits every batch into chunks of 150 job ids', async () => {
    const rows = Array.from({ length: 151 }, (_, i) => row({ id: `j${i}` }))
    await enrichJobsLedgerPrimaryRows(rows)
    const byTable = (t: string) => queries.filter((q) => q.table === t).map((q) => (stepArgs(q, 'in')[0]![1] as string[]).length)
    expect(byTable('jobs_ledger_materials')).toEqual([150, 1])
    expect(byTable('jobs_ledger_fixtures')).toEqual([150, 1])
    expect(byTable('job_schedule_blocks')).toEqual([150, 1])
    expect(byTable('estimates')).toEqual([150, 1])
  })

  it('a failed batch degrades: the job still loads with that enrichment empty, and the other batches still run', async () => {
    route = (table) => {
      if (table === 'jobs_ledger_fixtures') throw new Error('fixtures down')
      if (table === 'job_schedule_blocks') return [{ job_id: 'j1', work_date: '2026-09-02' }]
      if (table === 'estimates') throw new Error('estimates down')
      return []
    }
    const [job] = await enrichJobsLedgerPrimaryRows([fullRow])
    expect(job).toMatchObject({ materials: [], fixtures: [], last_schedule_work_date: '2026-09-02', linkedEstimateForStages: null })
    expect(warn).toHaveBeenCalledTimes(2)
    expect(tables()).toEqual(['jobs_ledger_materials', 'jobs_ledger_fixtures', 'job_schedule_blocks', 'estimates'])
  })

  it('the Job Summary slim path batches materials and the discount rows only (v2.3273)', async () => {
    route = (table) =>
      table === 'jobs_ledger'
        ? [fullRow]
        : table === 'jobs_ledger_materials'
          ? [{ id: 'm1', job_id: 'j1', sequence_order: 1 }]
          : table === 'jobs_ledger_fixtures'
            ? [{ id: 'd1', job_id: 'j1', sequence_order: 3, name: 'Negotiated discount', line_unit_price: -100, line_kind: 'discount' }]
            : []
    const r = await fetchJobsLedgerWithDetailsForStages({ jobSummaryEnrich: true })
    expect(tables()).toEqual(['jobs_ledger', 'jobs_ledger_materials', 'jobs_ledger_fixtures'])
    expect(r.ok && r.jobs[0]).toMatchObject({
      id: 'j1',
      materials: [{ id: 'm1' }],
      fixtures: [{ id: 'd1', line_kind: 'discount' }],
      gcCustomer: { id: 'gc1', name: 'GC' },
      last_schedule_work_date: null,
      linkedEstimateForStages: null,
    })
  })
})
