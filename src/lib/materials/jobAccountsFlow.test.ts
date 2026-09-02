import { describe, expect, it } from 'vitest'
import {
  buildJobAccountsView,
  classifyJobAccount,
  type JobAccountsAllocationInput,
  type JobAccountsInvoiceInput,
  type JobAccountsJobInput,
} from './jobAccountsFlow'

const TODAY = '2026-09-02'

function job(overrides: Partial<JobAccountsJobInput> & { id: string }): JobAccountsJobInput {
  return {
    hcp_number: overrides.id.toUpperCase(),
    click_number: null,
    job_name: `Job ${overrides.id}`,
    revenue: 0,
    payments_made: 0,
    ...overrides,
  }
}

function invoice(overrides: Partial<JobAccountsInvoiceInput> & { id: string }): JobAccountsInvoiceInput {
  return {
    supply_house_id: 'house-1',
    amount: 100,
    is_paid: false,
    due_date: null,
    ...overrides,
  }
}

function alloc(invoice_id: string, job_id: string, pct = 100): JobAccountsAllocationInput {
  return { invoice_id, job_id, pct }
}

const HOUSES = [
  { id: 'house-1', name: 'Reece' },
  { id: 'house-2', name: 'Winn Supply' },
]

describe('classifyJobAccount', () => {
  it('owe_suppliers when houses are owed and the customer has paid anything', () => {
    expect(classifyJobAccount({ billed: 100, paidIn: 100, suppliersPaid: 0, suppliersOwed: 40 })).toBe('owe_suppliers')
    expect(classifyJobAccount({ billed: 100, paidIn: 1, suppliersPaid: 0, suppliersOwed: 40 })).toBe('owe_suppliers')
  })

  it('awaiting_customer when houses are owed but nothing has come in', () => {
    expect(classifyJobAccount({ billed: 100, paidIn: 0, suppliersPaid: 10, suppliersOwed: 40 })).toBe('awaiting_customer')
  })

  it('floating when houses are fully paid but the customer is not', () => {
    expect(classifyJobAccount({ billed: 100, paidIn: 0, suppliersPaid: 40, suppliersOwed: 0 })).toBe('floating')
    expect(classifyJobAccount({ billed: 100, paidIn: 60, suppliersPaid: 40, suppliersOwed: 0 })).toBe('floating')
  })

  it('settled when nothing is owed either way', () => {
    expect(classifyJobAccount({ billed: 100, paidIn: 100, suppliersPaid: 40, suppliersOwed: 0 })).toBe('settled')
    expect(classifyJobAccount({ billed: 0, paidIn: 0, suppliersPaid: 0, suppliersOwed: 0 })).toBe('settled')
  })
})

describe('buildJobAccountsView', () => {
  it('splits an invoice across jobs by pct and buckets unpaid dollars by age', () => {
    const view = buildJobAccountsView(
      [job({ id: 'a', revenue: 1000, payments_made: 1000 }), job({ id: 'b', revenue: 500, payments_made: 500 })],
      [invoice({ id: 'i1', amount: 200, due_date: '2026-08-15' })],
      [alloc('i1', 'a', 75), alloc('i1', 'b', 25)],
      HOUSES,
      [],
      TODAY,
    )
    const rowA = view.rows.find((r) => r.jobId === 'a')!
    const rowB = view.rows.find((r) => r.jobId === 'b')!
    expect(rowA.suppliersOwed).toBeCloseTo(150)
    expect(rowB.suppliersOwed).toBeCloseTo(50)
    // 18 days past due on 2026-09-02 → the 1–30 bucket
    expect(rowA.owedBuckets.past1_30).toBeCloseTo(150)
    expect(rowA.status).toBe('owe_suppliers')
    expect(view.holdingTotal).toBeCloseTo(200)
    expect(view.holdingJobs).toBe(2)
  })

  it('caps held at what the customer actually paid', () => {
    const view = buildJobAccountsView(
      [job({ id: 'a', revenue: 1000, payments_made: 100 })],
      [invoice({ id: 'i1', amount: 400 })],
      [alloc('i1', 'a')],
      HOUSES,
      [],
      TODAY,
    )
    expect(view.rows[0]!.held).toBeCloseTo(100)
    expect(view.holdingTotal).toBeCloseTo(100)
  })

  it('groups per house with paid/owed and the oldest unpaid due date', () => {
    const view = buildJobAccountsView(
      [job({ id: 'a', revenue: 1000, payments_made: 1000 })],
      [
        invoice({ id: 'i1', amount: 100, due_date: '2026-08-15' }),
        invoice({ id: 'i2', amount: 60, due_date: '2026-07-01' }),
        invoice({ id: 'i3', amount: 40, is_paid: true }),
        invoice({ id: 'i4', supply_house_id: 'house-2', amount: 25, is_paid: true }),
      ],
      [alloc('i1', 'a'), alloc('i2', 'a'), alloc('i3', 'a'), alloc('i4', 'a')],
      HOUSES,
      [],
      TODAY,
    )
    const row = view.rows[0]!
    expect(row.houses).toHaveLength(2)
    const reece = row.houses[0]!
    expect(reece.name).toBe('Reece')
    expect(reece.owed).toBeCloseTo(160)
    expect(reece.paid).toBeCloseTo(40)
    expect(reece.unpaidCount).toBe(2)
    expect(reece.oldestUnpaidDueYmd).toBe('2026-07-01')
    expect(reece.oldestUnpaidBucket).toBe('past60_90')
    const winn = row.houses[1]!
    expect(winn.owed).toBe(0)
    expect(winn.oldestUnpaidBucket).toBeNull()
  })

  it('counts unpaid invoices with no job and no bid allocation as unallocated', () => {
    const view = buildJobAccountsView(
      [job({ id: 'a', revenue: 100, payments_made: 100 })],
      [
        invoice({ id: 'allocated', amount: 50 }),
        invoice({ id: 'loose', amount: 30 }),
        invoice({ id: 'bid-tied', amount: 20 }),
        invoice({ id: 'loose-paid', amount: 10, is_paid: true }),
      ],
      [alloc('allocated', 'a')],
      HOUSES,
      ['bid-tied'],
      TODAY,
    )
    expect(view.unallocatedCount).toBe(1)
    expect(view.unallocatedTotal).toBeCloseTo(30)
  })

  it('sorts owe_suppliers by held desc ahead of floating, awaiting, and settled', () => {
    const view = buildJobAccountsView(
      [
        job({ id: 'settled', revenue: 100, payments_made: 100 }),
        job({ id: 'float', revenue: 100, payments_made: 0 }),
        job({ id: 'small-owe', revenue: 100, payments_made: 100 }),
        job({ id: 'big-owe', revenue: 1000, payments_made: 1000 }),
        job({ id: 'await', revenue: 100, payments_made: 0 }),
      ],
      [
        invoice({ id: 'p1', amount: 20, is_paid: true }),
        invoice({ id: 'p2', amount: 30, is_paid: true }),
        invoice({ id: 'o1', amount: 10 }),
        invoice({ id: 'o2', amount: 500 }),
        invoice({ id: 'o3', amount: 40 }),
      ],
      [
        alloc('p1', 'settled'),
        alloc('p2', 'float'),
        alloc('o1', 'small-owe'),
        alloc('o2', 'big-owe'),
        alloc('o3', 'await'),
      ],
      HOUSES,
      [],
      TODAY,
    )
    expect(view.rows.map((r) => r.jobId)).toEqual(['big-owe', 'small-owe', 'float', 'await', 'settled'])
    expect(view.floatingTotal).toBeCloseTo(30)
    expect(view.floatingJobs).toBe(1)
    expect(view.awaitingJobs).toBe(1)
    expect(view.settledJobs).toBe(1)
  })

  it('ignores allocations pointing at unknown invoices or jobs', () => {
    const view = buildJobAccountsView(
      [job({ id: 'a', revenue: 100, payments_made: 100 })],
      [invoice({ id: 'i1', amount: 50 })],
      [alloc('i1', 'ghost-job'), alloc('ghost-invoice', 'a')],
      HOUSES,
      [],
      TODAY,
    )
    expect(view.rows).toHaveLength(0)
    // i1's only allocation points at an unknown job, so its dollars are NOT
    // represented in any row — but it is job-allocated in the DB, so it does
    // not count as unallocated either (allocation hygiene, not missing data).
    expect(view.unallocatedCount).toBe(0)
  })
})
