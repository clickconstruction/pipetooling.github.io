import { describe, expect, it } from 'vitest'
import { customerDaysToPay, customerMoneyStats, type ProfileJob } from './customerProfileStats'

const TODAY = '2026-08-03'

function job(p: Partial<ProfileJob>): ProfileJob {
  return { id: 'j1', status: 'billed', revenue: 0, payments_made: 0, invoices: [], payments: [], ...p }
}

describe('customerMoneyStats', () => {
  it('sums billed-invoice remainders and ages them by estimated bill date', () => {
    const jobs = [
      job({
        invoices: [
          { id: 'i1', status: 'billed', amount: 1000, billed_at: null, estimated_bill_date: '2026-06-20' }, // 44d → 30-90
          { id: 'i2', status: 'billed', amount: 700, billed_at: null, estimated_bill_date: '2026-03-01' }, // 155d → 90+
          { id: 'i3', status: 'billed', amount: 500, billed_at: null, estimated_bill_date: '2026-08-01' }, // fresh
        ],
        payments: [{ invoice_id: 'i1', amount: 400, paid_on: '2026-07-01' }],
      }),
    ]
    const s = customerMoneyStats(jobs, TODAY)
    expect(s.openBalance).toBe(600 + 700 + 500)
    expect(s.aging).toEqual({ count30_90: 1, sum30_90: 600, count90: 1, sum90: 700 })
    expect(s.lifetimeCollected).toBe(400)
    expect(s.jobCount).toBe(1)
  })

  it('billed job with no billed invoices contributes the shell remainder', () => {
    const s = customerMoneyStats([job({ revenue: 900, payments_made: 200 })], TODAY)
    expect(s.openBalance).toBe(700)
  })

  it('paid jobs contribute lifetime but never open balance; working jobs only via billed invoices', () => {
    const jobs = [
      job({ status: 'paid', revenue: 5000, payments: [{ invoice_id: null, amount: 5000, paid_on: '2026-05-01' }] }),
      job({
        status: 'working',
        invoices: [{ id: 'b1', status: 'billed', amount: 300, billed_at: null, estimated_bill_date: null }],
      }),
      job({ status: 'working', revenue: 800 }), // unbilled working job → nothing open
    ]
    const s = customerMoneyStats(jobs, TODAY)
    expect(s.openBalance).toBe(300)
    expect(s.lifetimeCollected).toBe(5000)
    expect(s.jobCount).toBe(3)
  })

  it('zero-remaining invoices never age', () => {
    const jobs = [
      job({
        invoices: [{ id: 'i1', status: 'billed', amount: 400, billed_at: null, estimated_bill_date: '2026-01-01' }],
        payments: [{ invoice_id: 'i1', amount: 400, paid_on: '2026-02-01' }],
      }),
    ]
    const s = customerMoneyStats(jobs, TODAY)
    expect(s.openBalance).toBe(0)
    expect(s.aging.count90).toBe(0)
  })
})

describe('customerDaysToPay', () => {
  it('median of invoice-linked billed→paid gaps', () => {
    const jobs = [
      job({
        invoices: [
          { id: 'a', status: 'paid', amount: 100, billed_at: '2026-06-01T10:00:00Z', estimated_bill_date: null },
          { id: 'b', status: 'paid', amount: 100, billed_at: '2026-06-10T10:00:00Z', estimated_bill_date: null },
          { id: 'c', status: 'paid', amount: 100, billed_at: '2026-07-01T10:00:00Z', estimated_bill_date: null },
        ],
        payments: [
          { invoice_id: 'a', amount: 100, paid_on: '2026-06-06' }, // 5d
          { invoice_id: 'b', amount: 100, paid_on: '2026-06-19' }, // 9d
          { invoice_id: 'c', amount: 100, paid_on: '2026-07-31' }, // 30d
        ],
      }),
    ]
    expect(customerDaysToPay(jobs, TODAY)).toEqual({ medianDays: 9, samples: 3 })
  })

  it('even sample count averages the middle pair; negatives clamp to 0', () => {
    const jobs = [
      job({
        invoices: [
          { id: 'a', status: 'paid', amount: 1, billed_at: '2026-06-01T00:00:00Z', estimated_bill_date: null },
          { id: 'b', status: 'paid', amount: 1, billed_at: '2026-06-01T00:00:00Z', estimated_bill_date: null },
        ],
        payments: [
          { invoice_id: 'a', amount: 1, paid_on: '2026-05-30' }, // before billed → 0
          { invoice_id: 'b', amount: 1, paid_on: '2026-06-11' }, // 10d
        ],
      }),
    ]
    expect(customerDaysToPay(jobs, TODAY)).toEqual({ medianDays: 5, samples: 2 })
  })

  it('excludes job-level payments, unpaid-dated rows, and payments older than 12 months', () => {
    const jobs = [
      job({
        invoices: [{ id: 'a', status: 'paid', amount: 1, billed_at: '2025-05-01T00:00:00Z', estimated_bill_date: null }],
        payments: [
          { invoice_id: null, amount: 1, paid_on: '2026-07-01' },
          { invoice_id: 'a', amount: 1, paid_on: null },
          { invoice_id: 'a', amount: 1, paid_on: '2025-06-01' }, // > 12 months ago
        ],
      }),
    ]
    expect(customerDaysToPay(jobs, TODAY)).toBeNull()
  })
})
