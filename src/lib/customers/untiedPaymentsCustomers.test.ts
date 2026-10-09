/**
 * The one payment rule on the customer side (v2.5010; the owner's call of 2026-10-09): money put on
 * a job with no bill picked pays its bills — the part of the job on no bill first, then the sent
 * bills oldest first. Job 273's live shape runs through every reader v2.5006 left on linked money:
 * the Customer Hub's money strip and its job rows, the Hub's invoice list, the Customers list, the
 * customer timeline, the Dashboard's AR card and the Billed pin. Each must read $16,685.
 */
import { describe, expect, it } from 'vitest'
import { customerMoneyStats, profileJobRowMoney, type ProfileJob } from './customerProfileStats'
import { customersListRollup } from './customersListLcv'
import { buildCustomerInvoiceRows, type CustomerInvoiceInput } from './customerInvoiceRows'
import { buildCustomerTimeline, emptyCustomerTimelineInput, type TimelineJobInput } from './customerTimeline'
import { buildArBuckets, type FinancialJobRow } from '../dashboardFinancials'
import { appliedByInvoiceUnderRule, computeBillTruth } from '../billing/billTruth'

const TODAY = '2026-10-09'
const JOB = 'J273'
const BILLS = [
  { id: 'b0', amount: 13420, sequence_order: 0, billed_at: '2026-03-16T17:00:00Z' },
  { id: 'b1', amount: 665, sequence_order: 1, billed_at: '2026-08-21T17:00:00Z' },
  { id: 'b2', amount: 3500, sequence_order: 2, billed_at: '2026-08-21T17:00:00Z' },
]
const UNTIED: Array<[number, string]> = [
  [12000, '2025-10-10'],
  [1200, '2025-11-11'],
  [8880, '2025-12-19'],
  [17600, '2026-03-10'],
]
const REVENUE = 56365
const PAID = 39680

describe('the Customer Hub', () => {
  const job: ProfileJob = {
    id: JOB,
    status: 'billed',
    revenue: REVENUE,
    payments_made: PAID,
    invoices: BILLS.map((b) => ({ id: b.id, status: 'billed', amount: b.amount, billed_at: b.billed_at, estimated_bill_date: b.billed_at.slice(0, 10), sequence_order: b.sequence_order })),
    payments: UNTIED.map(([amount, paid_on]) => ({ invoice_id: null, amount, paid_on })),
  }

  it('the money strip owes $16,685: the oldest bill keeps $12,520 past 90 days, the two August bills $4,165 (aged by their bill dates)', () => {
    const stats = customerMoneyStats([job], TODAY)
    expect(stats.openBalance).toBe(16685)
    expect(stats.aging.sum90).toBe(12520)
    expect(stats.aging.sum30_90).toBe(4165)
  })

  it("the job's row reads the same", () => {
    expect(profileJobRowMoney(job, TODAY).openBilled).toBe(16685)
  })

  it('the invoice list shows the oldest bill partly paid on the day of the March check; the August bills not yet', () => {
    const invoices: CustomerInvoiceInput[] = BILLS.map((b) => ({
      id: b.id,
      job_id: JOB,
      amount: b.amount,
      status: 'billed',
      sequence_order: b.sequence_order,
      billed_at: b.billed_at,
      estimated_bill_date: null,
      created_at: b.billed_at,
      sent_to_customer_at: null,
      external_send_channel: 'physical',
      stripe_invoice_id: null,
      hosted_invoice_url: null,
    }))
    const payments = UNTIED.map(([amount, paid_on]) => ({ invoice_id: null, amount, paid_on, job_id: JOB }))
    const { rows } = buildCustomerInvoiceRows(invoices, payments, [{ id: JOB, label: '273', status: 'billed', revenue: REVENUE }], TODAY)
    const byId = new Map(rows.map((r) => [r.key, r]))
    const first = [...byId.values()].find((r) => r.amount === 13420)!
    expect([first.status, first.applied, first.lastPaidOnIso]).toEqual(['partial', 900, '2026-03-10'])
    for (const amount of [665, 3500]) {
      const r = [...byId.values()].find((x) => x.amount === amount)!
      expect([r.status, r.applied]).toEqual(['billed', 0])
    }
  })
})

describe('the Customers list and the timeline', () => {
  it("the list's open balance is $16,685", () => {
    const rollup = customersListRollup(
      [{ id: JOB, customer_id: 'c-umar', status: 'billed', revenue: REVENUE, payments_made: PAID }],
      BILLS.map((b) => ({ id: b.id, job_id: JOB, status: 'billed', amount: b.amount })),
      UNTIED.map(([amount, paid_on]) => ({ job_id: JOB, invoice_id: null, amount, paid_on })),
    )
    expect(rollup['c-umar']!.openBalance).toBe(16685)
  })

  it('the timeline owes $16,685', () => {
    const input = emptyCustomerTimelineInput({ id: 'c-umar', name: 'Umar', createdAt: null, dateMet: null })
    const job: TimelineJobInput = {
      id: JOB,
      hcpNumber: '273',
      clickNumber: null,
      jobName: 'Dudley',
      jobAddress: null,
      status: 'billed',
      revenue: REVENUE,
      paymentsMade: PAID,
      createdAt: '2025-09-01T15:00:00Z',
      customerId: 'c-umar',
      customerName: 'Umar',
      gcCustomerId: null,
      collectionsAt: null,
      collectionsNote: null,
      uncollectibleAt: null,
      uncollectibleReason: null,
    }
    input.jobs = [job]
    input.invoices = BILLS.map((b) => ({ id: b.id, jobId: JOB, status: 'billed', amount: b.amount, sequenceOrder: b.sequence_order, billedAt: b.billed_at, sentToCustomerAt: null, channel: 'physical' }))
    input.payments = UNTIED.map(([amount, paidOn], i) => ({ id: `u${i}`, jobId: JOB, invoiceId: null, amount, paidOn, paymentType: 'check', referenceNumber: null, depositPostedAt: null, depositFrom: null }))
    expect(buildCustomerTimeline(input, TODAY, Date.parse('2026-10-09T17:00:00Z')).summary.owed).toBe(16685)
  })
})

describe('the Dashboard: the AR card and the Billed pin', () => {
  const financialJob: FinancialJobRow = { id: JOB, hcp_number: '273', job_name: 'Dudley', status: 'billed', revenue: REVENUE, payments_made: PAID, last_work_date: '2026-08-26' }
  const invoices = BILLS.map((b) => ({ id: b.id, job_id: JOB, amount: b.amount, status: 'billed', billed_at: b.billed_at, sequence_order: b.sequence_order }))
  const unlinked = UNTIED.map(([amount, paid_on]) => ({ invoice_id: null, amount, paid_on, job_id: JOB }))

  it('the AR card owes $16,685 once the read adds the money put on the job', () => {
    expect(buildArBuckets([financialJob], invoices, []).ar.total).toBe(17585)
    expect(buildArBuckets([financialJob], invoices, unlinked).ar.total).toBe(16685)
  })

  it("a paid bill's linked payment, read by bill and so without its job, still finds its job — or the paid bill would take the money", () => {
    const jobs = [{ id: 'x', status: 'billed', revenue: 1500, payments_made: 1500 }]
    const bills = [
      { id: 'x0', job_id: 'x', status: 'paid', amount: 1000, sequence_order: 0 },
      { id: 'x1', job_id: 'x', status: 'billed', amount: 500, sequence_order: 1 },
    ]
    const linkedByBill = { invoice_id: 'x0', amount: 1000 } // a bill-keyed read: no job_id
    const untied = { invoice_id: null, amount: 500, job_id: 'x', paid_on: '2026-04-01' }
    expect(appliedByInvoiceUnderRule(jobs, bills, [linkedByBill, untied]).get('x1')).toBe(500)
    expect(computeBillTruth({ jobs, invoices: bills, payments: [linkedByBill, untied] }).owed.total).toBe(0)
    // Without the paid bill's own payment (a read of the open bills' payments only), the paid bill looks unpaid and takes the money.
    expect(computeBillTruth({ jobs, invoices: bills, payments: [untied] }).owed.total).toBe(500)
  })
})
