import { describe, expect, it } from 'vitest'
import {
  countSupplyHousesPastDue60,
  supplyHouseAgingPhoneNote,
  agingBucketFor,
  buildSupplyHouseAgingMatrix,
  daysPastDue,
  nextMonthlyPaymentDueYmd,
} from './supplyHouseAging'

const TODAY = '2026-07-03'

describe('daysPastDue', () => {
  it('counts whole days past the due date', () => {
    expect(daysPastDue('2026-07-03', TODAY)).toBe(0)
    expect(daysPastDue('2026-07-02', TODAY)).toBe(1)
    expect(daysPastDue('2026-06-03', TODAY)).toBe(30)
    expect(daysPastDue('2026-07-10', TODAY)).toBe(-7)
  })
})

describe('agingBucketFor', () => {
  it('maps boundaries into the classic buckets', () => {
    expect(agingBucketFor(null, TODAY)).toBe('noDueDate')
    expect(agingBucketFor('2026-07-10', TODAY)).toBe('current') // not yet due
    expect(agingBucketFor('2026-07-03', TODAY)).toBe('current') // due today
    expect(agingBucketFor('2026-07-02', TODAY)).toBe('past1_30') // 1 day
    expect(agingBucketFor('2026-06-04', TODAY)).toBe('past1_30') // 29 days
    expect(agingBucketFor('2026-06-03', TODAY)).toBe('past30_60') // 30 days
    expect(agingBucketFor('2026-05-05', TODAY)).toBe('past30_60') // 59 days
    expect(agingBucketFor('2026-05-04', TODAY)).toBe('past60_90') // 60 days
    expect(agingBucketFor('2026-04-05', TODAY)).toBe('past60_90') // 89 days
    expect(agingBucketFor('2026-04-04', TODAY)).toBe('past90plus') // 90 days
    expect(agingBucketFor('2025-01-01', TODAY)).toBe('past90plus')
  })
})

describe('buildSupplyHouseAgingMatrix', () => {
  const houses = [
    { id: 'h1', name: 'Texas Plumbing' },
    { id: 'h2', name: 'Reece' },
    { id: 'h3', name: 'Paid Up Supply' },
  ]

  it('aggregates buckets, totals, and sorts houses by total desc', () => {
    const matrix = buildSupplyHouseAgingMatrix(
      houses,
      [
        { supply_house_id: 'h1', amount: 100, due_date: '2026-06-20' }, // 13d -> past1_30
        { supply_house_id: 'h1', amount: 200, due_date: '2026-05-20' }, // 44d -> past30_60
        { supply_house_id: 'h1', amount: 50, due_date: null }, // noDueDate
        { supply_house_id: 'h2', amount: 900, due_date: '2026-07-15' }, // current
      ],
      TODAY,
    )
    expect(matrix.rows.map((r) => r.name)).toEqual(['Reece', 'Texas Plumbing'])
    const tx = matrix.rows[1]!
    expect(tx.buckets.past1_30).toBeCloseTo(100)
    expect(tx.buckets.past30_60).toBeCloseTo(200)
    expect(tx.buckets.noDueDate).toBeCloseTo(50)
    expect(tx.total).toBeCloseTo(350)
    expect(matrix.totals.current).toBeCloseTo(900)
    expect(matrix.grandTotal).toBeCloseTo(1250)
    expect(matrix.missingDueDateCount).toBe(1)
  })

  it('drops houses with no unpaid balance and ignores unknown house ids', () => {
    const matrix = buildSupplyHouseAgingMatrix(
      houses,
      [{ supply_house_id: 'ghost', amount: 500, due_date: null }],
      TODAY,
    )
    expect(matrix.rows).toEqual([])
    expect(matrix.grandTotal).toBe(0)
    expect(matrix.missingDueDateCount).toBe(0)
  })
})

describe('nextMonthlyPaymentDueYmd', () => {
  it('picks this month when the day is still ahead, else next month', () => {
    expect(nextMonthlyPaymentDueYmd(10, '2026-07-03')).toBe('2026-07-10')
    expect(nextMonthlyPaymentDueYmd(3, '2026-07-03')).toBe('2026-08-03') // strictly after
    expect(nextMonthlyPaymentDueYmd(1, '2026-12-15')).toBe('2027-01-01') // year rollover
  })

  it('clamps to the target month length', () => {
    expect(nextMonthlyPaymentDueYmd(31, '2026-02-05')).toBe('2026-02-28')
    expect(nextMonthlyPaymentDueYmd(31, '2028-02-05')).toBe('2028-02-29') // leap year
    expect(nextMonthlyPaymentDueYmd(31, '2026-04-01')).toBe('2026-04-30')
  })
})

describe('phone helpers (v2.2191)', async () => {
  const { countSupplyHousesPastDue60, supplyHouseAgingPhoneNote } = await import('./supplyHouseAging')
  const row = (buckets: Partial<Record<string, number>>) => ({
    supplyHouseId: 'x',
    name: 'X',
    total: 0,
    creditsOpen: 0,
    net: 0,
    buckets: { current: 0, past1_30: 0, past30_60: 0, past60_90: 0, past90plus: 0, noDueDate: 0, ...buckets },
    jobAccount: { current: 0, past1_30: 0, past30_60: 0, past60_90: 0, past90plus: 0, noDueDate: 0 },
    jobAccountTotal: 0,
  })
  it('counts houses 60+ past due', () => {
    const m = { rows: [row({ past60_90: 5 }), row({ past90plus: 1 }), row({ past1_30: 100 })], totals: row({}).buckets, grandTotal: 0, creditsTotal: 0, netTotal: 0, missingDueDateCount: 0, jobAccountTotals: row({}).buckets, jobAccountGrandTotal: 0, jobAccountInvoiceCount: 0 }
    expect(countSupplyHousesPastDue60(m)).toBe(2)
  })
  it('writes the phone note: 90+ first, else largest bucket, else all current', () => {
    expect(supplyHouseAgingPhoneNote(row({ past1_30: 25551, past90plus: 583, current: 10065 }))).toBe('most in 1–30 · $583 at 90+')
    expect(supplyHouseAgingPhoneNote(row({ past90plus: 13184, past30_60: 192 }))).toBe('$13,184 at 90+')
    expect(supplyHouseAgingPhoneNote(row({ current: 8524 }))).toBe('all current')
    expect(supplyHouseAgingPhoneNote(row({ noDueDate: 2 }))).toBe('most in no due date')
  })
})

describe('credit memos in the aging matrix (v2.3500)', () => {
  const HOUSES = [
    { id: 'ced', name: 'CED' },
    { id: 'reece', name: 'Reece' },
  ]
  // CED's real shape on 2026-09-15: $36 at 30–60 and $2,409 past 60.
  const CED_INVOICES = [
    { supply_house_id: 'ced', amount: 36, due_date: '2026-06-03' },
    { supply_house_id: 'ced', amount: 2409, due_date: '2026-04-04' },
  ]

  it('keeps a house on the table when its credits outweigh its invoices', () => {
    const credit = { supply_house_id: 'ced', amount: -2500, due_date: null }
    const m = buildSupplyHouseAgingMatrix(HOUSES, [...CED_INVOICES, credit], TODAY)
    const ced = m.rows.find((r) => r.supplyHouseId === 'ced')
    expect(ced).toBeDefined()
    // The past-due exposure is still visible, and still owed.
    expect(ced!.buckets.past90plus).toBe(2409)
    expect(ced!.total).toBe(2445)
    expect(ced!.creditsOpen).toBe(-2500)
    expect(ced!.net).toBe(-55)
  })

  it('lists a house that holds only credits', () => {
    const m = buildSupplyHouseAgingMatrix(HOUSES, [{ supply_house_id: 'reece', amount: -888.1, due_date: null }], TODAY)
    const reece = m.rows.find((r) => r.supplyHouseId === 'reece')
    expect(reece).toBeDefined()
    expect(reece!.total).toBe(0)
    expect(reece!.creditsOpen).toBeCloseTo(-888.1, 2)
  })

  it('never lets a credit into a bucket, so the 60+ count and the phone note stay true', () => {
    // A credit dated inside the 60–90 window must not cancel a real 90+ balance.
    const credit = { supply_house_id: 'ced', amount: -2409, due_date: '2026-05-04' }
    const m = buildSupplyHouseAgingMatrix(HOUSES, [...CED_INVOICES, credit], TODAY)
    const ced = m.rows.find((r) => r.supplyHouseId === 'ced')!
    expect(ced.buckets.past60_90).toBe(0)
    expect(ced.buckets.past90plus).toBe(2409)
    expect(countSupplyHousesPastDue60(m)).toBe(1)
    expect(supplyHouseAgingPhoneNote(ced)).toContain('2,409 at 90+')
  })

  it('does not ask the office to put a due date on a credit memo', () => {
    const withCredit = buildSupplyHouseAgingMatrix(
      HOUSES,
      [...CED_INVOICES, { supply_house_id: 'ced', amount: -500, due_date: null }],
      TODAY,
    )
    expect(withCredit.missingDueDateCount).toBe(0)
    // An invoice with no due date still counts.
    const withInvoice = buildSupplyHouseAgingMatrix(
      HOUSES,
      [...CED_INVOICES, { supply_house_id: 'ced', amount: 500, due_date: null }],
      TODAY,
    )
    expect(withInvoice.missingDueDateCount).toBe(1)
  })

  it('reports owed and credits separately, and nets them', () => {
    const m = buildSupplyHouseAgingMatrix(
      HOUSES,
      [...CED_INVOICES, { supply_house_id: 'reece', amount: -888.1, due_date: null }],
      TODAY,
    )
    expect(m.grandTotal).toBe(2445)
    expect(m.creditsTotal).toBeCloseTo(-888.1, 2)
    expect(m.netTotal).toBeCloseTo(1556.9, 2)
  })

  it('is unchanged for a book with no credits in it', () => {
    const m = buildSupplyHouseAgingMatrix(HOUSES, CED_INVOICES, TODAY)
    expect(m.grandTotal).toBe(2445)
    expect(m.creditsTotal).toBe(0)
    expect(m.netTotal).toBe(2445)
    expect(m.rows).toHaveLength(1)
  })
})

describe('job-account invoices in the aging matrix (B — shade, decided 2026-09-17)', () => {
  const houses = [{ id: 'nw', name: 'National Wholesale' }, { id: 'reece', name: 'Reece' }]

  it('keeps the cell as the house\'s total and carries the job-account share beside it', () => {
    const m = buildSupplyHouseAgingMatrix(
      houses,
      [
        { supply_house_id: 'nw', amount: 1539.64, due_date: '2026-07-10', on_job_account: false },
        { supply_house_id: 'nw', amount: 2759.01, due_date: '2026-07-10', on_job_account: true },
        { supply_house_id: 'reece', amount: 4200, due_date: '2026-03-31', on_job_account: true },
        { supply_house_id: 'reece', amount: 2537.29, due_date: '2026-03-31' },
      ],
      TODAY,
    )
    const nw = m.rows.find((r) => r.supplyHouseId === 'nw')!
    expect(nw.buckets.current).toBeCloseTo(4298.65, 2)
    expect(nw.jobAccount.current).toBeCloseTo(2759.01, 2)
    expect(nw.jobAccountTotal).toBeCloseTo(2759.01, 2)
    const reece = m.rows.find((r) => r.supplyHouseId === 'reece')!
    expect(reece.buckets.past90plus).toBeCloseTo(6737.29, 2)
    expect(reece.jobAccount.past90plus).toBe(4200)
    expect(m.jobAccountTotals.past90plus).toBe(4200)
    expect(m.jobAccountGrandTotal).toBeCloseTo(6959.01, 2)
    expect(m.jobAccountInvoiceCount).toBe(2)
    // the house's numbers do not move
    expect(m.grandTotal).toBeCloseTo(11035.94, 2)
    expect(countSupplyHousesPastDue60(m)).toBe(1)
  })

  it('an unflagged or credit row adds nothing to the job-account side', () => {
    const m = buildSupplyHouseAgingMatrix(
      houses,
      [
        { supply_house_id: 'nw', amount: 100, due_date: null },
        { supply_house_id: 'nw', amount: -50, due_date: null, on_job_account: true },
      ],
      TODAY,
    )
    expect(m.rows[0]!.jobAccountTotal).toBe(0)
    expect(m.jobAccountInvoiceCount).toBe(0)
    expect(m.rows[0]!.creditsOpen).toBe(-50)
  })
})
