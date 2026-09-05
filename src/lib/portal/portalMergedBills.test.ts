import { describe, it, expect } from 'vitest'
// Deno edge module (supabase/functions/_shared) — dependency-free, tested here.
import {
  buildPortalBills,
  dedupeJobsById,
  jobIsAsGc,
  jobLabel,
  jobTradeTag,
  type PortalJobRow,
} from '../../../supabase/functions/_shared/portalMergedBills'

const VIEWER = 'cust-knight'

function job(over: Partial<PortalJobRow> & { id: string }): PortalJobRow {
  return {
    hcp_number: null,
    click_number: null,
    job_name: null,
    job_address: null,
    status: 'billed',
    revenue: null,
    payments_made: null,
    customer_id: VIEWER,
    gc_customer_id: null,
    ...over,
  }
}

describe('dedupeJobsById', () => {
  it('keeps the first occurrence of a job that matches both sides of the union', () => {
    const a = job({ id: 'j1' })
    const b = job({ id: 'j1', job_name: 'dup' })
    const c = job({ id: 'j2' })
    expect(dedupeJobsById([a, b, c])).toEqual([a, c])
  })
})

describe('jobIsAsGc', () => {
  it('is true only when the job belongs to another account', () => {
    expect(jobIsAsGc(job({ id: 'j', customer_id: 'someone-else' }), VIEWER)).toBe(true)
    expect(jobIsAsGc(job({ id: 'j', customer_id: VIEWER }), VIEWER)).toBe(false)
    expect(jobIsAsGc(job({ id: 'j', customer_id: null }), VIEWER)).toBe(false)
  })
})

describe('buildPortalBills', () => {
  it('marks GC rows with asGc + ownerName in the merged view only', () => {
    const jobs = [
      job({ id: 'own', job_name: 'Vet clinic', hcp_number: '963' }),
      job({ id: 'gc', job_name: 'Bexar Lofts', hcp_number: '1302', customer_id: 'cust-lofts', gc_customer_id: VIEWER }),
    ]
    const invoices = [
      { id: 'i1', job_id: 'own', amount: 2200, status: 'billed', billed_at: '2026-08-12', sequence_order: 1, hosted_invoice_url: null },
      { id: 'i2', job_id: 'gc', amount: 28500, status: 'billed', billed_at: '2026-08-20', sequence_order: 1, hosted_invoice_url: 'https://pay.example/x' },
    ]
    const merged = buildPortalBills({
      jobs,
      invoices,
      payments: [],
      viewerCustomerId: VIEWER,
      markGcRows: true,
      ownerNames: { 'cust-lofts': 'Bexar Lofts LLC' },
    })
    expect(merged.map((b) => [b.jobNumber, b.asGc, b.ownerName])).toEqual([
      ['1302', true, 'Bexar Lofts LLC'],
      ['963', false, null],
    ])

    const scoped = buildPortalBills({
      jobs,
      invoices,
      payments: [],
      viewerCustomerId: VIEWER,
      markGcRows: false,
      ownerNames: { 'cust-lofts': 'Bexar Lofts LLC' },
    })
    expect(scoped.every((b) => !b.asGc && b.ownerName === null)).toBe(true)
  })

  it('subtracts payments per invoice and drops settled lines', () => {
    const jobs = [job({ id: 'j1', hcp_number: '10' })]
    const invoices = [
      { id: 'i1', job_id: 'j1', amount: 1000, status: 'billed', billed_at: '2026-08-01', sequence_order: 1, hosted_invoice_url: null },
      { id: 'i2', job_id: 'j1', amount: 500, status: 'billed', billed_at: '2026-08-02', sequence_order: 2, hosted_invoice_url: null },
    ]
    const payments = [
      { invoice_id: 'i1', amount: 400 },
      { invoice_id: 'i1', amount: 350 },
      { invoice_id: 'i2', amount: 500 },
    ]
    const bills = buildPortalBills({ jobs, invoices, payments, viewerCustomerId: VIEWER, markGcRows: true })
    expect(bills).toHaveLength(1)
    expect(bills[0]?.amount).toBe(250)
  })

  it('falls back to the job-level remainder for billed jobs with no billed line', () => {
    const jobs = [job({ id: 'shell', hcp_number: '77', revenue: 900, payments_made: 150, customer_id: 'other', gc_customer_id: VIEWER })]
    const bills = buildPortalBills({ jobs, invoices: [], payments: [], viewerCustomerId: VIEWER, markGcRows: true })
    expect(bills).toHaveLength(1)
    expect(bills[0]?.amount).toBe(750)
    expect(bills[0]?.asGc).toBe(true)
    expect(bills[0]?.ownerName).toBeNull() // owner name unknown → tag still renders, name omitted
  })

  it('sorts undated rows first, then newest billed (matching the shipped statement order)', () => {
    const jobs = [job({ id: 'a', hcp_number: '1' }), job({ id: 'b', hcp_number: '2' }), job({ id: 'c', hcp_number: '3', revenue: 10 })]
    const invoices = [
      { id: 'ia', job_id: 'a', amount: 100, status: 'billed', billed_at: '2026-08-01', sequence_order: 1, hosted_invoice_url: null },
      { id: 'ib', job_id: 'b', amount: 100, status: 'billed', billed_at: '2026-08-15', sequence_order: 1, hosted_invoice_url: null },
    ]
    const bills = buildPortalBills({ jobs, invoices, payments: [], viewerCustomerId: VIEWER, markGcRows: true })
    expect(bills.map((b) => b.jobNumber)).toEqual(['3', '2', '1'])
  })

  it('a non-billed job with no billed invoice contributes nothing (no shell remainder)', () => {
    const jobs = [job({ id: 'j1', status: 'in_progress', revenue: 500 })]
    expect(buildPortalBills({ jobs, invoices: [], payments: [], viewerCustomerId: VIEWER, markGcRows: true })).toEqual([])
  })

  it('a billed invoice on a working job IS a bill (membership rule in portalBillMembership.ts)', () => {
    const jobs = [job({ id: 'w', hcp_number: '977', status: 'working', revenue: 50000 })]
    const invoices = [
      { id: 'i1', job_id: 'w', amount: 5000, status: 'billed', billed_at: '2026-09-01', sequence_order: 1, hosted_invoice_url: 'https://pay.example/i1' },
    ]
    const bills = buildPortalBills({ jobs, invoices, payments: [], viewerCustomerId: VIEWER, markGcRows: true })
    expect(bills.map((b) => [b.jobNumber, b.amount, b.billedOn])).toEqual([['977', 5000, '2026-09-01']])
  })
})

describe('jobLabel', () => {
  it('composes name and number like the statement expects', () => {
    expect(jobLabel(job({ id: 'j', job_name: 'Vet clinic', hcp_number: '963' }))).toBe('Vet clinic · Job 963')
    expect(jobLabel(job({ id: 'j', job_name: '', hcp_number: '12' }))).toBe('Job 12')
    expect(jobLabel(job({ id: 'j' }))).toBe('Job')
  })
})

describe('jobTradeTag', () => {
  it('maps the embedded service type to the board trade tags; unknown/absent → null', () => {
    expect(jobTradeTag(job({ id: 'j', service_types: { name: 'Plumbing' } }))).toBe('plum')
    expect(jobTradeTag(job({ id: 'j', service_types: { name: 'Electrical' } }))).toBe('elec')
    expect(jobTradeTag(job({ id: 'j', service_types: { name: 'HVAC' } }))).toBe('hvac')
    expect(jobTradeTag(job({ id: 'j', service_types: { name: 'Landscaping' } }))).toBeNull()
    expect(jobTradeTag(job({ id: 'j' }))).toBeNull()
  })

  it('bills carry serviceTag + bare jobName for the trade-first statement line', () => {
    const bills = buildPortalBills({
      jobs: [job({ id: 'j1', job_name: 'Vet clinic', hcp_number: '963', revenue: 100, payments_made: 0, service_types: { name: 'HVAC' } })],
      invoices: [],
      payments: [],
      viewerCustomerId: VIEWER,
      markGcRows: false,
      ownerNames: {},
    })
    expect(bills[0]).toMatchObject({ serviceTag: 'hvac', jobName: 'Vet clinic' })
  })
})
