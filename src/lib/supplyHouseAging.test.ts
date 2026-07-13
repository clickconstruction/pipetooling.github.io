import { describe, expect, it } from 'vitest'
import {
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
