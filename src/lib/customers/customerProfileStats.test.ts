import { describe, expect, it } from 'vitest'
import { customerDaysToPay, customerEstimateOutcomes, customerMoneyStats, profileJobRowMoney, sortProfileJobsForList, type ProfileJob } from './customerProfileStats'

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

  it('J34-N6: an over-paid billed shell clamps to 0 once and never nets against another job (bill truth)', () => {
    const s = customerMoneyStats(
      [job({ id: 'over', revenue: 220, payments_made: 300 }), job({ id: 'owed', revenue: 1000, payments_made: 0 })],
      TODAY,
    )
    expect(s.openBalance).toBe(1000) // was 920: the Hub used to let the −80 lower a different job's balance
    // the list kernel reads the same rows
    expect(profileJobRowMoney(job({ id: 'over', revenue: 220, payments_made: 300 }), TODAY)).toMatchObject({ openBilled: 0, noBillDate: false })
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

describe('lifetimeBilled', () => {
  it('sums billed and paid invoice amounts across jobs', () => {
    const jobs = [
      job({
        invoices: [
          { id: 'i1', status: 'billed', amount: 1000, billed_at: null, estimated_bill_date: null },
          { id: 'i2', status: 'paid', amount: 500, billed_at: null, estimated_bill_date: null },
          { id: 'i3', status: 'ready_to_bill', amount: 999, billed_at: null, estimated_bill_date: null }, // draft — not billed
        ],
      }),
      job({ id: 'j2', status: 'billed', invoices: [{ id: 'i4', status: 'billed', amount: 250, billed_at: null, estimated_bill_date: null }] }),
    ]
    expect(customerMoneyStats(jobs, TODAY).lifetimeBilled).toBe(1000 + 500 + 250)
  })

  it('falls back to the job shell (revenue) for billed/paid jobs without billed invoice rows', () => {
    const jobs = [
      job({ status: 'paid', revenue: 4000 }),
      job({ id: 'j2', status: 'billed', revenue: 900 }),
      job({ id: 'j3', status: 'working', revenue: 700 }), // not billed yet — no LCV contribution
    ]
    expect(customerMoneyStats(jobs, TODAY).lifetimeBilled).toBe(4000 + 900)
  })

  it('prefers invoice rows over the shell when both exist (no double count)', () => {
    const jobs = [
      job({
        status: 'paid',
        revenue: 5000,
        invoices: [{ id: 'i1', status: 'paid', amount: 5000, billed_at: null, estimated_bill_date: null }],
      }),
    ]
    expect(customerMoneyStats(jobs, TODAY).lifetimeBilled).toBe(5000)
  })
})

describe('customerEstimateOutcomes', () => {
  it('counts accepted vs decided; drafts/sent/superseded are undecided', () => {
    const outcomes = customerEstimateOutcomes([
      { status: 'customer_accepted' },
      { status: 'customer_accepted' },
      { status: 'declined' },
      { status: 'draft' },
      { status: 'sent' },
      { status: 'superseded' },
    ])
    expect(outcomes).toEqual({ accepted: 2, decided: 3 })
  })

  it('returns null when nothing is decided', () => {
    expect(customerEstimateOutcomes([{ status: 'sent' }, { status: 'draft' }])).toBeNull()
    expect(customerEstimateOutcomes([])).toBeNull()
  })
})

describe('profileJobRowMoney / sortProfileJobsForList (v2.1985 jobs list)', () => {
  it('billed invoices: remainder net of linked payments, age from oldest open est date', () => {
    const m = profileJobRowMoney(
      job({
        invoices: [
          { id: 'i1', status: 'billed', amount: 1000, billed_at: null, estimated_bill_date: '2026-06-20' },
          { id: 'i2', status: 'billed', amount: 700, billed_at: null, estimated_bill_date: '2026-03-01' },
        ],
        payments: [{ invoice_id: 'i1', amount: 400, paid_on: '2026-07-01' }],
      }),
      TODAY,
    )
    expect(m.openBilled).toBe(600 + 700)
    expect(m.oldestOpenBillYmd).toBe('2026-03-01')
    expect(m.ageDays).toBe(155)
    expect(m.noBillDate).toBe(false)
    expect(m.unbilled).toBe(0)
  })

  it('billed shell with no invoices: open remainder, flagged no-bill-date', () => {
    const m = profileJobRowMoney(job({ revenue: 900, payments_made: 200 }), TODAY)
    expect(m.openBilled).toBe(700)
    expect(m.noBillDate).toBe(true)
    expect(m.ageDays).toBeNull()
  })

  it('working job with nothing billed shows its unbilled value; paid jobs show nothing', () => {
    const w = profileJobRowMoney(job({ status: 'working', revenue: 5000, payments_made: 1000 }), TODAY)
    expect(w.openBilled).toBe(0)
    expect(w.unbilled).toBe(4000)
    const p = profileJobRowMoney(job({ status: 'paid', revenue: 5000, payments_made: 5000 }), TODAY)
    expect(p.openBilled).toBe(0)
    expect(p.unbilled).toBe(0)
  })

  it('sums of listed rows reconcile with customerMoneyStats.openBalance', () => {
    const jobs = [
      job({
        id: 'a',
        invoices: [{ id: 'i1', status: 'billed', amount: 1000, billed_at: null, estimated_bill_date: '2026-06-20' }],
        payments: [{ invoice_id: 'i1', amount: 400, paid_on: '2026-07-01' }],
      }),
      job({ id: 'b', revenue: 900, payments_made: 200 }),
      job({ id: 'c', status: 'working', revenue: 5000, payments_made: 0 }),
    ]
    const total = jobs.reduce((s, j) => s + profileJobRowMoney(j, TODAY).openBilled, 0)
    expect(total).toBe(customerMoneyStats(jobs, TODAY).openBalance)
  })

  it('sorts billed-open desc with oldest-age tiebreak, then unbilled desc', () => {
    const jobs = [
      job({ id: 'unbilled-small', status: 'working', revenue: 100, payments_made: 0 }),
      job({ id: 'unbilled-big', status: 'working', revenue: 9000, payments_made: 0 }),
      job({
        id: 'open-fresh',
        invoices: [{ id: 'x1', status: 'billed', amount: 500, billed_at: null, estimated_bill_date: '2026-08-01' }],
      }),
      job({
        id: 'open-old',
        invoices: [{ id: 'x2', status: 'billed', amount: 500, billed_at: null, estimated_bill_date: '2026-02-01' }],
      }),
      job({ id: 'open-big', invoices: [{ id: 'x3', status: 'billed', amount: 2000, billed_at: null, estimated_bill_date: '2026-08-01' }] }),
    ]
    expect(sortProfileJobsForList(jobs, TODAY).map((j) => j.id)).toEqual([
      'open-big',
      'open-old',
      'open-fresh',
      'unbilled-big',
      'unbilled-small',
    ])
  })
})
