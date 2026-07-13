import { describe, expect, it } from 'vitest'
import { formatBidDueTime } from './formatBidDueTime'

describe('formatBidDueTime', () => {
  it('formats afternoon and morning times', () => {
    expect(formatBidDueTime('14:00')).toBe('2:00 PM')
    expect(formatBidDueTime('09:30')).toBe('9:30 AM')
  })

  it('handles Postgres HH:MM:SS values', () => {
    expect(formatBidDueTime('14:00:00')).toBe('2:00 PM')
  })

  it('handles midnight and noon', () => {
    expect(formatBidDueTime('00:00')).toBe('12:00 AM')
    expect(formatBidDueTime('12:00')).toBe('12:00 PM')
  })

  it('returns empty string for empty or unparseable input', () => {
    expect(formatBidDueTime('')).toBe('')
    expect(formatBidDueTime(null)).toBe('')
    expect(formatBidDueTime(undefined)).toBe('')
    expect(formatBidDueTime('not a time')).toBe('')
    expect(formatBidDueTime('27:00')).toBe('')
  })
})
