import { describe, it, expect } from 'vitest'
import { computeShareDates, dowSun0FromYmd, isShareConfigValid } from './scheduleShareDates'

// 2026-06-01 is a Monday; 2026-06-07 is a Sunday.
describe('dowSun0FromYmd', () => {
  it('maps known dates to Sun=0..Sat=6', () => {
    expect(dowSun0FromYmd('2026-06-07')).toBe(0) // Sunday
    expect(dowSun0FromYmd('2026-06-01')).toBe(1) // Monday
    expect(dowSun0FromYmd('2026-06-06')).toBe(6) // Saturday
  })
  it('returns 0 on bad input', () => {
    expect(dowSun0FromYmd('nope')).toBe(0)
  })
})

describe('computeShareDates', () => {
  it('current day only', () => {
    expect(computeShareDates('2026-06-03', { includeCurrentDay: true, scope: 'none' })).toEqual([
      '2026-06-03',
    ])
  })

  it('next day only (excludes today)', () => {
    expect(computeShareDates('2026-06-03', { includeCurrentDay: false, scope: 'next_day' })).toEqual([
      '2026-06-04',
    ])
  })

  it('current day + next day', () => {
    expect(computeShareDates('2026-06-03', { includeCurrentDay: true, scope: 'next_day' })).toEqual([
      '2026-06-03',
      '2026-06-04',
    ])
  })

  it('rest of week from a Wednesday runs through the coming Sunday, excluding today', () => {
    // Wed 2026-06-03 → Thu..Sun
    expect(
      computeShareDates('2026-06-03', { includeCurrentDay: false, scope: 'rest_of_week' }),
    ).toEqual(['2026-06-04', '2026-06-05', '2026-06-06', '2026-06-07'])
  })

  it('current day + rest of week is contiguous through Sunday', () => {
    expect(
      computeShareDates('2026-06-03', { includeCurrentDay: true, scope: 'rest_of_week' }),
    ).toEqual([
      '2026-06-03',
      '2026-06-04',
      '2026-06-05',
      '2026-06-06',
      '2026-06-07',
    ])
  })

  it('rest of week on Sunday yields no extra days', () => {
    expect(
      computeShareDates('2026-06-07', { includeCurrentDay: false, scope: 'rest_of_week' }),
    ).toEqual([])
    expect(
      computeShareDates('2026-06-07', { includeCurrentDay: true, scope: 'rest_of_week' }),
    ).toEqual(['2026-06-07'])
  })

  it('rest of week on Saturday includes only Sunday', () => {
    expect(
      computeShareDates('2026-06-06', { includeCurrentDay: true, scope: 'rest_of_week' }),
    ).toEqual(['2026-06-06', '2026-06-07'])
  })

  it('crosses a month boundary correctly', () => {
    // Sat 2026-05-30 → today + Sun 2026-05-31
    expect(
      computeShareDates('2026-05-30', { includeCurrentDay: true, scope: 'rest_of_week' }),
    ).toEqual(['2026-05-30', '2026-05-31'])
  })
})

describe('isShareConfigValid', () => {
  it('requires at least one day-set', () => {
    expect(isShareConfigValid({ includeCurrentDay: false, scope: 'none' })).toBe(false)
    expect(isShareConfigValid({ includeCurrentDay: true, scope: 'none' })).toBe(true)
    expect(isShareConfigValid({ includeCurrentDay: false, scope: 'next_day' })).toBe(true)
    expect(isShareConfigValid({ includeCurrentDay: false, scope: 'rest_of_week' })).toBe(true)
  })
})
