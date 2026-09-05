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

  it('J34-N6: an over-paid billed shell clamps to 0 per row — it never nets against another job (bill truth)', () => {
    const rollup = customersListRollup(
      [
        { id: 'over', customer_id: 'c1', status: 'billed', revenue: 220, payments_made: 300 },
        { id: 'owed', customer_id: 'c1', status: 'billed', revenue: 1000, payments_made: 0 },
      ],
      [],
      [],
    )
    expect(rollup['c1']!.openBalance).toBe(1000) // not 920
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

describe('money rail fields (lifetimePaid + unbilled)', () => {
  it('sums payments per customer and computes unbilled as revenue beyond the billed contribution', () => {
    const rollup = customersListRollup(
      [
        { id: 'j1', customer_id: 'c1', status: 'working', revenue: 46600 }, // no billed invoices → all unbilled
        { id: 'j2', customer_id: 'c1', status: 'billed', revenue: 5000 }, // shell-billed → nothing unbilled
        { id: 'j3', customer_id: 'c1', status: 'working', revenue: 10000 }, // partially billed via invoice
      ],
      [{ id: 'i1', job_id: 'j3', status: 'billed', amount: 4000 }],
      [
        { job_id: 'j1', invoice_id: null, amount: 32245, paid_on: '2026-08-01' },
        { job_id: 'j3', invoice_id: 'i1', amount: 1000, paid_on: '2026-08-05' },
      ],
    )
    const c1 = rollup['c1']!
    expect(c1.lifetimePaid).toBe(32245 + 1000)
    expect(c1.unbilled).toBe(46600 + 0 + (10000 - 4000))
    // reconciliation the UI relies on: billed − paid-on-billed ≈ open (invoice basis)
    expect(c1.lcv).toBe(5000 + 4000)
  })

  it('over-billed jobs (invoices beyond revenue) contribute zero unbilled, never negative', () => {
    const rollup = customersListRollup(
      [{ id: 'j1', customer_id: 'c1', status: 'working', revenue: 1000 }],
      [{ id: 'i1', job_id: 'j1', status: 'billed', amount: 1500 }],
      [],
    )
    expect(rollup['c1']!.unbilled).toBe(0)
  })
})
