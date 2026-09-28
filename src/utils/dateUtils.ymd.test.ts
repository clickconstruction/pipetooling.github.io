import { describe, expect, it } from 'vitest'
import { ymdAddDays, ymdDaysBetween, ymdFromDateLike } from './dateUtils'

describe('ymdFromDateLike', () => {
  it('takes the first ten characters', () => {
    expect(ymdFromDateLike('2026-09-07')).toBe('2026-09-07')
    expect(ymdFromDateLike('2026-09-07T23:59:00Z')).toBe('2026-09-07')
    expect(ymdFromDateLike('2026-09-07 00:00:00+00')).toBe('2026-09-07')
  })

  it('is blank for no value', () => {
    expect(ymdFromDateLike(null)).toBe('')
    expect(ymdFromDateLike(undefined)).toBe('')
    expect(ymdFromDateLike('')).toBe('')
  })

  it('does not validate what it slices', () => {
    expect(ymdFromDateLike('not a date at all')).toBe('not a date')
  })
})

describe('ymdDaysBetween', () => {
  it('counts civil days forward, 0 for the same day', () => {
    expect(ymdDaysBetween('2026-09-07', '2026-09-10')).toBe(3)
    expect(ymdDaysBetween('2026-09-07', '2026-09-07')).toBe(0)
    expect(ymdDaysBetween('2026-12-30', '2027-01-02')).toBe(3)
  })

  it('is negative when the end is first', () => {
    expect(ymdDaysBetween('2026-09-10', '2026-09-07')).toBe(-3)
  })

  it('counts a leap day', () => {
    expect(ymdDaysBetween('2028-02-28', '2028-03-01')).toBe(2)
    expect(ymdDaysBetween('2026-02-28', '2026-03-01')).toBe(1)
  })

  it('counts a daylight-saving day as one day', () => {
    // US clocks: forward 8 Mar 2026, back 1 Nov 2026.
    expect(ymdDaysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(ymdDaysBetween('2026-10-31', '2026-11-02')).toBe(2)
  })

  it('is null when either side is blank or is not three numbers', () => {
    expect(ymdDaysBetween('', '2026-09-07')).toBeNull()
    expect(ymdDaysBetween('2026-09-07', '')).toBeNull()
    expect(ymdDaysBetween('junk', '2026-09-07')).toBeNull()
    expect(ymdDaysBetween('2026-09', '2026-09-07')).toBeNull()
  })
})

describe('ymdAddDays and ymdDaysBetween', () => {
  it('undo each other — a start plus a length gives an end that length away', () => {
    for (const start of ['2026-01-31', '2026-03-07', '2026-10-31', '2028-02-28', '2026-12-31']) {
      for (const days of [0, 1, 2, 30, 365, -1, -45]) {
        expect(ymdDaysBetween(start, ymdAddDays(start, days))).toBe(days)
      }
    }
  })

  it('ymdAddDays matches the rule the Workflow page used to carry, on every date a date field can hold', () => {
    const workflowPageRule = (ymd: string, days: number): string => {
      if (!ymd) return ''
      const parts = ymd.split('-').map(Number)
      if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return ''
      const [y, m, d] = parts as [number, number, number]
      const dt = new Date(y, m - 1, d)
      dt.setDate(dt.getDate() + days)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
    }
    for (const start of ['', '2026-01-31', '2026-03-07', '2026-03-08', '2026-10-31', '2026-11-01', '2028-02-28', '2026-12-31']) {
      for (const days of [0, 1, 2, 7, 30, 365, -1, -45, 1.5]) {
        expect(ymdAddDays(start, days)).toBe(workflowPageRule(start, days))
      }
    }
  })

  it('ymdAddDays hands back a value it cannot read (the page’s old rule returned blank)', () => {
    expect(ymdAddDays('junk', 3)).toBe('junk')
  })
})
