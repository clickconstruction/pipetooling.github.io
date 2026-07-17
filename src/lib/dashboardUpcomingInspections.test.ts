import { describe, expect, it } from 'vitest'
import { formatUpcomingInspectionDateLine } from './dashboardUpcomingInspections'

describe('formatUpcomingInspectionDateLine', () => {
  const friday = new Date(2026, 6, 17, 14, 30) // Fri 2026-07-17, mid-afternoon

  it('labels today as (0) with its weekday', () => {
    expect(formatUpcomingInspectionDateLine('2026-07-17', friday)).toBe('2026-07-17 (0) Friday')
  })

  it('labels tomorrow as (1)', () => {
    expect(formatUpcomingInspectionDateLine('2026-07-18', friday)).toBe('2026-07-18 (1) Saturday')
  })

  it('labels the day after tomorrow as (2)', () => {
    expect(formatUpcomingInspectionDateLine('2026-07-19', friday)).toBe('2026-07-19 (2) Sunday')
  })

  it('ignores the time of day on `today`', () => {
    const lateNight = new Date(2026, 6, 17, 23, 59)
    expect(formatUpcomingInspectionDateLine('2026-07-18', lateNight)).toBe('2026-07-18 (1) Saturday')
  })

  it('handles month boundaries', () => {
    const jul31 = new Date(2026, 6, 31, 9, 0)
    expect(formatUpcomingInspectionDateLine('2026-08-01', jul31)).toBe('2026-08-01 (1) Saturday')
  })

  it('labels past dates with a negative diff', () => {
    expect(formatUpcomingInspectionDateLine('2026-07-16', friday)).toBe('2026-07-16 (-1) Thursday')
  })
})
