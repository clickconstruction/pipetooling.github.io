import { describe, expect, it } from 'vitest'
import { carryingDay, carryingSentence, lateWithinDays, receiptsConfidence } from './cashConfidence'
import { buildCashForecast } from './cashForecast'

describe('receiptsConfidence', () => {
  it('splits receipts into promised, by pace and late, with shares of the total', () => {
    const c = receiptsConfidence([
      { usd: 3000, basis: 'promised' },
      { usd: 5000, basis: 'customer' },
      { usd: 2000, basis: 'company' },
      { usd: 10_000, basis: 'late' },
      { usd: 10_000, basis: 'late' },
    ])
    expect(c).toMatchObject({ promisedUsd: 3000, paceUsd: 7000, lateUsd: 20_000, lateCount: 2, totalUsd: 30_000 })
    expect(c.shares.promised).toBeCloseTo(0.1)
    expect(c.shares.late).toBeCloseTo(2 / 3)
    expect(receiptsConfidence([]).shares).toEqual({ promised: 0, pace: 0, late: 0 })
  })
})

describe('lateWithinDays', () => {
  it('is the customer\'s pace held to 7–45 days, 14 with no pace', () => {
    expect(lateWithinDays(6)).toBe(7)
    expect(lateWithinDays(10.4)).toBe(10)
    expect(lateWithinDays(68)).toBe(45)
    expect(lateWithinDays(null)).toBe(14)
    expect(lateWithinDays(undefined)).toBe(14)
  })
})

describe('carryingDay', () => {
  const receipts = [
    { ymd: '2026-10-24', usd: 200_000, basis: 'late' as const },
    { ymd: '2026-10-24', usd: 27_000, basis: 'late' as const },
    { ymd: '2026-10-14', usd: 15_000, basis: 'customer' as const },
    { ymd: '2026-10-19', usd: 17_600, basis: 'customer' as const },
  ]
  const forecast = buildCashForecast({
    todayYmd: '2026-10-10',
    daysAhead: 56,
    cashTodayUsd: 32_000,
    floorUsd: 5000,
    events: [...receipts.map((r) => ({ ymd: r.ymd, usd: r.usd, label: 'x', kind: 'receipt' as const })), { ymd: '2026-10-24', usd: 54_100, label: 'Sub labor owed', kind: 'bill' as const }],
  })
  it('names the day with the most receipts when it holds 30% or more of them', () => {
    const c = carryingDay(forecast, receipts)
    expect(c).toMatchObject({ ymd: '2026-10-24', receiptsUsd: 227_000, billsUsd: 54_100, lateUsd: 227_000, lateCount: 2 })
    expect(c?.share).toBeCloseTo(227_000 / 259_600)
    expect(carryingSentence(c, () => 'Oct 24')).toBe("87% of the window's receipts ($227k) land on Oct 24, $227k of it 2 late invoices assumed to land. That day also owes $54.1k. If they slip, that is the day to watch.")
  })
  it('is null when receipts are spread, or there are none', () => {
    const spread = buildCashForecast({ todayYmd: '2026-10-10', daysAhead: 56, cashTodayUsd: 1000, floorUsd: 0, events: ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'].map((ymd) => ({ ymd, usd: 100, label: 'x', kind: 'receipt' as const })) })
    expect(carryingDay(spread, [])).toBeNull()
    expect(carryingDay(buildCashForecast({ todayYmd: '2026-10-10', daysAhead: 7, cashTodayUsd: 0, floorUsd: 0, events: [] }), [])).toBeNull()
    expect(carryingSentence(null, () => '')).toBeNull()
  })
})
