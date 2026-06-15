import { describe, it, expect } from 'vitest'
import { toDatetimeLocal, fromDatetimeLocal } from './datetimeLocal'

/**
 * These assert America/Chicago (Central) wall-clock semantics regardless of the machine's TZ,
 * since the helpers use Intl with an explicit timeZone. CDT = UTC-5 (summer), CST = UTC-6 (winter).
 */
describe('datetimeLocal (America/Chicago wall clock)', () => {
  it('parses a summer (CDT, UTC-5) wall clock to the right instant', () => {
    expect(fromDatetimeLocal('2026-06-15T09:30')).toBe('2026-06-15T14:30:00.000Z')
  })

  it('parses a winter (CST, UTC-6) wall clock to the right instant', () => {
    expect(fromDatetimeLocal('2026-01-15T09:30')).toBe('2026-01-15T15:30:00.000Z')
  })

  it('formats an instant into the Central wall clock', () => {
    expect(toDatetimeLocal('2026-06-15T14:30:00.000Z')).toBe('2026-06-15T09:30')
    expect(toDatetimeLocal('2026-01-15T15:30:00.000Z')).toBe('2026-01-15T09:30')
  })

  it('round-trips both seasons', () => {
    for (const wall of ['2026-06-15T09:30', '2026-12-15T23:05', '2026-03-31T00:00']) {
      expect(toDatetimeLocal(fromDatetimeLocal(wall)!)).toBe(wall)
    }
  })

  it('handles the spring-forward instant (08:00Z → 03:00 CDT on 2026-03-08)', () => {
    // At 2:00 AM CST the clock jumps to 3:00 AM CDT, so the instant 08:00Z shows as 03:00.
    expect(toDatetimeLocal('2026-03-08T08:00:00.000Z')).toBe('2026-03-08T03:00')
  })

  it('treats blank/invalid input as empty / null', () => {
    expect(toDatetimeLocal(null)).toBe('')
    expect(toDatetimeLocal('')).toBe('')
    expect(toDatetimeLocal('not-a-date')).toBe('')
    expect(fromDatetimeLocal('')).toBeNull()
    expect(fromDatetimeLocal('   ')).toBeNull()
    expect(fromDatetimeLocal('garbage')).toBeNull()
  })
})
