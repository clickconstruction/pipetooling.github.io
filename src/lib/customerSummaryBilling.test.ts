import { describe, expect, it } from 'vitest'
import { summarizeCustomerJobsBilling, type CustomerBillingJobInput } from './customerSummaryBilling'

const job = (over: Partial<CustomerBillingJobInput>): CustomerBillingJobInput => ({
  id: 'j1',
  numberLabel: '940',
  jobName: 'Job',
  jobAddress: '264 Cross River St',
  revenueDollars: null,
  paymentsMadeDollars: 0,
  ...over,
})

describe('summarizeCustomerJobsBilling', () => {
  it('splits outstanding jobs from paid-in-full and no-total jobs', () => {
    const s = summarizeCustomerJobsBilling([
      job({ id: 'a', revenueDollars: 285, paymentsMadeDollars: 0 }),
      job({ id: 'b', revenueDollars: 2000, paymentsMadeDollars: 1045 }),
      job({ id: 'c', revenueDollars: 500, paymentsMadeDollars: 500 }),
      job({ id: 'd', revenueDollars: null }),
    ])
    expect(s.totalDollars).toBe(2785)
    expect(s.outstandingDollars).toBe(1240)
    expect(s.outstandingJobs.map((j) => j.id)).toEqual(['b', 'a'])
    expect(s.outstandingJobs[0]?.outstandingDollars).toBe(955)
    expect(s.paidInFullCount).toBe(1)
    expect(s.noTotalCount).toBe(1)
  })

  it('overpaid jobs clamp to zero outstanding and count as paid in full', () => {
    const s = summarizeCustomerJobsBilling([job({ revenueDollars: 100, paymentsMadeDollars: 150 })])
    expect(s.outstandingDollars).toBe(0)
    expect(s.outstandingJobs).toHaveLength(0)
    expect(s.paidInFullCount).toBe(1)
  })

  it('is cents-exact under float inputs', () => {
    const s = summarizeCustomerJobsBilling([job({ revenueDollars: 0.1 + 0.2, paymentsMadeDollars: 0.1 })])
    expect(s.outstandingDollars).toBe(0.2)
  })

  it('zero-revenue jobs count as no-total, never paid in full', () => {
    const s = summarizeCustomerJobsBilling([job({ revenueDollars: 0, paymentsMadeDollars: 50 })])
    expect(s.paidInFullCount).toBe(0)
    expect(s.noTotalCount).toBe(1)
    expect(s.totalDollars).toBe(0)
  })

  it('empty input yields an all-zero summary', () => {
    const s = summarizeCustomerJobsBilling([])
    expect(s).toEqual({ totalDollars: 0, outstandingDollars: 0, outstandingJobs: [], paidInFullCount: 0, noTotalCount: 0 })
  })
})
