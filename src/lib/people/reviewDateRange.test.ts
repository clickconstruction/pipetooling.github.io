import { describe, expect, it } from 'vitest'
import { computeReviewDateRange, ymdAddYears, ymdDayOfWeek } from './reviewDateRange'

// 2026-09-03 is a Thursday.
const TODAY = '2026-09-03'
const none = { start: '', end: '' }

describe('ymd helpers', () => {
  it('reads the weekday from the string alone', () => {
    expect(ymdDayOfWeek('2026-09-03')).toBe(4)
    expect(ymdDayOfWeek('2026-08-30')).toBe(0)
  })
  it('adds years and clamps Feb 29', () => {
    expect(ymdAddYears('2026-09-03', -2)).toBe('2024-09-03')
    expect(ymdAddYears('2024-02-29', 1)).toBe('2025-02-28')
    expect(ymdAddYears('2025-08-05', 1)).toBe('2026-08-05')
  })
})

describe('computeReviewDateRange', () => {
  it('matches the tab’s historical rules for every preset', () => {
    expect(computeReviewDateRange('today', none, TODAY)).toEqual(['2026-09-03', '2026-09-03'])
    expect(computeReviewDateRange('yesterday', none, TODAY)).toEqual(['2026-09-02', '2026-09-02'])
    expect(computeReviewDateRange('this_week', none, TODAY)).toEqual(['2026-08-30', '2026-09-03'])
    expect(computeReviewDateRange('last_week', none, TODAY)).toEqual(['2026-08-23', '2026-08-29'])
    expect(computeReviewDateRange('last_two_weeks', none, TODAY)).toEqual(['2026-08-16', '2026-08-29'])
    expect(computeReviewDateRange('last_30_days', none, TODAY)).toEqual(['2026-08-05', '2026-09-03'])
    expect(computeReviewDateRange('last_90_days', none, TODAY)).toEqual(['2026-06-06', '2026-09-03'])
    expect(computeReviewDateRange('this_year', none, TODAY)).toEqual(['2026-01-01', '2026-09-03'])
  })
  it('handles custom ranges: swap, collapse to one side, fall back to today', () => {
    expect(computeReviewDateRange('custom', { start: '2026-08-10', end: '2026-08-01' }, TODAY)).toEqual(['2026-08-01', '2026-08-10'])
    expect(computeReviewDateRange('custom', { start: '2026-08-10', end: '' }, TODAY)).toEqual(['2026-08-10', '2026-08-10'])
    expect(computeReviewDateRange('custom', { start: '', end: ' 2026-08-12 ' }, TODAY)).toEqual(['2026-08-12', '2026-08-12'])
    expect(computeReviewDateRange('custom', none, TODAY)).toEqual([TODAY, TODAY])
  })
  it('is anchored on the injected day, so a Sunday today starts this week today', () => {
    expect(computeReviewDateRange('this_week', none, '2026-08-30')).toEqual(['2026-08-30', '2026-08-30'])
    expect(computeReviewDateRange('last_week', none, '2026-08-30')).toEqual(['2026-08-23', '2026-08-29'])
  })
})
