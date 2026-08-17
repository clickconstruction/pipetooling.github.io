import { describe, expect, it } from 'vitest'
import { customersListRollup, lifetimeValueByCustomer } from './customersListLcv'

describe('lifetimeValueByCustomer', () => {
  it('sums billed/paid invoices per job, grouped by customer', () => {
    const map = lifetimeValueByCustomer(
      [
        { id: 'j1', customer_id: 'c1', status: 'billed', revenue: 999 },
        { id: 'j2', customer_id: 'c1', status: 'paid', revenue: 500 },
        { id: 'j3', customer_id: 'c2', status: 'working', revenue: 700 },
      ],
      [
        { job_id: 'j1', status: 'billed', amount: 1000 },
        { job_id: 'j1', status: 'ready_to_bill', amount: 50 }, // draft — excluded
        { job_id: 'j3', status: 'billed', amount: 300 }, // working job, real invoice counts
      ],
    )
    // j1 uses invoices (1000), j2 falls back to shell (500), j3 has a real billed invoice.
    expect(map).toEqual({ c1: 1500, c2: 300 })
  })

  it('unbilled jobs and customerless jobs contribute nothing', () => {
    const map = lifetimeValueByCustomer(
      [
        { id: 'j1', customer_id: 'c1', status: 'working', revenue: 900 },
        { id: 'j2', customer_id: null, status: 'paid', revenue: 400 },
      ],
      [],
    )
    expect(map).toEqual({})
  })
})

describe('customersListRollup', () => {
  it('computes open balance from billed-invoice remainders and job shells', () => {
    const rollup = customersListRollup(
      [
        { id: 'j1', customer_id: 'c1', status: 'billed', revenue: 900, payments_made: 200 }, // shell: 700 open
        { id: 'j2', customer_id: 'c1', status: 'working', revenue: 0 },
        { id: 'j3', customer_id: 'c1', status: 'paid', revenue: 5000 }, // paid: nothing open
      ],
      [
        { id: 'i1', job_id: 'j2', status: 'billed', amount: 1000 },
        { id: 'i2', job_id: 'j3', status: 'paid', amount: 5000 },
      ],
      [{ job_id: 'j2', invoice_id: 'i1', amount: 400, paid_on: '2026-08-01' }],
    )
    const c1 = rollup['c1']!
    expect(c1.openBalance).toBe(700 + 600)
    expect(c1.lcv).toBe(900 + 1000 + 5000)
    expect(c1.openJobs).toBe(2)
  })

  it('tracks last activity across job creation and payments', () => {
    const rollup = customersListRollup(
      [
        { id: 'j1', customer_id: 'c1', status: 'paid', revenue: 100, created_at: '2026-06-01T00:00:00Z' },
        { id: 'j2', customer_id: 'c1', status: 'working', revenue: 0, created_at: '2026-07-01T00:00:00Z' },
      ],
      [],
      [{ job_id: 'j1', invoice_id: null, amount: 100, paid_on: '2026-08-10' }],
    )
    expect(rollup['c1']!.lastActivityIso).toBe('2026-08-10')
    expect(rollup['c1']!.lastActivityKind).toBe('payment')
  })

  it('lifetimeValueByCustomer wrapper matches the v2.1780 behavior', () => {
    const map = lifetimeValueByCustomer(
      [
        { id: 'j1', customer_id: 'c1', status: 'billed', revenue: 999 },
        { id: 'j2', customer_id: 'c2', status: 'working', revenue: 700 },
      ],
      [{ job_id: 'j1', status: 'billed', amount: 1000 }],
    )
    expect(map).toEqual({ c1: 1000 })
  })
})
