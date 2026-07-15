import { describe, expect, it } from 'vitest'
import { computeEmploymentStubTotals } from './employmentPayTotals'

describe('computeEmploymentStubTotals', () => {
  it('returns zeros with no stubs', () => {
    expect(
      computeEmploymentStubTotals({ stubs: [], payments: [], deductions: [], additionalLines: [] }),
    ).toEqual({ paidTotal: 0, dueTotal: 0, paidWeekCount: 0, avgPaidPerWeek: null })
  })

  it('unpaid stub is fully due and counts no paid week', () => {
    const t = computeEmploymentStubTotals({
      stubs: [{ id: 'a', gross_pay: 1000, period_start: '2026-06-21' }],
      payments: [],
      deductions: [],
      additionalLines: [],
    })
    expect(t).toEqual({ paidTotal: 0, dueTotal: 1000, paidWeekCount: 0, avgPaidPerWeek: null })
  })

  it('partial payments split paid vs due', () => {
    const t = computeEmploymentStubTotals({
      stubs: [{ id: 'a', gross_pay: 1000, period_start: '2026-06-21' }],
      payments: [
        { pay_stub_id: 'a', amount: 400 },
        { pay_stub_id: 'a', amount: 100 },
      ],
      deductions: [],
      additionalLines: [],
    })
    expect(t).toEqual({ paidTotal: 500, dueTotal: 500, paidWeekCount: 1, avgPaidPerWeek: 500 })
  })

  it('due uses net pay: deductions subtract, additional lines add', () => {
    const t = computeEmploymentStubTotals({
      stubs: [{ id: 'a', gross_pay: 1000, period_start: '2026-06-21' }],
      payments: [{ pay_stub_id: 'a', amount: 200 }],
      deductions: [{ pay_stub_id: 'a', amount: 150 }],
      additionalLines: [{ pay_stub_id: 'a', line_total: 50 }],
    })
    // net = 1000 − 150 + 50 = 900; due = 900 − 200
    expect(t).toEqual({ paidTotal: 200, dueTotal: 700, paidWeekCount: 1, avgPaidPerWeek: 200 })
  })

  it('overpaid stubs clamp due to zero without hiding the payment', () => {
    const t = computeEmploymentStubTotals({
      stubs: [{ id: 'a', gross_pay: 300, period_start: '2026-06-21' }],
      payments: [{ pay_stub_id: 'a', amount: 350 }],
      deductions: [],
      additionalLines: [],
    })
    expect(t).toEqual({ paidTotal: 350, dueTotal: 0, paidWeekCount: 1, avgPaidPerWeek: 350 })
  })

  it('avg per week: same-week stubs count one week; unpaid weeks excluded', () => {
    const t = computeEmploymentStubTotals({
      stubs: [
        // Two stubs covering the same pay week (both paid) — one week, not two.
        { id: 'a', gross_pay: 400, period_start: '2026-05-24' },
        { id: 'b', gross_pay: 200, period_start: '2026-05-25' },
        // A different paid week.
        { id: 'c', gross_pay: 500, period_start: '2026-05-31' },
        // Unpaid stub: contributes to due, not to the week count.
        { id: 'd', gross_pay: 999, period_start: '2026-06-07' },
      ],
      payments: [
        { pay_stub_id: 'a', amount: 400 },
        { pay_stub_id: 'b', amount: 200 },
        { pay_stub_id: 'c', amount: 300 },
      ],
      deductions: [],
      additionalLines: [],
    })
    // paid = 900 across weeks 5/24 and 5/31 → avg 450
    expect(t).toEqual({ paidTotal: 900, dueTotal: 1199, paidWeekCount: 2, avgPaidPerWeek: 450 })
  })

  it('sums across stubs and ignores rows for unknown stubs, rounding float drift to cents', () => {
    const t = computeEmploymentStubTotals({
      stubs: [
        { id: 'a', gross_pay: 0.3, period_start: '2026-06-21' },
        { id: 'b', gross_pay: 200, period_start: '2026-06-28' },
        { id: 'c', gross_pay: null, period_start: '2026-07-05' },
      ],
      payments: [
        // 0.1 + 0.2 !== 0.3 in floats — totals must still come out exact cents.
        { pay_stub_id: 'a', amount: 0.1 },
        { pay_stub_id: 'a', amount: 0.2 },
        { pay_stub_id: 'other', amount: 999 },
      ],
      deductions: [],
      additionalLines: [],
    })
    expect(t).toEqual({ paidTotal: 0.3, dueTotal: 200, paidWeekCount: 1, avgPaidPerWeek: 0.3 })
  })
})
