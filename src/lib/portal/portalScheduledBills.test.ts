import { describe, expect, it } from 'vitest'
// Deno edge modules (supabase/functions/_shared), dependency-free, tested here.
import { buildPortalBills, type PortalInvoiceRow, type PortalPaymentRow } from '../../../supabase/functions/_shared/portalMergedBills'
import { buildPortalScheduledBills, jobIsOnInKindDeal, moneyJobsOf, type PortalDealJobRow } from '../../../supabase/functions/_shared/portalScheduledBills'
import { owedJobIdsForViewer } from '../../../supabase/functions/_shared/portalBillMembership'
import { parsePortalPayload } from './portalPayload'

/**
 * The customer's page and a bill an in kind deal pays (v2.8314, punch list #301; the owner's call of
 * 2026-11-22): the bill stays on the page, read as scheduled, with no pay link and not in the amount
 * owed. `customer-portal` hands `buildPortalBills` the money jobs alone (`moneyJobsOf`), so every reader
 * of `bills` and of the balance follows, and `buildPortalScheduledBills` lists the rest for its own card.
 */

const VIEWER = 'cust-calloway'
const DEAL = 'deal-1'

function job(over: Partial<PortalDealJobRow> & { id: string }): PortalDealJobRow {
  return { hcp_number: null, click_number: null, job_name: null, job_address: null, status: 'billed', revenue: null, payments_made: null, customer_id: VIEWER, gc_customer_id: null, ...over }
}
const inv = (over: Partial<PortalInvoiceRow> & { id: string; job_id: string; amount: number }): PortalInvoiceRow => ({ status: 'billed', billed_at: '2026-08-12T18:00:00Z', sequence_order: 1, hosted_invoice_url: 'https://pay.example/' + over.id, ...over })

/** Three jobs: one paid with money, one on the deal with a credit on its bill, one on the deal billed with no bill row. */
const jobs = [
  job({ id: 'money', hcp_number: '1101', job_name: 'Water heater', job_address: '12 Larch Way, Kyle, TX 78640', revenue: 800 }),
  job({ id: 'deal', hcp_number: '1104', job_name: 'Shop restroom', job_address: '40 Mill Rd, Kyle, TX 78640', revenue: 900, in_kind_arrangement_id: DEAL }),
  job({ id: 'shell', hcp_number: '1109', job_name: 'Hose bibs', revenue: 600, payments_made: 100, in_kind_arrangement_id: DEAL }),
]
const invoices = [inv({ id: 'i1', job_id: 'money', amount: 800 }), inv({ id: 'i2', job_id: 'deal', amount: 900, billed_at: '2026-05-01T18:00:00Z' })]
const payments: PortalPaymentRow[] = [{ invoice_id: 'i2', job_id: 'deal', amount: 200, paid_on: '2026-06-01', payment_type: 'In kind' }]
const args = { jobs, invoices, payments, viewerCustomerId: VIEWER }

describe('a bill an in kind deal pays, on the customer\'s page', () => {
  it('is not in the ledger: no row, no pay link, not in the amount owed', () => {
    const bills = buildPortalBills({ ...args, jobs: moneyJobsOf(jobs), markGcRows: false })
    expect(bills.map((b) => b.jobNumber)).toEqual(['1101'])
    expect(bills.reduce((s, b) => s + b.amount, 0)).toBe(800)
    expect(bills.some((b) => (b.payUrl ?? '').includes('i2'))).toBe(false)
  })

  it('is listed apart, oldest first: what was billed, what the credits paid, what is to come', () => {
    expect(buildPortalScheduledBills(args)).toEqual([
      { invoiceId: 'i2', jobLabel: 'Shop restroom · Job 1104', jobNumber: '1104', jobName: 'Shop restroom', serviceTag: null, jobAddress: '40 Mill Rd, Kyle, TX 78640', amount: 700, billedAmount: 900, totalPaid: 200, billedOn: '2026-05-01' },
      // Billed with no bill row: the job's own remainder.
      { invoiceId: null, jobLabel: 'Hose bibs · Job 1109', jobNumber: '1109', jobName: 'Hose bibs', serviceTag: null, jobAddress: null, amount: 500, billedAmount: 600, totalPaid: 100, billedOn: null },
    ])
  })

  it('carries no pay link in any field', () => {
    expect(JSON.stringify(buildPortalScheduledBills(args))).not.toContain('pay.example')
  })

  it('a customer part covered keeps the bill off the deal as money owed', () => {
    const bills = buildPortalBills({ ...args, jobs: moneyJobsOf(jobs), markGcRows: false })
    expect(bills[0]).toMatchObject({ jobNumber: '1101', amount: 800, payUrl: 'https://pay.example/i1' })
  })

  it('an ordinary customer has nothing scheduled and reads as before', () => {
    const plain = jobs.map((j) => ({ ...j, in_kind_arrangement_id: null }))
    expect(buildPortalScheduledBills({ ...args, jobs: plain })).toEqual([])
    expect(moneyJobsOf(plain)).toEqual(plain)
    expect(buildPortalBills({ ...args, jobs: moneyJobsOf(plain), markGcRows: false }).map((b) => b.jobNumber).sort()).toEqual(['1101', '1104', '1109'])
  })

  it('a bill the credits have paid off is listed nowhere', () => {
    const paid: PortalPaymentRow[] = [{ invoice_id: 'i2', job_id: 'deal', amount: 900, paid_on: '2026-06-01', payment_type: 'In kind' }]
    expect(buildPortalScheduledBills({ ...args, payments: paid }).map((b) => b.jobNumber)).toEqual(['1109'])
  })

  it('a bill someone else pays is not this viewer\'s to see as scheduled', () => {
    const builderPays = jobs.map((j) => (j.id === 'deal' ? { ...j, gc_customer_id: 'cust-builder', bill_to_party: 'gc' } : j))
    expect(buildPortalScheduledBills({ ...args, jobs: builderPays }).map((b) => b.jobNumber)).toEqual(['1109'])
  })

  it('a job the deal has let go is owed again', () => {
    expect(jobIsOnInKindDeal(job({ id: 'x', in_kind_arrangement_id: null }))).toBe(false)
    expect(jobIsOnInKindDeal(job({ id: 'x' }))).toBe(false)
  })

  it('no pay-by date is asked for on a job a deal pays', () => {
    expect(owedJobIdsForViewer(moneyJobsOf(jobs), invoices, VIEWER)).toEqual(['money'])
    // A job read with no such column is on no deal, as before.
    const noColumn: PortalDealJobRow[] = jobs.map(({ in_kind_arrangement_id: _gone, ...j }) => j)
    expect(moneyJobsOf(noColumn)).toHaveLength(3)
  })
})

describe('the page reads the list', () => {
  const base = { company: {}, customerName: 'Calloway Holdings', audience: 'customer', bills: [], totalDue: 0, requestableJobs: [] }

  it('parses scheduledBills and tolerates their absence', () => {
    expect(parsePortalPayload(base)!.scheduledBills).toEqual([])
    const p = parsePortalPayload({
      ...base,
      scheduledBills: [
        { invoiceId: 'i2', jobLabel: 'Shop restroom · Job 1104', jobNumber: '1104', jobName: 'Shop restroom', serviceTag: 'plum', jobAddress: '40 Mill Rd, Kyle', amount: 700, billedAmount: 900, totalPaid: 200, billedOn: '2026-05-01' },
        { jobLabel: 'Hose bibs · Job 1109', jobNumber: '1109', amount: 500 },
        { jobLabel: 'Nothing to come', jobNumber: '1', amount: 0 },
        null,
      ],
    })!
    expect(p.scheduledBills).toHaveLength(2)
    expect(p.scheduledBills[0]).toMatchObject({ invoiceId: 'i2', amount: 700, billedAmount: 900, totalPaid: 200, billedOn: '2026-05-01', serviceTag: 'plum' })
    // No billedAmount reads as the open amount, and nothing paid.
    expect(p.scheduledBills[1]).toMatchObject({ invoiceId: null, jobNumber: '1109', billedAmount: 500, totalPaid: 0, billedOn: null })
    // They are never in the ledger or the balance.
    expect(p.bills).toEqual([])
    expect(p.totalDue).toBe(0)
  })
})
