import { describe, expect, it } from 'vitest'
import { lifetimeValueByCustomer } from './customersListLcv'

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
