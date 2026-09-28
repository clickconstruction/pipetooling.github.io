import { afterEach, describe, expect, it, vi } from 'vitest'
import { hubDayColumnHeaderLabel, shortDowLabel } from './hubDayLabels'

afterEach(() => {
  vi.useRealTimers()
})

describe('shortDowLabel', () => {
  it('names each day of a Sunday-first week', () => {
    const week = ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']
    expect(week.map(shortDowLabel)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
  })

  it('keeps the civil day across both daylight-saving changes', () => {
    expect(shortDowLabel('2026-03-08')).toBe('Sun')
    expect(shortDowLabel('2026-11-01')).toBe('Sun')
  })

  it('reads the date, not the surrounding whitespace', () => {
    expect(shortDowLabel(' 2026-09-28 ')).toBe('Mon')
  })

  it('falls back to today for a key that is not a date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-30T18:00:00Z'))
    expect(shortDowLabel('')).toBe('Wed')
    expect(shortDowLabel('09/28/2026')).toBe('Wed')
  })
})

describe('hubDayColumnHeaderLabel', () => {
  it('puts the zero-padded month and day in brackets after the weekday', () => {
    expect(hubDayColumnHeaderLabel('2026-09-28')).toBe('Mon (09/28)')
    expect(hubDayColumnHeaderLabel('2026-01-05')).toBe('Mon (01/05)')
  })

  it('crosses a year boundary by the date itself', () => {
    expect(hubDayColumnHeaderLabel('2026-12-31')).toBe('Thu (12/31)')
    expect(hubDayColumnHeaderLabel('2027-01-01')).toBe('Fri (01/01)')
  })
})
