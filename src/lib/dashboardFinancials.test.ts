import { describe, expect, it } from 'vitest'
import {
  buildApBucket,
  buildApBucketFromAggregates,
  buildArBucket,
  buildArBuckets,
  buildUnbilledBucket,
  buildUpcomingApSection,
  upcomingApSectionFromAggregates,
  financialJobLabel,
  redactApPayrollItems,
  redactUpcomingApSection,
  type FinancialInvoiceRow,
  type FinancialJobRow,
} from './dashboardFinancials'

function job(overrides: Partial<FinancialJobRow>): FinancialJobRow {
  return {
    id: 'j1',
    hcp_number: '500',
    click_number: null,
    job_name: 'Smith House',
    status: 'billed',
    revenue: 1000,
    payments_made: 0,
    last_bill_date: '2026-06-20',
    last_work_date: '2026-06-18',
    ...overrides,
  }
}

function invoice(overrides: Partial<FinancialInvoiceRow>): FinancialInvoiceRow {
  return { id: 'i1', job_id: 'j1', amount: 400, status: 'billed', billed_at: '2026-06-21T12:00:00Z', ...overrides }
}

describe('financialJobLabel', () => {
  it('prefers HCP, falls back to Click number, then name', () => {
    expect(financialJobLabel({ hcp_number: '500', click_number: null, job_name: 'Smith' })).toBe('500 · Smith')
    expect(financialJobLabel({ hcp_number: '', click_number: '12', job_name: 'Smith' })).toBe('12 · Smith')
    expect(financialJobLabel({ hcp_number: null, click_number: null, job_name: 'Smith' })).toBe('Smith')
    expect(financialJobLabel({ hcp_number: null, click_number: null, job_name: null })).toBe('—')
  })
})

describe('buildArBucket', () => {
  it('sums open remainders on billed invoices minus applied payments', () => {
    const bucket = buildArBucket(
      [job({})],
      [invoice({ amount: 400 }), invoice({ id: 'i2', amount: 300 })],
      [{ invoice_id: 'i1', amount: 150 }],
    )
    expect(bucket.total).toBeCloseTo(250 + 300)
    expect(bucket.count).toBe(2)
    expect(bucket.items[0]?.amount).toBeCloseTo(300) // sorted desc
    expect(bucket.oldestDateYmd).toBe('2026-06-21')
  })

  it('adds billed jobs without billed invoice rows via revenue − payments', () => {
    const bucket = buildArBucket(
      [job({ id: 'j2', revenue: 900, payments_made: 100, last_bill_date: '2026-05-01' })],
      [],
      [],
    )
    expect(bucket.total).toBeCloseTo(800)
    expect(bucket.items[0]?.sublabel).toBe('Billed job (no invoice rows)')
    expect(bucket.oldestDateYmd).toBe('2026-05-01')
  })

  it('drops fully paid invoices and non-billed jobs', () => {
    const bucket = buildArBucket(
      [job({ status: 'working' })],
      [invoice({ amount: 200 })],
      [{ invoice_id: 'i1', amount: 200 }],
    )
    expect(bucket).toMatchObject({ total: 0, count: 0, oldestDateYmd: null })
  })
})

describe('buildApBucket', () => {
  it('combines unpaid supply invoices and open payroll balances with subtotals', () => {
    const bucket = buildApBucket(
      [
        { id: 's1', amount: 250, invoice_date: '2026-06-15', supply_houses: { name: 'Ferguson' } },
        { id: 's2', amount: 0, invoice_date: null, supply_houses: null }, // zero -> dropped
      ],
      [
        { id: 'p1', person_name: 'Taunya', period_start: '2026-06-21', period_end: '2026-06-27', netPay: 900, paidSum: 400 },
        { id: 'p2', person_name: 'Bryan', period_start: '2026-06-21', period_end: '2026-06-27', netPay: 500, paidSum: 500 }, // settled -> dropped
      ],
    )
    expect(bucket.supplyTotal).toBeCloseTo(250)
    expect(bucket.payrollTotal).toBeCloseTo(500)
    expect(bucket.total).toBeCloseTo(750)
    expect(bucket.count).toBe(2)
    expect(bucket.oldestDateYmd).toBe('2026-06-15')
  })

  it('includes outstanding sub-labor balances in items, total, count, and oldest', () => {
    const bucket = buildApBucket(
      [{ id: 's1', amount: 250, invoice_date: '2026-06-15', supply_houses: { name: 'Ferguson' } }],
      [{ id: 'p1', person_name: 'Taunya', period_start: '2026-06-21', period_end: '2026-06-27', netPay: 900, paidSum: 400 }],
      [
        { id: 'sl1', assignedToName: 'Ram Crew', address: '123 Main St', jobNumber: '812', createdYmd: '2026-05-01', balance: 1200 },
        { id: 'sl2', assignedToName: null, address: null, jobNumber: null, createdYmd: null, balance: 0 }, // settled -> dropped
      ],
    )
    expect(bucket.subLaborTotal).toBeCloseTo(1200)
    expect(bucket.total).toBeCloseTo(250 + 500 + 1200)
    expect(bucket.count).toBe(3)
    expect(bucket.oldestDateYmd).toBe('2026-05-01')
    const row = bucket.items.find((i) => i.key === 'sublabor:sl1')
    expect(row?.label).toBe('Ram Crew')
    expect(row?.sublabel).toBe('Sub labor · #812')
    expect(row?.address).toBe('123 Main St')
  })

  it('sub labor rides the aggregates path too (assistant view)', () => {
    const bucket = buildApBucketFromAggregates(
      [{ id: 's1', amount: 250, invoice_date: '2026-06-15', supply_houses: { name: 'Ferguson' } }],
      { dueTotal: 500, dueCount: 3 },
      [{ id: 'sl1', assignedToName: 'Ram Crew', address: null, jobNumber: null, createdYmd: '2026-05-01', balance: 1200 }],
    )
    expect(bucket.subLaborTotal).toBeCloseTo(1200)
    expect(bucket.total).toBeCloseTo(250 + 500 + 1200)
  })
})

describe('buildApBucketFromAggregates', () => {
  it('appends one aggregate payroll line from RPC totals (assistant path)', () => {
    const bucket = buildApBucketFromAggregates(
      [{ id: 's1', amount: 250, invoice_date: '2026-06-15', supply_houses: { name: 'Ferguson' } }],
      { dueTotal: 500, dueCount: 3 },
    )
    expect(bucket.supplyTotal).toBeCloseTo(250)
    expect(bucket.payrollTotal).toBeCloseTo(500)
    expect(bucket.total).toBeCloseTo(750)
    const agg = bucket.items.find((i) => i.key === 'payroll:aggregate')
    expect(agg?.amount).toBeCloseTo(500)
    expect(agg?.sublabel).toBe('3 open pay stubs')
  })

  it('omits the payroll line when due total is zero', () => {
    const bucket = buildApBucketFromAggregates(
      [{ id: 's1', amount: 250, invoice_date: '2026-06-15', supply_houses: { name: 'Ferguson' } }],
      { dueTotal: 0, dueCount: 0 },
    )
    expect(bucket.payrollTotal).toBeCloseTo(0)
    expect(bucket.items.some((i) => i.key === 'payroll:aggregate')).toBe(false)
  })
})

describe('upcomingApSectionFromAggregates', () => {
  it('builds a single aggregate person-week line from RPC totals', () => {
    const section = upcomingApSectionFromAggregates({ upcomingTotal: 1234.56, upcomingCount: 4 })
    expect(section.total).toBeCloseTo(1234.56)
    expect(section.count).toBe(4)
    expect(section.items).toHaveLength(1)
    expect(section.items[0]?.sublabel).toBe('4 person-weeks')
  })

  it('is empty when there are no upcoming person-weeks', () => {
    expect(upcomingApSectionFromAggregates({ upcomingTotal: 0, upcomingCount: 0 })).toEqual({
      total: 0,
      count: 0,
      items: [],
    })
  })
})

describe('redactApPayrollItems', () => {
  it('collapses per-person stub rows into one aggregate line, totals unchanged', () => {
    const ap = buildApBucket(
      [{ id: 's1', amount: 250, invoice_date: '2026-06-15', supply_houses: { name: 'Ferguson' } }],
      [
        { id: 'p1', person_name: 'Taunya', period_start: '2026-06-21', period_end: '2026-06-27', netPay: 900, paidSum: 400 },
        { id: 'p2', person_name: 'Bryan', period_start: '2026-06-14', period_end: '2026-06-20', netPay: 700, paidSum: 0 },
      ],
    )
    const redacted = redactApPayrollItems(ap)
    expect(redacted.items.some((i) => i.key.startsWith('stub:'))).toBe(false)
    const aggregate = redacted.items.find((i) => i.key === 'payroll:aggregate')
    expect(aggregate?.amount).toBeCloseTo(1200)
    expect(aggregate?.label).toBe('Payroll')
    expect(aggregate?.sublabel).toBe('2 open pay stubs')
    expect(aggregate?.dateYmd).toBe('2026-06-20') // oldest replaced stub period_end
    expect(redacted.items.find((i) => i.key === 'supply:s1')?.amount).toBeCloseTo(250)
    expect(redacted.total).toBeCloseTo(ap.total)
    expect(redacted.supplyTotal).toBeCloseTo(ap.supplyTotal)
    expect(redacted.payrollTotal).toBeCloseTo(ap.payrollTotal)
    expect(redacted.count).toBe(2) // supply line + aggregate
  })

  it('passes a payroll-free bucket through unchanged', () => {
    const ap = buildApBucket(
      [{ id: 's1', amount: 250, invoice_date: '2026-06-15', supply_houses: { name: 'Ferguson' } }],
      [],
    )
    expect(redactApPayrollItems(ap)).toBe(ap)
  })
})

describe('buildUpcomingApSection', () => {
  const lines = [
    { personName: 'Bryan', weekStartYmd: '2026-06-21', weekEndYmd: '2026-06-27', hours: 12.25, estimatedGrossDollars: 306.25 },
    { personName: 'Bryan', weekStartYmd: '2026-06-28', weekEndYmd: '2026-07-04', hours: 8, estimatedGrossDollars: 200 },
    { personName: 'Taunya', weekStartYmd: '2026-06-28', weekEndYmd: '2026-07-04', hours: 10, estimatedGrossDollars: 350 },
  ]

  it('maps ledger person-week lines to items, keeping ledger order', () => {
    const section = buildUpcomingApSection(lines)
    expect(section.count).toBe(3)
    expect(section.total).toBeCloseTo(856.25)
    expect(section.items.map((i) => i.key)).toEqual([
      'upcoming:Bryan:2026-06-21',
      'upcoming:Bryan:2026-06-28',
      'upcoming:Taunya:2026-06-28',
    ])
    expect(section.items[0]).toMatchObject({
      label: 'Bryan',
      sublabel: '6/21–6/27 · 12.3h (est.)',
      amount: 306.25,
      dateYmd: '2026-06-27',
      jobId: null,
    })
  })

  it('returns an empty section for no lines', () => {
    expect(buildUpcomingApSection([])).toEqual({ total: 0, count: 0, items: [] })
  })
})

describe('redactUpcomingApSection', () => {
  it('collapses to one aggregate line preserving total and count', () => {
    const section = buildUpcomingApSection([
      { personName: 'Bryan', weekStartYmd: '2026-06-21', weekEndYmd: '2026-06-27', hours: 12, estimatedGrossDollars: 300 },
      { personName: 'Taunya', weekStartYmd: '2026-06-28', weekEndYmd: '2026-07-04', hours: 10, estimatedGrossDollars: 350 },
    ])
    const redacted = redactUpcomingApSection(section)
    expect(redacted.total).toBeCloseTo(650)
    expect(redacted.count).toBe(2)
    expect(redacted.items).toHaveLength(1)
    expect(redacted.items[0]).toMatchObject({
      key: 'upcoming:aggregate',
      label: 'Payroll',
      sublabel: '2 person-weeks',
      amount: 650,
    })
  })

  it('passes an empty section through by reference', () => {
    const empty = buildUpcomingApSection([])
    expect(redactUpcomingApSection(empty)).toBe(empty)
  })
})

describe('buildUnbilledBucket', () => {
  it('sums revenue − payments − billed amounts for working and ready_to_bill jobs', () => {
    const bucket = buildUnbilledBucket(
      [
        job({ id: 'j1', status: 'ready_to_bill', revenue: 1000, payments_made: 100, last_work_date: '2026-06-25' }),
        job({ id: 'j2', status: 'working', revenue: 500, payments_made: 0, last_work_date: '2026-06-30' }),
        job({ id: 'j3', status: 'billed', revenue: 999, payments_made: 0 }), // billed jobs live in AR, not here
      ],
      [invoice({ id: 'i1', job_id: 'j1', amount: 300, status: 'billed' }), invoice({ id: 'i2', job_id: 'j1', amount: 600, status: 'ready_to_bill' })],
    )
    // j1: (1000-100) - 300 billed = 600 (the RTB draft line is NOT subtracted — not billed yet)
    expect(bucket.items.find((i) => i.key === 'job:j1')?.amount).toBeCloseTo(600)
    expect(bucket.items.find((i) => i.key === 'job:j2')?.amount).toBeCloseTo(500)
    expect(bucket.items.some((i) => i.key === 'job:j3')).toBe(false)
    expect(bucket.total).toBeCloseTo(1100)
    expect(bucket.oldestDateYmd).toBe('2026-06-25')
  })

  it('drops jobs whose remainder is zero or negative', () => {
    const bucket = buildUnbilledBucket(
      [job({ id: 'j1', status: 'working', revenue: 200, payments_made: 250 })],
      [],
    )
    expect(bucket.count).toBe(0)
  })

  it('carries the job address through, trimming blanks to null', () => {
    const bucket = buildUnbilledBucket(
      [
        job({ id: 'j1', status: 'working', job_address: ' 123 Main St, Tulsa ' }),
        job({ id: 'j2', status: 'working', job_address: '   ' }),
      ],
      [],
    )
    expect(bucket.items.find((i) => i.key === 'job:j1')?.address).toBe('123 Main St, Tulsa')
    expect(bucket.items.find((i) => i.key === 'job:j2')?.address).toBeNull()
  })
})

describe('buildArBuckets (collections split)', () => {
  it('routes a flagged job invoice to collections and keeps unflagged in ar', () => {
    const flagged = job({ id: 'j1', collections_at: '2026-07-01T00:00:00Z' })
    const active = job({ id: 'j2', hcp_number: '501', job_name: 'Jones House' })
    const { ar, collections } = buildArBuckets(
      [flagged, active],
      [invoice({ id: 'i1', job_id: 'j1', amount: 400 }), invoice({ id: 'i2', job_id: 'j2', amount: 300 })],
      [{ invoice_id: 'i1', amount: 150 }],
    )
    expect(collections.total).toBeCloseTo(250)
    expect(collections.count).toBe(1)
    expect(collections.items[0]?.jobId).toBe('j1')
    expect(ar.total).toBeCloseTo(300)
    expect(ar.count).toBe(1)
    expect(ar.items[0]?.jobId).toBe('j2')
  })

  it('routes flagged invoice-less billed jobs to collections', () => {
    const { ar, collections } = buildArBuckets(
      [job({ id: 'j1', revenue: 900, payments_made: 100, collections_at: '2026-07-01T00:00:00Z' })],
      [],
      [],
    )
    expect(collections.total).toBeCloseTo(800)
    expect(collections.items[0]?.sublabel).toBe('Billed job (no invoice rows)')
    expect(ar).toMatchObject({ total: 0, count: 0 })
  })

  it('ignores the flag on non-billed jobs (sticky-flag semantics)', () => {
    // A working job with a stale flag contributes nothing to either AR bucket.
    const { ar, collections } = buildArBuckets(
      [job({ status: 'working', collections_at: '2026-07-01T00:00:00Z' })],
      [],
      [],
    )
    expect(ar.count).toBe(0)
    expect(collections.count).toBe(0)
  })

  it('ar + collections equals the merged buildArBucket total (buckets are disjoint)', () => {
    const jobs = [
      job({ id: 'j1', collections_at: '2026-07-01T00:00:00Z' }),
      job({ id: 'j2', hcp_number: '501' }),
      job({ id: 'j3', hcp_number: '502', revenue: 500, payments_made: 50 }),
    ]
    const invoices = [
      invoice({ id: 'i1', job_id: 'j1', amount: 400 }),
      invoice({ id: 'i2', job_id: 'j2', amount: 300 }),
    ]
    const payments = [{ invoice_id: 'i2', amount: 100 }]
    const split = buildArBuckets(jobs, invoices, payments)
    const merged = buildArBucket(jobs, invoices, payments)
    expect(split.ar.total + split.collections.total).toBeCloseTo(merged.total)
    expect(split.ar.count + split.collections.count).toBe(merged.count)
    const splitKeys = [...split.ar.items, ...split.collections.items].map((i) => i.key).sort()
    expect(merged.items.map((i) => i.key).sort()).toEqual(splitKeys)
  })
})

describe('buildArBuckets edge cases', () => {
  it('flagged billed job with zero remainder appears in NEITHER bucket (EPSILON filter)', () => {
    // Real prod case: revenue fully paid but status still 'billed'. Stages Collections still
    // lists it (Stages does not filter by remaining); the dashboard drops it like any $0 AR row.
    const { ar, collections } = buildArBuckets(
      [job({ revenue: 220, payments_made: 220, collections_at: '2026-07-01T00:00:00Z' })],
      [],
      [],
    )
    expect(ar.count).toBe(0)
    expect(collections.count).toBe(0)
  })

  it('flagged job with one paid and one open invoice: only the open one lands in collections', () => {
    const flagged = job({ id: 'j1', collections_at: '2026-07-01T00:00:00Z' })
    const { ar, collections } = buildArBuckets(
      [flagged],
      [invoice({ id: 'i-paid', job_id: 'j1', amount: 200 }), invoice({ id: 'i-open', job_id: 'j1', amount: 300 })],
      [{ invoice_id: 'i-paid', amount: 200 }],
    )
    expect(ar.count).toBe(0)
    expect(collections.count).toBe(1)
    expect(collections.items[0]?.key).toBe('inv:i-open')
    expect(collections.total).toBeCloseTo(300)
  })
})
