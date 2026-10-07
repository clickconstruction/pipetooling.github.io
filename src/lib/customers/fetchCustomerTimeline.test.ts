import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The timeline's reads: the jobs on either link, every part in batches of ids, the second
 * wave (deposits, authors, report names), the row mapping, and each part failing soft into
 * `missing` instead of failing the window.
 */
type Step = { method: string; args: unknown[] }
const calls: Array<{ name: string; steps: Step[] }> = []
let route: (name: string, steps: Step[]) => { data: unknown; error: { message: string } | null } = () => ({ data: [], error: null })
function recorder(name: string) {
  const steps: Step[] = []
  calls.push({ name, steps })
  const p: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(route(name, steps))
        return (...a: unknown[]) => {
          steps.push({ method: String(prop), args: a })
          return p
        }
      },
    },
  )
  return p
}
vi.mock('../supabase', () => ({ supabase: { from: (table: string) => recorder(table) } }))
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))

import { REPORT_FIELD_LABEL_JOB_COMPLETION } from '../reportTemplateFieldDisplay'
import { CUSTOMER_TIMELINE_JOB_CAP, customerTimelineMissingWords, fetchCustomerTimeline } from './fetchCustomerTimeline'

const CUSTOMER_ID = '11111111-2222-4333-8444-555555555555'
const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const inIds = (steps: Step[]) => (argsOf(steps, 'in')[0]?.[1] ?? []) as string[]
const jobRow = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  hcp_number: id.slice(-3),
  click_number: null,
  job_name: 'Clinic',
  job_address: '12 Bluff Springs Rd, Austin, TX',
  status: 'billed',
  revenue: '1000.5',
  payments_made: 0,
  created_at: '2026-03-02T15:00:00Z',
  customer_id: CUSTOMER_ID,
  customer_name: 'Ridgeway Builders',
  gc_customer_id: null,
  collections_at: null,
  collections_note: null,
  uncollectible_at: null,
  uncollectible_reason: null,
  ...over,
})

beforeEach(() => {
  calls.length = 0
  route = () => ({ data: [], error: null })
})

describe('fetchCustomerTimeline', () => {
  it('reads the jobs where the customer pays or is the GC, and every part for them in batches', async () => {
    const jobs = Array.from({ length: 81 }, (_, i) => jobRow(`job-${String(i).padStart(3, '0')}`))
    route = (name) => {
      if (name === 'customers') return { data: { id: CUSTOMER_ID, name: 'Ridgeway Builders', created_at: '2024-11-12T16:00:00Z', date_met: null }, error: null }
      if (name === 'jobs_ledger') return { data: jobs, error: null }
      return { data: [], error: null }
    }
    const load = await fetchCustomerTimeline(CUSTOMER_ID)
    const jobsCall = calls.find((c) => c.name === 'jobs_ledger')!
    expect(argsOf(jobsCall.steps, 'or')[0]).toEqual([`customer_id.eq.${CUSTOMER_ID},gc_customer_id.eq.${CUSTOMER_ID}`])
    expect(argsOf(jobsCall.steps, 'limit')[0]).toEqual([CUSTOMER_TIMELINE_JOB_CAP + 1])
    // 81 jobs read in two batches, for each of the ten per-job parts.
    for (const table of ['jobs_ledger_invoices', 'jobs_ledger_payments', 'job_status_events', 'jobs_ledger_thread_notes', 'clock_sessions', 'reports', 'job_test_reports', 'supply_house_invoice_job_allocations', 'job_payment_promises', 'job_lien_filings']) {
      const batches = calls.filter((c) => c.name === table)
      expect(batches.map((b) => inIds(b.steps).length), table).toEqual([80, 1])
    }
    const clock = calls.find((c) => c.name === 'clock_sessions')!
    expect(argsOf(clock.steps, 'is')).toEqual([['revoked_at', null], ['rejected_at', null]])
    expect(argsOf(calls.find((c) => c.name === 'gc_statement_emails')!.steps, 'eq')[0]).toEqual(['gc_customer_id', CUSTOMER_ID])
    // No payments, notes or reports: no second wave.
    expect(calls.some((c) => c.name === 'mercury_transactions' || c.name === 'users' || c.name === 'report_templates')).toBe(false)
    expect(load.input.jobs).toHaveLength(81)
    expect(load.input.jobs[0]).toMatchObject({ id: 'job-000', revenue: 1000.5, paymentsMade: 0, customerId: CUSTOMER_ID })
    expect(load.missing).toEqual([])
    expect(load.jobCapHit).toBe(false)
  })

  it('maps deposits, authors, report names and supply tickets, and fails a part soft', async () => {
    route = (name) => {
      switch (name) {
        case 'customers':
          return { data: { id: CUSTOMER_ID, name: 'Ridgeway Builders', created_at: null, date_met: '2024-11-12' }, error: null }
        case 'jobs_ledger':
          return { data: [jobRow('job-1')], error: null }
        case 'jobs_ledger_payments':
          return { data: [{ id: 'p1', job_id: 'job-1', invoice_id: 'i1', amount: '22000', paid_on: '2026-06-01', payment_type: 'check', reference_number: '4471', mercury_transaction_id: 'm1' }], error: null }
        case 'mercury_transactions':
          return { data: [{ id: 'm1', posted_at: '2026-06-03T14:00:00Z', counterparty_name: 'Ridgeway Builders' }], error: null }
        case 'jobs_ledger_thread_notes':
          return { data: null, error: { message: 'permission denied' } }
        case 'reports':
          return { data: [{ id: 'r1', job_ledger_id: 'job-1', template_id: 't1', created_at: '2026-07-17T15:00:00Z', created_by_user_id: 'u1', field_values: { [REPORT_FIELD_LABEL_JOB_COMPLETION]: '100', Notes: 'Final passed' } }], error: null }
        case 'users':
          return { data: [{ id: 'u1', name: 'Ben Ortiz', role: 'master_technician' }], error: null }
        case 'report_templates':
          return { data: [{ id: 't1', name: 'Daily report' }], error: null }
        case 'supply_house_invoice_job_allocations':
          return {
            data: [{ invoice_id: 's1', job_id: 'job-1', pct: '50', supply_house_invoices: { id: 's1', invoice_number: 'F-2', invoice_date: '2026-03-20', amount: '6210', supply_houses: [{ name: 'Ferguson' }] } }],
            error: null,
          }
        case 'job_lien_filings':
          return { data: [{ id: 'f1', job_id: 'job-1', kind: 'notice_53_056', created_at: '2026-09-15T15:00:00Z', amount: 31250, sends: [{ method: 'certified_mail', recipient: 'owner', sent_on: '2026-09-15' }] }], error: null }
        default:
          return { data: [], error: null }
      }
    }
    const load = await fetchCustomerTimeline(CUSTOMER_ID)
    expect(load.missing).toEqual(['notes'])
    expect(load.input.payments[0]).toMatchObject({ amount: 22000, depositPostedAt: '2026-06-03T14:00:00Z', depositFrom: 'Ridgeway Builders' })
    expect(load.input.reports[0]).toMatchObject({ templateName: 'Daily report', authorName: 'Ben Ortiz', preview: 'Final passed', percent: 100 })
    expect(load.input.supplyTickets[0]).toMatchObject({ amount: 3105, supplyHouse: 'Ferguson', invoiceDate: '2026-03-20' })
    expect(load.input.lienFilings[0]?.sends).toEqual([{ method: 'certified_mail', recipient: 'owner', sentOn: '2026-09-15' }])
    expect(load.input.customer).toEqual({ id: CUSTOMER_ID, name: 'Ridgeway Builders', createdAt: null, dateMet: '2024-11-12' })
    // The report author was read with the note authors.
    expect(inIds(calls.find((c) => c.name === 'users')!.steps)).toEqual(['u1'])
  })

  it('says when there are more jobs than it reads', async () => {
    route = (name) =>
      name === 'customers'
        ? { data: { id: CUSTOMER_ID, name: 'Big GC', created_at: null, date_met: null }, error: null }
        : name === 'jobs_ledger'
          ? { data: Array.from({ length: CUSTOMER_TIMELINE_JOB_CAP + 1 }, (_, i) => jobRow(`job-${i}`)), error: null }
          : { data: [], error: null }
    const load = await fetchCustomerTimeline(CUSTOMER_ID)
    expect(load.jobCapHit).toBe(true)
    expect(load.input.jobs).toHaveLength(CUSTOMER_TIMELINE_JOB_CAP)
  })

  it('refuses anything but a customer id', async () => {
    await expect(fetchCustomerTimeline('x,status.eq.paid')).rejects.toThrow('Not a customer id')
    expect(calls).toHaveLength(0)
  })
})

describe('customerTimelineMissingWords', () => {
  it('names what could not be read, what was cut, and an empty load says nothing', () => {
    expect(customerTimelineMissingWords({ missing: [], capped: [], jobCapHit: false })).toBe('')
    expect(customerTimelineMissingWords({ missing: ['notes', 'crew hours'], capped: ['bills'], jobCapHit: true })).toBe(
      'Could not read notes, crew hours. Only the newest 1000 rows of bills are shown. Only the newest 200 jobs are shown.',
    )
  })
})
