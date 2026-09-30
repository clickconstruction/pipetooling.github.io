import { describe, expect, it } from 'vitest'
import { holdsDateBoxChange, isPlausibleDate, readDateBoxEntry, unfinishedDateMessage } from './dateBoxEntry'

describe('dateBoxEntry', () => {
  it('a date is plausible only as a real day with a full year (a date box hands over 0002-… while the year is typed)', () => {
    expect(isPlausibleDate('2026-09-30')).toBe(true)
    expect(isPlausibleDate('2000-01-01')).toBe(true)
    expect(isPlausibleDate('2100-12-31')).toBe(true)
    // The year "2026" one digit at a time.
    for (const typing of ['0002-09-30', '0020-09-30', '0202-09-30', '0001-02-12']) expect(isPlausibleDate(typing)).toBe(false)
    expect(isPlausibleDate('1999-12-31')).toBe(false)
    expect(isPlausibleDate('2101-01-01')).toBe(false)
    expect(isPlausibleDate('20260-09-30')).toBe(false)
    // Not a day on the calendar, not the shape, nothing at all.
    expect(isPlausibleDate('2026-02-30')).toBe(false)
    expect(isPlausibleDate('2026-13-01')).toBe(false)
    expect(isPlausibleDate('2028-02-29')).toBe(true)
    expect(isPlausibleDate('2026-02-29')).toBe(false)
    expect(isPlausibleDate('09/30/2026')).toBe(false)
    expect(isPlausibleDate('2026-09-30T00:00:00Z')).toBe(false)
    expect(isPlausibleDate('')).toBe(false)
    expect(isPlausibleDate(null)).toBe(false)
    expect(isPlausibleDate(undefined)).toBe(false)
  })

  it('reads a date box: a finished date saves, an empty box clears, the shown date is no change, a half-typed year is unfinished', () => {
    expect(readDateBoxEntry('2026-09-30', null)).toEqual({ kind: 'save', value: '2026-09-30' })
    expect(readDateBoxEntry('2026-09-30', '2026-09-24')).toEqual({ kind: 'save', value: '2026-09-30' })
    expect(readDateBoxEntry('', '2026-09-24')).toEqual({ kind: 'save', value: null })
    expect(readDateBoxEntry('  ', '2026-09-24')).toEqual({ kind: 'save', value: null })
    expect(readDateBoxEntry('2026-09-24', '2026-09-24')).toEqual({ kind: 'unchanged' })
    expect(readDateBoxEntry('', null)).toEqual({ kind: 'unchanged' })
    expect(readDateBoxEntry('', '')).toEqual({ kind: 'unchanged' })
    expect(readDateBoxEntry('0002-09-30', null)).toEqual({ kind: 'unfinished' })
    expect(readDateBoxEntry('0202-09-30', '2026-09-24')).toEqual({ kind: 'unfinished' })
    // A bad date already stored can still be cleared or replaced; it is never re-saved.
    expect(readDateBoxEntry('', '0001-02-12')).toEqual({ kind: 'save', value: null })
    expect(readDateBoxEntry('2026-02-12', '0001-02-12')).toEqual({ kind: 'save', value: '2026-02-12' })
    expect(readDateBoxEntry('0001-02-12', '0001-02-12')).toEqual({ kind: 'unchanged' })
  })

  it('a typed change waits in the box; a pick from the calendar waits only when it is unfinished', () => {
    // Typed: the day 30 → "1" → "15" passes through a plausible 09/01, so every typed change waits.
    expect(holdsDateBoxChange(true, '2026-09-01', '2026-09-30')).toBe(true)
    expect(holdsDateBoxChange(true, '', '2026-09-30')).toBe(true)
    // Picked: a finished date, or an emptied box, goes through at once.
    expect(holdsDateBoxChange(false, '2026-09-15', '2026-09-30')).toBe(false)
    expect(holdsDateBoxChange(false, '', '2026-09-30')).toBe(false)
    expect(holdsDateBoxChange(false, '2026-09-30', '2026-09-30')).toBe(false)
    // No key event seen but the year is half typed (a browser that sends none): still held.
    expect(holdsDateBoxChange(false, '0002-09-30', null)).toBe(true)
  })

  it('the dropped-date line names the year to type', () => {
    expect(unfinishedDateMessage(2026)).toBe('That date was not finished, so it was not saved. Type the year in full, like 2026.')
  })
})
