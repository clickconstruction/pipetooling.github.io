import { describe, expect, it } from 'vitest'
import {
  scheduleDateKeyAddDays,
  scheduleFormatWindow,
  scheduleTodayDateKey,
} from './jobScheduleChicago'

/**
 * These date-key helpers assemble YYYY-MM-DD from `formatToParts` instead of a
 * locale's numeric pattern. The older ICU bundled with Node 20 renders `en-CA`
 * as "08/03/2026" while browsers render "2026-08-03", so a pattern-dependent
 * implementation passes in the browser and silently breaks under vitest — the
 * reason these functions previously had no coverage at all.
 */
describe('scheduleTodayDateKey', () => {
  it('formats as YYYY-MM-DD regardless of the runtime ICU date pattern', () => {
    const key = scheduleTodayDateKey(new Date(Date.UTC(2026, 7, 3, 17, 0, 0)))
    expect(key).toBe('2026-08-03')
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('resolves the instant in company time, not UTC', () => {
    // 03:00 UTC on Aug 4 is still Aug 3 in Chicago (UTC-5 in summer).
    expect(scheduleTodayDateKey(new Date(Date.UTC(2026, 7, 4, 3, 0, 0)))).toBe('2026-08-03')
  })

  it('zero-pads single-digit months and days', () => {
    expect(scheduleTodayDateKey(new Date(Date.UTC(2026, 0, 5, 18, 0, 0)))).toBe('2026-01-05')
  })
})

describe('scheduleDateKeyAddDays', () => {
  it('adds and subtracts days', () => {
    expect(scheduleDateKeyAddDays('2026-08-03', -1)).toBe('2026-08-02')
    expect(scheduleDateKeyAddDays('2026-08-03', 2)).toBe('2026-08-05')
    expect(scheduleDateKeyAddDays('2026-08-03', 0)).toBe('2026-08-03')
  })

  it('crosses month, year, and leap-day boundaries', () => {
    expect(scheduleDateKeyAddDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(scheduleDateKeyAddDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(scheduleDateKeyAddDays('2028-03-01', -1)).toBe('2028-02-29')
  })

  it('advances exactly one civil day across both DST transitions', () => {
    expect(scheduleDateKeyAddDays('2026-03-07', 1)).toBe('2026-03-08')
    expect(scheduleDateKeyAddDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(scheduleDateKeyAddDays('2026-11-01', 1)).toBe('2026-11-02')
  })

  it('returns null for an unparseable key', () => {
    expect(scheduleDateKeyAddDays('2026-8-3', -1)).toBeNull()
    expect(scheduleDateKeyAddDays('', -1)).toBeNull()
  })
})

describe('scheduleFormatWindow', () => {
  it('renders stored wall time without shifting it', () => {
    expect(scheduleFormatWindow('06:00:00', '08:00:00')).toBe('6:00 AM–8:00 AM')
  })
})
