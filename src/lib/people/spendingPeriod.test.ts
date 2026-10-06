import { describe, expect, it } from 'vitest'
import { isSpendingPeriod, SPENDING_PERIODS, spendingPeriodRange } from './spendingPeriod'

// 2026-10-07 is a Wednesday.
const TODAY = '2026-10-07'
const NONE = { start: '', end: '' }

describe('spendingPeriodRange', () => {
  it('this week runs from Sunday to today; last week is the seven days before it', () => {
    expect(spendingPeriodRange('this_week', NONE, TODAY)).toEqual({ start: '2026-10-04', end: TODAY, shortened: false })
    expect(spendingPeriodRange('last_week', NONE, TODAY)).toEqual({ start: '2026-09-27', end: '2026-10-03', shortened: false })
  })

  it('this month runs from the first to today; last month is the whole month before', () => {
    expect(spendingPeriodRange('this_month', NONE, TODAY)).toEqual({ start: '2026-10-01', end: TODAY, shortened: false })
    expect(spendingPeriodRange('last_month', NONE, TODAY)).toEqual({ start: '2026-09-01', end: '2026-09-30', shortened: false })
    expect(spendingPeriodRange('last_month', NONE, '2026-03-15')).toEqual({ start: '2026-02-01', end: '2026-02-28', shortened: false })
    expect(spendingPeriodRange('last_month', NONE, '2027-01-02')).toEqual({ start: '2026-12-01', end: '2026-12-31', shortened: false })
  })

  it('last 30 days includes today', () => {
    expect(spendingPeriodRange('last_30_days', NONE, TODAY)).toEqual({ start: '2026-09-08', end: TODAY, shortened: false })
  })

  it('a custom range swaps when backwards, is one day when half filled, today when empty', () => {
    expect(spendingPeriodRange('custom', { start: '2026-09-30', end: '2026-09-01' }, TODAY)).toMatchObject({ start: '2026-09-01', end: '2026-09-30' })
    expect(spendingPeriodRange('custom', { start: '2026-09-12', end: '' }, TODAY)).toMatchObject({ start: '2026-09-12', end: '2026-09-12' })
    expect(spendingPeriodRange('custom', { start: '', end: '2026-09-12' }, TODAY)).toMatchObject({ start: '2026-09-12', end: '2026-09-12' })
    expect(spendingPeriodRange('custom', NONE, TODAY)).toMatchObject({ start: TODAY, end: TODAY })
  })

  it('a custom range longer than the read allows keeps its last 366 days and says so', () => {
    expect(spendingPeriodRange('custom', { start: '2024-01-01', end: '2026-09-30' }, TODAY)).toEqual({ start: '2025-09-30', end: '2026-09-30', shortened: true })
    expect(spendingPeriodRange('custom', { start: '2025-09-30', end: '2026-09-30' }, TODAY).shortened).toBe(false)
  })

  it('knows its own keys', () => {
    expect(SPENDING_PERIODS.map((p) => p.key)).toEqual(['this_week', 'last_week', 'this_month', 'last_month', 'last_30_days', 'custom'])
    expect(isSpendingPeriod('last_month')).toBe(true)
    expect(isSpendingPeriod('last_year')).toBe(false)
  })
})
