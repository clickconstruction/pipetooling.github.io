import { beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchPayReportInputs, payReportContact, payReportUserForName } from './payReportInputs'

/**
 * The pay report's one input fetch (v2.3874): the crew maps, the two lookups only when the days
 * name jobs or bids, the possessions by the user the pay name resolves to, the stub's own lines,
 * the payments only for a saved stub, and the contact line's fallback order.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
const rpcs: Array<{ fn: string; args: unknown }> = []
let route: (table: string, steps: Step[]) => { data: unknown; error: null } = () => ({ data: [], error: null })
let rpcRoute: (fn: string) => { data: unknown; error: null } = () => ({ data: [], error: null })
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
  rpc: async (fn: string, args: unknown) => { rpcs.push({ fn, args }); return rpcRoute(fn) },
} as unknown as SupabaseClient

const users = [{ id: 'u-ana', name: 'Ana Ruiz', email: 'ana@x.test', phone: '210' }]
const people = [{ name: 'Ana Ruiz', email: 'ana@people.test', phone: null }]
const tables = () => queries.map((q) => q.table)

beforeEach(() => {
  queries.length = 0
  rpcs.length = 0
  route = () => ({ data: [], error: null })
  rpcRoute = () => ({ data: [], error: null })
})

describe('the roster readers', () => {
  it('find the user by the pay name, case-blind and trimmed', () => {
    expect(payReportUserForName(users, '  ana ruiz ')?.id).toBe('u-ana')
    expect(payReportUserForName(users, 'Bob')).toBeNull()
  })
  it('the contact line prefers the People row, then the user, then nulls', () => {
    expect(payReportContact(people, users, 'Ana Ruiz')).toEqual({ email: 'ana@people.test', phone: null })
    expect(payReportContact([], users, 'Ana Ruiz')).toEqual({ email: 'ana@x.test', phone: '210' })
    expect(payReportContact([], [], 'Ana Ruiz')).toEqual({ email: null, phone: null })
  })
})

describe('fetchPayReportInputs', () => {
  const base = { personName: 'Ana Ruiz', periodStart: '2026-09-20', periodEnd: '2026-09-26', payStubId: 'stub-1', users, people }

  it('with no crew rows: no lookups, empty lines, a dash per day; the preview reads no payments', async () => {
    const out = await fetchPayReportInputs(supabase, { ...base, dayRows: [{ work_date: '2026-09-21', hours: 8 }], includePayments: false })
    expect(rpcs).toEqual([])
    expect(out.rowsWithJobs).toEqual([{ date: '2026-09-21', hours: 8, jobsText: '—' }])
    expect(out.physicalPayments).toEqual([])
    expect(tables()).not.toContain('pay_stub_payments')
    expect(tables()).toEqual(expect.arrayContaining(['people_crew_jobs', 'people_crew_bids', 'vehicle_possessions', 'housing_possessions', 'person_offsets', 'pay_stub_deductions', 'pay_stub_additional_lines']))
    expect(out.contact).toEqual({ email: 'ana@people.test', phone: null })
  })

  it('with crew rows: the two lookups run for the ids the person’s days name, and the day line prices them', async () => {
    route = (table) => {
      if (table === 'people_crew_jobs') return { data: [{ work_date: '2026-09-21', person_name: 'Ana Ruiz', job_assignments: [{ job_id: 'j1', pct: 100 }] }], error: null }
      if (table === 'people_crew_bids') return { data: [{ work_date: '2026-09-22', person_name: 'Ana Ruiz', bid_assignments: [{ bid_id: 'b1', pct: 50 }] }], error: null }
      if (table === 'pay_stub_payments') return { data: [{ paid_at: '2026-09-27', amount: 500, memo: 'check' }], error: null }
      if (table === 'pay_stub_deductions') return { data: [{ amount: 25, description: 'tools', source: 'manual' }], error: null }
      return { data: [], error: null }
    }
    rpcRoute = (fn) => (fn === 'get_jobs_ledger_by_ids' ? { data: [{ id: 'j1', hcp_number: '4021', job_name: 'Kitchen', job_address: '' }], error: null } : { data: [{ id: 'b1', bid_number: 'B482', project_name: 'Park', address: '' }], error: null })
    const out = await fetchPayReportInputs(supabase, { ...base, dayRows: [{ work_date: '2026-09-21', hours: 8 }, { work_date: '2026-09-22', hours: 4 }], includePayments: true })
    expect(rpcs).toEqual([
      { fn: 'get_jobs_ledger_by_ids', args: { p_job_ids: ['j1'] } },
      { fn: 'get_bids_by_ids', args: { p_bid_ids: ['b1'] } },
    ])
    expect(out.rowsWithJobs).toEqual([
      { date: '2026-09-21', hours: 8, jobsText: 'Job 4021 (Kitchen) 8.00 hrs' },
      { date: '2026-09-22', hours: 4, jobsText: 'Bid B482 (Park) 2.00 hrs' },
    ])
    expect(out.physicalPayments).toEqual([{ paid_at: '2026-09-27', amount: 500, memo: 'check' }])
    expect(out.lessDeductionLines).toEqual([{ amount: 25, description: 'tools', source: 'manual' }])
  })

  it('the stub’s own lines are read by the stub id; the possessions by the user the pay name resolves to', async () => {
    await fetchPayReportInputs(supabase, { ...base, dayRows: [], includePayments: true })
    const q = (t: string) => queries.find((x) => x.table === t)!.steps.map((s) => [s.method, ...s.args])
    expect(q('pay_stub_deductions')).toEqual([['select', 'amount, description, source'], ['eq', 'pay_stub_id', 'stub-1'], ['order', 'created_at', { ascending: true }]])
    expect(q('pay_stub_payments')).toEqual([['select', 'paid_at, amount, memo'], ['eq', 'pay_stub_id', 'stub-1'], ['order', 'paid_at', { ascending: true }]])
    expect(q('vehicle_possessions')[1]).toEqual(['eq', 'user_id', 'u-ana'])
    expect(q('person_offsets')).toEqual([['select', 'type, amount, description'], ['eq', 'person_name', 'Ana Ruiz'], ['is', 'pay_stub_id', null]])
  })

  it('a pay name with no user reads no vehicles or housing', async () => {
    const out = await fetchPayReportInputs(supabase, { ...base, personName: 'Nobody', dayRows: [], includePayments: false })
    expect(tables()).not.toContain('vehicle_possessions')
    expect(tables()).not.toContain('housing_possessions')
    expect(out.vehicles).toEqual([])
    expect(out.housingRows).toEqual([])
  })
})
