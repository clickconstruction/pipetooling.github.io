import { describe, expect, it } from 'vitest'
import { formatTimeSinceAgo } from './formatTimeSinceAgo'

const NOW = new Date('2026-08-02T12:00:00Z')
const minus = (ms: number) => new Date(NOW.getTime() - ms).toISOString()

describe('formatTimeSinceAgo', () => {
  it('buckets from "just now" through years with singular/plural forms', () => {
    expect(formatTimeSinceAgo(minus(30_000), NOW)).toBe('just now')
    expect(formatTimeSinceAgo(minus(60_000), NOW)).toBe('1 minute ago')
    expect(formatTimeSinceAgo(minus(5 * 60_000), NOW)).toBe('5 minutes ago')
    expect(formatTimeSinceAgo(minus(3_600_000), NOW)).toBe('1 hour ago')
    expect(formatTimeSinceAgo(minus(26 * 3_600_000), NOW)).toBe('1 day ago')
    expect(formatTimeSinceAgo(minus(8 * 86_400_000), NOW)).toBe('1 week ago')
    expect(formatTimeSinceAgo(minus(35 * 86_400_000), NOW)).toBe('1 month ago')
    expect(formatTimeSinceAgo(minus(13 * 2_592_000_000), NOW)).toBe('1 year ago')
    expect(formatTimeSinceAgo(minus(25 * 2_592_000_000), NOW)).toBe('2 years ago')
  })
})
