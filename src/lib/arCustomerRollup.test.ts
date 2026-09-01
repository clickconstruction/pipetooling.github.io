import { describe, expect, it } from 'vitest'
import { buildArCustomerRollup, filterArCustomerRows, sortArCustomerRows } from './arCustomerRollup'
import type { FinancialItem } from './dashboardFinancials'
import type { PaySpeedData } from './jobs/billedExpectedPay'

const TODAY = '2026-09-01'

function item(over: Partial<FinancialItem> & { key: string; amount: number }): FinancialItem {
  return {
    label: 'job',
    sublabel: 'Billed invoice',
    dateYmd: null,
    jobId: 'j1',
    address: null,
    customerId: null,
    customerName: null,
    ...over,
  }
}

function speeds(over?: Partial<PaySpeedData>): PaySpeedData {
  return {
    company: { medianDays: 6, samples: 100 },
    customers: {},
    segments: { residential: null, commercial: null },
    customerTypes: {},
    receipts: {},
    quality: null,
    ...over,
  }
}

describe('buildArCustomerRollup', () => {
  it('groups bills by customer and sums open dollars', () => {
    const rollup = buildArCustomerRollup(
      [
        item({ key: 'a', amount: 100, customerId: 'c1', customerName: 'Dudley', dateYmd: '2026-08-25' }),
        item({ key: 'b', amount: 50, customerId: 'c1', customerName: 'Dudley', dateYmd: '2026-08-30' }),
        item({ key: 'c', amount: 25, customerId: 'c2', customerName: 'Take 5', dateYmd: '2026-08-31' }),
      ],
      speeds(),
      TODAY,
    )
    expect(rollup.customerCount).toBe(2)
    expect(rollup.billCount).toBe(3)
    const dudley = rollup.rows.find((r) => r.customerId === 'c1')!
    expect(dudley.open).toBe(150)
    expect(dudley.oldestWaitDays).toBe(7)
    expect(dudley.bills.map((b) => b.item.key)).toEqual(['a', 'b'])
  })

  it('uses the customer median only at PAY_SPEED_MIN_SAMPLES, else the company median', () => {
    const data = speeds({
      customers: { c1: { medianDays: 35, samples: 5 }, c2: { medianDays: 40, samples: 2 } },
    })
    const rollup = buildArCustomerRollup(
      [
        item({ key: 'a', amount: 100, customerId: 'c1', customerName: 'Own', dateYmd: '2026-08-12' }),
        item({ key: 'b', amount: 100, customerId: 'c2', customerName: 'Thin', dateYmd: '2026-08-12' }),
      ],
      data,
      TODAY,
    )
    const own = rollup.rows.find((r) => r.customerId === 'c1')!
    const thin = rollup.rows.find((r) => r.customerId === 'c2')!
    expect(own.baselineDays).toBe(35)
    expect(own.ownMedianDays).toBe(35)
    expect(own.pastPace).toBe(false) // 20d wait, ~35d baseline
    expect(thin.baselineDays).toBe(6) // company fallback
    expect(thin.ownMedianDays).toBeNull()
    expect(thin.pastPace).toBe(true) // 20d wait past ~6d
  })

  it('tones bills against the baseline: ok at/under, warn over, late at 2x, undated without a date', () => {
    const rollup = buildArCustomerRollup(
      [
        item({ key: 'ok', amount: 1, customerId: 'c1', customerName: 'X', dateYmd: '2026-08-27' }), // 5d
        item({ key: 'warn', amount: 1, customerId: 'c1', customerName: 'X', dateYmd: '2026-08-24' }), // 8d
        item({ key: 'late', amount: 1, customerId: 'c1', customerName: 'X', dateYmd: '2026-08-01' }), // 31d ≥ 12
        item({ key: 'und', amount: 1, customerId: 'c1', customerName: 'X', dateYmd: null }),
      ],
      speeds(),
      TODAY,
    )
    const tones = Object.fromEntries(rollup.rows[0]!.bills.map((b) => [b.item.key, b.tone]))
    expect(tones).toEqual({ ok: 'ok', warn: 'warn', late: 'late', und: 'undated' })
  })

  it('collects customer-less bills under one row and splits pace totals', () => {
    const rollup = buildArCustomerRollup(
      [
        item({ key: 'a', amount: 100, customerId: 'c1', customerName: 'Slow', dateYmd: '2026-07-01' }),
        item({ key: 'b', amount: 40, customerId: 'c2', customerName: 'Fine', dateYmd: '2026-08-31' }),
        item({ key: 'c', amount: 7, customerId: null, dateYmd: null }),
      ],
      speeds(),
      TODAY,
    )
    expect(rollup.pastPace).toEqual({ count: 1, open: 100 })
    expect(rollup.onPace).toEqual({ count: 2, open: 47 })
    const orphan = rollup.rows.find((r) => r.customerId === null)!
    expect(orphan.name).toBe('No customer on the job')
    expect(orphan.pastPace).toBe(false)
  })

  it('degrades without pay-speed data: no pace, neutral tones, hasPace false', () => {
    const rollup = buildArCustomerRollup(
      [item({ key: 'a', amount: 100, customerId: 'c1', customerName: 'X', dateYmd: '2026-07-01' })],
      null,
      TODAY,
    )
    expect(rollup.hasPace).toBe(false)
    expect(rollup.rows[0]!.baselineDays).toBeNull()
    expect(rollup.rows[0]!.pastPace).toBe(false)
    expect(rollup.rows[0]!.bills[0]!.tone).toBe('undated')
  })
})

describe('sortArCustomerRows', () => {
  const rows = buildArCustomerRollup(
    [
      item({ key: 'a', amount: 10, customerId: 'slowest', customerName: 'Slowest', dateYmd: '2026-06-01' }),
      item({ key: 'b', amount: 500, customerId: 'bigfine', customerName: 'BigFine', dateYmd: '2026-08-31' }),
      item({ key: 'c', amount: 50, customerId: 'slow2', customerName: 'Slow2', dateYmd: '2026-08-01' }),
    ],
    speeds(),
    TODAY,
  ).rows

  it('slowest: past-pace first by oldest wait, on-pace after by dollars', () => {
    expect(sortArCustomerRows(rows, 'slowest').map((r) => r.customerId)).toEqual(['slowest', 'slow2', 'bigfine'])
  })

  it('biggest: open dollars regardless of pace', () => {
    expect(sortArCustomerRows(rows, 'biggest').map((r) => r.customerId)).toEqual(['bigfine', 'slow2', 'slowest'])
  })
})

describe('filterArCustomerRows', () => {
  const rows = buildArCustomerRollup(
    [
      item({ key: 'a', amount: 10, customerId: 'c1', customerName: 'Dudley Mason', label: '273 · Lennox', address: '9703 Lenox Hl' }),
      item({ key: 'b', amount: 20, customerId: 'c2', customerName: 'Take 5', label: '878 · Seguin', address: '380 TX-123' }),
    ],
    speeds(),
    TODAY,
  ).rows

  it('matches customer name or any bill label/address, keeping all bills', () => {
    expect(filterArCustomerRows(rows, 'dudley').map((r) => r.customerId)).toEqual(['c1'])
    expect(filterArCustomerRows(rows, '878').map((r) => r.customerId)).toEqual(['c2'])
    expect(filterArCustomerRows(rows, 'lenox').map((r) => r.customerId)).toEqual(['c1'])
    expect(filterArCustomerRows(rows, '')).toHaveLength(2)
  })
})
