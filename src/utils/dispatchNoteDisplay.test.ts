import { describe, expect, it } from 'vitest'
import {
  formatDispatchNoteDaysAgoShort,
  formatDispatchNoteDaysAgoShortPhrase,
} from './dispatchNoteDisplay'

// Chicago is UTC-5 in July (CDT); noon UTC is mid-morning same calendar day.
const NOW = new Date('2026-07-15T12:00:00Z')

describe('formatDispatchNoteDaysAgoShort', () => {
  it('same Chicago calendar day → "today"', () => {
    expect(formatDispatchNoteDaysAgoShort('2026-07-15T11:00:00Z', NOW)).toBe('today')
  })
  it('previous calendar day → "1d"', () => {
    expect(formatDispatchNoteDaysAgoShort('2026-07-14T11:00:00Z', NOW)).toBe('1d')
  })
  it('61 calendar days back → "61d"', () => {
    expect(formatDispatchNoteDaysAgoShort('2026-05-15T11:00:00Z', NOW)).toBe('61d')
  })
  it('counts Chicago calendar days, not 24h windows: late UTC yesterday is still same Chicago day', () => {
    // 2026-07-15T03:00Z = 2026-07-14 22:00 in Chicago → 1 calendar day before 2026-07-15 morning
    expect(formatDispatchNoteDaysAgoShort('2026-07-15T03:00:00Z', NOW)).toBe('1d')
  })
})

describe('formatDispatchNoteDaysAgoShortPhrase', () => {
  it('same day → "today" (no "ago")', () => {
    expect(formatDispatchNoteDaysAgoShortPhrase('2026-07-15T11:00:00Z', NOW)).toBe('today')
  })
  it('older → "<n>d ago"', () => {
    expect(formatDispatchNoteDaysAgoShortPhrase('2026-07-14T11:00:00Z', NOW)).toBe('1d ago')
    expect(formatDispatchNoteDaysAgoShortPhrase('2026-05-15T11:00:00Z', NOW)).toBe('61d ago')
  })
})
