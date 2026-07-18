import { describe, expect, it } from 'vitest'
import { formatTDays, getDaysUntilDue } from './dashboardMyInbox'

describe('getDaysUntilDue', () => {
  const today = new Date(2026, 6, 17, 14, 30, 45) // Fri 2026-07-17, mid-afternoon

  it('returns 0 for a date scheduled today (time of day ignored)', () => {
    expect(getDaysUntilDue('2026-07-17', today)).toBe(0)
  })

  it('returns 1 for tomorrow', () => {
    expect(getDaysUntilDue('2026-07-18', today)).toBe(1)
  })

  it('returns -1 for yesterday', () => {
    expect(getDaysUntilDue('2026-07-16', today)).toBe(-1)
  })

  it('counts across a month boundary', () => {
    expect(getDaysUntilDue('2026-08-01', today)).toBe(15)
  })

  it('counts across a year boundary', () => {
    expect(getDaysUntilDue('2027-01-01', today)).toBe(168)
  })

  it('rounds through DST transitions (23/25-hour days)', () => {
    // US DST ends 2026-11-01; the span contains a 25-hour day.
    expect(getDaysUntilDue('2026-11-02', today)).toBe(108)
    // Spring-forward span (23-hour day on 2026-03-08).
    expect(getDaysUntilDue('2026-03-09', new Date(2026, 2, 6))).toBe(3)
  })

  it('defaults `today` to now', () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    expect(getDaysUntilDue(`${y}-${m}-${d}`)).toBe(0)
  })
})

describe('formatTDays', () => {
  it('formats today as T-0', () => {
    expect(formatTDays(0)).toBe('T-0')
  })

  it('formats future days as T-n', () => {
    expect(formatTDays(3)).toBe('T-3')
  })

  it('formats overdue days as T+n', () => {
    expect(formatTDays(-2)).toBe('T+2')
  })
})
