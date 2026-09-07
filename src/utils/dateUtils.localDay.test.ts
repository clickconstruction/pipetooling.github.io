import { describe, expect, it } from 'vitest'
import { localCalendarDayKey } from './dateUtils'

/**
 * The drop-in for `d.toLocaleDateString('en-CA')` (v2.3061 sweep): the
 * device's own calendar day from the Date's parts, never from locale data.
 */
describe('localCalendarDayKey', () => {
  it('formats a local Date from its own parts, zero-padded, in the device zone', () => {
    expect(localCalendarDayKey(new Date(2026, 8, 7))).toBe('2026-09-07')
    expect(localCalendarDayKey(new Date(2026, 0, 1, 23, 59, 59))).toBe('2026-01-01')
    expect(localCalendarDayKey(new Date(2025, 11, 31))).toBe('2025-12-31')
  })
  it('matches what en-CA gave in browsers (year/month/day parts), whatever order this runtime prints them in', () => {
    const d = new Date(2026, 8, 7, 12)
    const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
    const get = (t: string) => parts.find((p) => p.type === t)?.value
    expect(localCalendarDayKey(d)).toBe(`${get('year')}-${get('month')}-${get('day')}`)
  })
  it('an invalid Date reads as empty', () => {
    expect(localCalendarDayKey(new Date('nope'))).toBe('')
  })
})
