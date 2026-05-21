import { describe, it, expect } from 'vitest'
import { formatRelativeDayPhrase, relativeDayOffset } from './relativeDayPhrase'

describe('relativeDayOffset', () => {
  it('returns 0 when dayYmd equals todayYmd', () => {
    expect(relativeDayOffset('2026-05-21', '2026-05-21')).toBe(0)
  })

  it('returns positive integers for past days', () => {
    expect(relativeDayOffset('2026-05-18', '2026-05-21')).toBe(3)
  })

  it('returns negative integers for future days', () => {
    expect(relativeDayOffset('2026-05-23', '2026-05-21')).toBe(-2)
  })

  it('crosses year boundaries correctly', () => {
    expect(relativeDayOffset('2025-12-31', '2026-01-01')).toBe(1)
    expect(relativeDayOffset('2026-01-01', '2025-12-31')).toBe(-1)
  })

  it('handles the leap day → following day transition', () => {
    expect(relativeDayOffset('2024-02-29', '2024-03-01')).toBe(1)
  })

  it('returns null for malformed inputs', () => {
    expect(relativeDayOffset('not a date', '2026-05-21')).toBeNull()
    expect(relativeDayOffset('2026-05-21', '')).toBeNull()
    expect(relativeDayOffset('2026-13-40', '2026-05-21')).not.toBeNull()
  })
})

describe('formatRelativeDayPhrase', () => {
  it('returns "today" for the same day', () => {
    expect(formatRelativeDayPhrase('2026-05-21', '2026-05-21')).toBe('today')
  })

  it('returns "yesterday" for one day before today', () => {
    expect(formatRelativeDayPhrase('2026-05-20', '2026-05-21')).toBe('yesterday')
  })

  it('returns "tomorrow" for one day after today', () => {
    expect(formatRelativeDayPhrase('2026-05-22', '2026-05-21')).toBe('tomorrow')
  })

  it('returns "N days ago" for past days', () => {
    expect(formatRelativeDayPhrase('2026-05-18', '2026-05-21')).toBe('3 days ago')
    expect(formatRelativeDayPhrase('2026-04-21', '2026-05-21')).toBe('30 days ago')
  })

  it('returns "in N days" for future days', () => {
    expect(formatRelativeDayPhrase('2026-05-24', '2026-05-21')).toBe('in 3 days')
    expect(formatRelativeDayPhrase('2026-06-20', '2026-05-21')).toBe('in 30 days')
  })

  it('crosses year boundaries naturally', () => {
    expect(formatRelativeDayPhrase('2025-12-31', '2026-01-01')).toBe('yesterday')
    expect(formatRelativeDayPhrase('2025-12-29', '2026-01-01')).toBe('3 days ago')
    expect(formatRelativeDayPhrase('2026-01-01', '2025-12-31')).toBe('tomorrow')
  })

  it('handles the 2024 leap-day → March 1 transition', () => {
    expect(formatRelativeDayPhrase('2024-02-29', '2024-03-01')).toBe('yesterday')
    expect(formatRelativeDayPhrase('2024-02-29', '2024-03-03')).toBe('3 days ago')
  })

  it('returns null when inputs are malformed', () => {
    expect(formatRelativeDayPhrase('', '2026-05-21')).toBeNull()
    expect(formatRelativeDayPhrase('2026-05-21', 'nope')).toBeNull()
  })
})
