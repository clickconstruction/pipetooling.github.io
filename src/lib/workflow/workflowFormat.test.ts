import { describe, expect, it } from 'vitest'
import {
  daysBetween,
  daysOpen,
  expectedDueState,
  formatAmount,
  formatDateShort,
  formatDatetime,
  formatScheduledDateShort,
} from './workflowFormat'

describe('formatDatetime', () => {
  it('prints the weekday, date and time in the app’s time zone', () => {
    // 20:05 UTC on 7 Sep 2026 is 3:05 PM in Chicago (CDT).
    const out = formatDatetime('2026-09-07T20:05:00Z')
    expect(out.startsWith('Mon, 9/7/26')).toBe(true)
    expect(out).toMatch(/3:05\sPM$/)
  })

  it('takes the day from the app’s time zone, not UTC', () => {
    // 03:30 UTC on the 8th is still the evening of the 7th in Chicago.
    expect(formatDatetime('2026-09-08T03:30:00Z').startsWith('Mon, 9/7/26')).toBe(true)
  })

  it('says unknown for no value', () => {
    expect(formatDatetime(null)).toBe('unknown')
    expect(formatDatetime('')).toBe('unknown')
  })
})

describe('formatDateShort', () => {
  it('prints M/D/YY in the app’s time zone', () => {
    expect(formatDateShort('2026-09-07T20:05:00Z')).toBe('9/7/26')
    expect(formatDateShort('2026-09-08T03:30:00Z')).toBe('9/7/26')
    expect(formatDateShort('2026-12-25T18:00:00Z')).toBe('12/25/26')
  })

  it('is an em dash for no value', () => {
    expect(formatDateShort(null)).toBe('—')
  })
})

describe('daysOpen', () => {
  const now = new Date('2026-09-10T12:00:00Z')

  it('counts whole days from the start to now', () => {
    expect(daysOpen('2026-09-07T12:00:00Z', null, now)).toBe(3)
    expect(daysOpen('2026-09-07T13:00:00Z', null, now)).toBe(2)
    expect(daysOpen('2026-09-10T11:00:00Z', null, now)).toBe(0)
  })

  it('is null for a step that has not started or has ended', () => {
    expect(daysOpen(null, null, now)).toBeNull()
    expect(daysOpen('2026-09-07T12:00:00Z', '2026-09-08T12:00:00Z', now)).toBeNull()
  })

  it('is null for a start in the future', () => {
    expect(daysOpen('2026-09-11T12:00:00Z', null, now)).toBeNull()
  })
})

describe('daysBetween', () => {
  it('counts whole days from start to end', () => {
    expect(daysBetween('2026-09-07T12:00:00Z', '2026-09-10T12:00:00Z')).toBe(3)
    expect(daysBetween('2026-09-07T12:00:00Z', '2026-09-10T11:59:00Z')).toBe(2)
    expect(daysBetween('2026-09-07T12:00:00Z', '2026-09-07T18:00:00Z')).toBe(0)
  })

  it('is null when either end is missing', () => {
    expect(daysBetween(null, '2026-09-10T12:00:00Z')).toBeNull()
    expect(daysBetween('2026-09-07T12:00:00Z', null)).toBeNull()
  })

  it('is null when the end is before the start', () => {
    expect(daysBetween('2026-09-10T12:00:00Z', '2026-09-07T12:00:00Z')).toBeNull()
  })
})

describe('formatAmount', () => {
  it('prints dollars and cents with thousands separators', () => {
    expect(formatAmount(1234.5)).toBe('$1,234.50')
    expect(formatAmount(1234567.891)).toBe('$1,234,567.89')
    expect(formatAmount(0.5)).toBe('$0.50')
  })

  it('puts a negative in accounting parentheses, not behind a minus sign', () => {
    expect(formatAmount(-1234.56)).toBe('($1,234.56)')
    expect(formatAmount(-0.01)).toBe('($0.01)')
  })

  it('prints $0.00 for zero, null and undefined', () => {
    expect(formatAmount(0)).toBe('$0.00')
    expect(formatAmount(null)).toBe('$0.00')
    expect(formatAmount(undefined)).toBe('$0.00')
  })

  it('keeps the parentheses on a negative that rounds to zero', () => {
    expect(formatAmount(-0.004)).toBe('($0.00)')
  })
})

describe('formatScheduledDateShort', () => {
  const asPrinted = (y: number, m: number, d: number) =>
    new Date(y, m - 1, d, 12).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: '2-digit' })

  it('prints the calendar day written in the value', () => {
    expect(formatScheduledDateShort('2026-09-07')).toBe(asPrinted(2026, 9, 7))
  })

  it('reads the day off the text of a timestamp — a late-evening UTC time does not move it', () => {
    expect(formatScheduledDateShort('2026-09-07T23:59:00Z')).toBe(asPrinted(2026, 9, 7))
    expect(formatScheduledDateShort('2026-09-07T00:00:00+00:00')).toBe(asPrinted(2026, 9, 7))
  })

  it('is an em dash for a blank or unreadable value', () => {
    expect(formatScheduledDateShort(null)).toBe('—')
    expect(formatScheduledDateShort(undefined)).toBe('—')
    expect(formatScheduledDateShort('')).toBe('—')
    expect(formatScheduledDateShort('junk')).toBe('—')
  })
})

describe('expectedDueState', () => {
  const today = '2026-09-10'

  it('never ages a finished step', () => {
    for (const status of ['completed', 'approved', 'skipped', 'rejected']) {
      expect(expectedDueState({ status, scheduled_end_date: '2026-01-01' }, today)).toBeNull()
    }
  })

  it('is red and counts the days once the expected end has passed', () => {
    expect(expectedDueState({ status: 'in_progress', scheduled_end_date: '2026-09-07' }, today)).toEqual({
      state: 'red',
      daysLate: 3,
      label: '3 days late',
    })
  })

  it('is amber on the day it is due', () => {
    expect(expectedDueState({ status: 'pending', scheduled_end_date: today }, today)).toMatchObject({
      state: 'amber',
      label: 'due today',
    })
  })

  it('is amber for a pending step whose start has slipped', () => {
    expect(
      expectedDueState(
        { status: 'pending', scheduled_start_date: '2026-09-08', scheduled_end_date: '2026-09-20' },
        today,
      ),
    ).toMatchObject({ state: 'amber', label: 'start 2 days past' })
  })

  it('does not count a slipped start against a step already in progress', () => {
    expect(
      expectedDueState(
        { status: 'in_progress', scheduled_start_date: '2026-09-08', scheduled_end_date: '2026-09-20' },
        today,
      ),
    ).toMatchObject({ state: 'fresh', label: '' })
  })

  it('reads the day off a timestamp value', () => {
    expect(
      expectedDueState({ status: 'pending', scheduled_end_date: '2026-09-10T00:00:00+00:00' }, today),
    ).toMatchObject({ state: 'amber', label: 'due today' })
  })

  it('is fresh with no expected dates', () => {
    expect(expectedDueState({ status: 'pending' }, today)).toMatchObject({ state: 'fresh' })
  })
})
