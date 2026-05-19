import { describe, expect, it } from 'vitest'
import { formatClockSessionTimestampPartsChicago } from './formatClockSessionTimestamp'

describe('formatClockSessionTimestampPartsChicago', () => {
  it('returns null for null, undefined, empty, or whitespace input', () => {
    expect(formatClockSessionTimestampPartsChicago(null)).toBeNull()
    expect(formatClockSessionTimestampPartsChicago(undefined)).toBeNull()
    expect(formatClockSessionTimestampPartsChicago('')).toBeNull()
    expect(formatClockSessionTimestampPartsChicago('   ')).toBeNull()
  })

  it('returns null for unparseable input', () => {
    expect(formatClockSessionTimestampPartsChicago('not-a-date')).toBeNull()
    expect(formatClockSessionTimestampPartsChicago('2026-13-99T99:99:99Z')).toBeNull()
  })

  it('formats a UTC ISO timestamp as Chicago wall-clock parts', () => {
    // 2026-05-04T12:30:00Z == 2026-05-04 07:30 CDT (Monday during DST)
    const now = new Date('2026-05-09T15:00:00.000Z')
    const parts = formatClockSessionTimestampPartsChicago('2026-05-04T12:30:00.000Z', now)
    expect(parts).not.toBeNull()
    expect(parts!.date).toMatch(/^Mon,/)
    expect(parts!.date).toMatch(/May 4, 2026/)
    expect(parts!.time).toMatch(/7:30/)
    expect(parts!.time).toMatch(/AM/)
  })

  it('handles standard time (CST, no DST) correctly', () => {
    // 2026-01-15T22:45:00Z == 2026-01-15 16:45 CST (Thursday, no DST)
    const now = new Date('2026-01-16T22:45:00.000Z')
    const parts = formatClockSessionTimestampPartsChicago('2026-01-15T22:45:00.000Z', now)
    expect(parts!.date).toMatch(/^Thu,/)
    expect(parts!.date).toMatch(/Jan 15, 2026/)
    expect(parts!.time).toMatch(/4:45/)
    expect(parts!.time).toMatch(/PM/)
  })

  it('preserves single-digit hours without zero padding', () => {
    // 2026-06-10T13:05:00Z == 2026-06-10 08:05 CDT
    const now = new Date('2026-06-10T20:00:00.000Z')
    const parts = formatClockSessionTimestampPartsChicago('2026-06-10T13:05:00.000Z', now)
    expect(parts!.time).toMatch(/8:05/)
    expect(parts!.time).not.toMatch(/08:05/)
  })

  describe('relative day label', () => {
    it('returns "today" when the timestamp falls on the same Chicago calendar day', () => {
      // Both 2026-05-13 in Chicago (CDT).
      const stamp = '2026-05-13T13:32:00.000Z'
      const now = new Date('2026-05-13T22:00:00.000Z')
      expect(formatClockSessionTimestampPartsChicago(stamp, now)!.relative).toBe('today')
    })

    it('returns "yesterday" when the stamp is one Chicago calendar day before now', () => {
      const stamp = '2026-05-12T13:32:00.000Z'
      const now = new Date('2026-05-13T22:00:00.000Z')
      expect(formatClockSessionTimestampPartsChicago(stamp, now)!.relative).toBe('yesterday')
    })

    it('returns "N days ago" for stamps 2+ Chicago days before now', () => {
      const stamp = '2026-05-08T13:32:00.000Z'
      const now = new Date('2026-05-13T22:00:00.000Z')
      expect(formatClockSessionTimestampPartsChicago(stamp, now)!.relative).toBe('5 days ago')
    })

    it('returns "tomorrow" for stamps one Chicago day after now', () => {
      const stamp = '2026-05-14T13:32:00.000Z'
      const now = new Date('2026-05-13T22:00:00.000Z')
      expect(formatClockSessionTimestampPartsChicago(stamp, now)!.relative).toBe('tomorrow')
    })

    it('returns "in N days" for stamps 2+ Chicago days in the future', () => {
      const stamp = '2026-05-20T13:32:00.000Z'
      const now = new Date('2026-05-13T22:00:00.000Z')
      expect(formatClockSessionTimestampPartsChicago(stamp, now)!.relative).toBe('in 7 days')
    })

    it('uses Chicago calendar days so late-evening Chicago timestamps and early-morning UTC still count as same-day', () => {
      // 2026-05-13T04:30:00Z == 2026-05-12 23:30 CDT (still Tuesday evening in Chicago).
      // 2026-05-13T06:00:00Z == 2026-05-13 01:00 CDT (Wednesday morning in Chicago).
      const stamp = '2026-05-13T04:30:00.000Z'
      const now = new Date('2026-05-13T06:00:00.000Z')
      expect(formatClockSessionTimestampPartsChicago(stamp, now)!.relative).toBe('yesterday')
    })
  })
})
