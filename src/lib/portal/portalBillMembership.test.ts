import { describe, it, expect } from 'vitest'
// Deno edge module (supabase/functions/_shared) — dependency-free, tested here.
import {
  PORTAL_OPEN_INVOICE_STATUS,
  jobCarriesOpenBills,
  jobPrintsShellRemainder,
  openBillJobIds,
} from '../../../supabase/functions/_shared/portalBillMembership'
import { buildPortalBills, type PortalJobRow } from '../../../supabase/functions/_shared/portalMergedBills'

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

function inv(id: string, job_id: string, amount: number, billed_at: string) {
  return { id, job_id, amount, status: 'billed', billed_at, sequence_order: 1, hosted_invoice_url: `https://pay.example/${id}` }
}

describe('portal bill membership (one rule, same as the GC statement payload RPC)', () => {
  it('lists billed invoices only', () => {
    expect(PORTAL_OPEN_INVOICE_STATUS).toBe('billed')
  })

  it('a job of ANY non-paid status carries its billed invoices onto the statement', () => {
    for (const s of ['billed', 'working', 'waiting', 'ready_to_bill', 'collections', 'in_progress', 'scheduled']) {
      expect(jobCarriesOpenBills(s)).toBe(true)
    }
  })

  it('paid jobs never carry open bills; unknown status is excluded like SQL `status <> paid` on NULL', () => {
    expect(jobCarriesOpenBills('paid')).toBe(false)
    expect(jobCarriesOpenBills(null)).toBe(false)
    expect(jobCarriesOpenBills(undefined)).toBe(false)
    expect(jobCarriesOpenBills('')).toBe(false)
  })

  it('only `billed` jobs may print the invoice-less shell remainder', () => {
    expect(jobPrintsShellRemainder('billed')).toBe(true)
    for (const s of ['working', 'waiting', 'ready_to_bill', 'collections', 'paid', null, undefined]) {
      expect(jobPrintsShellRemainder(s)).toBe(false)
    }
  })

  it('openBillJobIds keeps every non-paid job id in order', () => {
    const jobs = [job({ id: 'a', status: 'working' }), job({ id: 'b', status: 'paid' }), job({ id: 'c' }), job({ id: 'd', status: null })]
    expect(openBillJobIds(jobs)).toEqual(['a', 'c'])
  })
})

describe('buildPortalBills applies the membership rule', () => {
  it('includes billed invoices on working jobs (the J21-F1 live gap: 11 bills shown of 16 owed)', () => {
    // Shape of the live specimen: bills on `billed` jobs already showed; the
    // five 9/1 progress bills on working jobs 977/963/978 did not.
    const jobs = [
      job({ id: 'b1', hcp_number: '901' }),
      job({ id: 'b2', hcp_number: '902' }),
      job({ id: 'w977', hcp_number: '977', status: 'working', revenue: 50000, payments_made: 0 }),
      job({ id: 'w963', hcp_number: '963', status: 'working', revenue: 40000, payments_made: 0 }),
      job({ id: 'w978', hcp_number: '978', status: 'working', revenue: 30000, payments_made: 0 }),
    ]
    const invoices = [
      inv('i1', 'b1', 12000, '2026-08-10'),
      inv('i2', 'b2', 7453.47, '2026-08-20'),
      inv('i3', 'w977', 5000, '2026-09-01'),
      inv('i4', 'w977', 3000, '2026-09-01'),
      inv('i5', 'w963', 6000, '2026-09-01'),
      inv('i6', 'w963', 2582.8, '2026-09-01'),
      inv('i7', 'w978', 2000, '2026-09-01'),
    ]
    const bills = buildPortalBills({ jobs, invoices, payments: [], viewerCustomerId: VIEWER, markGcRows: true })
    expect(bills).toHaveLength(7)
    const total = Math.round(bills.reduce((s, b) => s + b.amount, 0) * 100) / 100
    expect(total).toBe(38036.27)
    const workingRows = bills.filter((b) => ['977', '963', '978'].includes(b.jobNumber))
    expect(workingRows).toHaveLength(5)
    expect(workingRows.every((b) => b.billedOn === '2026-09-01' && b.payUrl !== null)).toBe(true)
    // The job-level revenue remainders of the working jobs never appear as bills.
    expect(bills.some((b) => b.billedOn === null)).toBe(false)
  })

  it('a working job with no billed invoice prints NOTHING — never its revenue remainder', () => {
    const jobs = [job({ id: 'w', hcp_number: '55', status: 'working', revenue: 9000, payments_made: 0 })]
    expect(buildPortalBills({ jobs, invoices: [], payments: [], viewerCustomerId: VIEWER, markGcRows: true })).toEqual([])
  })

  it('a billed job with no billed invoice still prints its shell remainder', () => {
    const jobs = [job({ id: 'shell', hcp_number: '77', revenue: 900, payments_made: 150 })]
    const bills = buildPortalBills({ jobs, invoices: [], payments: [], viewerCustomerId: VIEWER, markGcRows: true })
    expect(bills.map((b) => [b.jobNumber, b.amount, b.billedOn])).toEqual([['77', 750, null]])
  })

  it('billed invoices on a paid job are excluded, matching the GC payload', () => {
    const jobs = [job({ id: 'p', hcp_number: '1', status: 'paid' })]
    const invoices = [inv('i', 'p', 100, '2026-08-01')]
    expect(buildPortalBills({ jobs, invoices, payments: [], viewerCustomerId: VIEWER, markGcRows: true })).toEqual([])
  })

  it('per-job recap arithmetic holds on a working job: billed to date − payments = balance', () => {
    const jobs = [job({ id: 'w', hcp_number: '963', status: 'working' })]
    const invoices = [inv('a', 'w', 6000, '2026-09-01'), inv('b', 'w', 2582.8, '2026-09-01')]
    const payments = [{ invoice_id: 'a', amount: 1500, paid_on: '2026-09-03', payment_type: 'check' }]
    const bills = buildPortalBills({ jobs, invoices, payments, viewerCustomerId: VIEWER, markGcRows: true })
    const billedToDate = invoices.reduce((s, i) => s + i.amount, 0)
    const paid = bills.reduce((s, b) => s + b.totalPaid, 0)
    const balance = bills.reduce((s, b) => s + b.amount, 0)
    expect(Math.round((billedToDate - paid) * 100) / 100).toBe(Math.round(balance * 100) / 100)
    expect(bills.find((b) => b.totalPaid === 1500)?.payments).toEqual([{ date: '2026-09-03', method: 'check', amount: 1500 }])
  })
})
