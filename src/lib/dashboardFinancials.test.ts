import { describe, expect, it } from 'vitest'
import {
  buildApBucket,
  buildArBucket,
  buildUnbilledBucket,
  financialJobLabel,
  redactApPayrollItems,
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
