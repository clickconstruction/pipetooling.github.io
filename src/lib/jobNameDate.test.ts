import { describe, expect, it } from 'vitest'
import { jobNameWithPlainDates, plainDateWords } from './jobNameDate'

describe('plainDateWords', () => {
  it('says a date as the day of the week and the month and day', () => {
    expect(plainDateWords(2026, 11, 8)).toBe('Sun, Nov 8')
    expect(plainDateWords(2026, 11, 18)).toBe('Wed, Nov 18')
    expect(plainDateWords(2024, 2, 29)).toBe('Thu, Feb 29')
  })

  it('answers null for numbers that are not a day on the calendar', () => {
    expect(plainDateWords(2026, 13, 1)).toBeNull()
    expect(plainDateWords(2026, 0, 10)).toBeNull()
    expect(plainDateWords(2026, 2, 30)).toBeNull()
    expect(plainDateWords(2026, 4, 31)).toBeNull()
    expect(plainDateWords(2026, 6, 0)).toBeNull()
  })
})

describe('jobNameWithPlainDates', () => {
  it('rewrites a date at the end of a name', () => {
    expect(jobNameWithPlainDates('ZZ Test Walk Project 2026-11-08')).toBe('ZZ Test Walk Project Sun, Nov 8')
  })

  it('rewrites a date anywhere in a name, and every date in it', () => {
    expect(jobNameWithPlainDates('2026-11-08 walk')).toBe('Sun, Nov 8 walk')
    expect(jobNameWithPlainDates('Walk (2026-11-08)')).toBe('Walk (Sun, Nov 8)')
    expect(jobNameWithPlainDates('Phase 2026-11-09 to 2026-11-13')).toBe('Phase Mon, Nov 9 to Fri, Nov 13')
  })

  it('leaves a name with no date as it is', () => {
    expect(jobNameWithPlainDates('Linden vanity faucet')).toBe('Linden vanity faucet')
    expect(jobNameWithPlainDates('Take-out window re-pipe')).toBe('Take-out window re-pipe')
    expect(jobNameWithPlainDates('')).toBe('')
    expect(jobNameWithPlainDates(null)).toBe('')
    expect(jobNameWithPlainDates(undefined)).toBe('')
  })

  it('leaves numbers that only look like a date', () => {
    // Not a day on the calendar.
    expect(jobNameWithPlainDates('Lot 2026-13-40')).toBe('Lot 2026-13-40')
    // Part of a longer run of digits or dashes: a part number, a phone number.
    expect(jobNameWithPlainDates('Part 12026-11-08')).toBe('Part 12026-11-08')
    expect(jobNameWithPlainDates('Part 2026-11-081')).toBe('Part 2026-11-081')
    expect(jobNameWithPlainDates('Ref 2026-11-08-4')).toBe('Ref 2026-11-08-4')
    expect(jobNameWithPlainDates('Ref 7-2026-11-08')).toBe('Ref 7-2026-11-08')
    // Another way of writing a date is not guessed at.
    expect(jobNameWithPlainDates('Walk 11/08/2026')).toBe('Walk 11/08/2026')
  })
})
