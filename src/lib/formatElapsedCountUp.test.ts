import { describe, expect, it } from 'vitest'
import { formatElapsedCountUp, formatWaitingLabelFromCertifiedAt, HUMANIZE_ELAPSED_AFTER_MS } from './formatElapsedCountUp'

const H = 3_600_000
const D = 24 * H

describe('formatElapsedCountUp — default (the queue)', () => {
  it('m:ss under an hour, h:mm:ss under 48 h', () => {
    expect(formatElapsedCountUp(0)).toBe('0:00')
    expect(formatElapsedCountUp(65_000)).toBe('1:05')
    expect(formatElapsedCountUp(H + 2 * 60_000 + 3_000)).toBe('1:02:03')
    expect(formatElapsedCountUp(47 * H + 59 * 60_000 + 59_000)).toBe('47:59:59')
  })

  it('humanizes at exactly 48 h — "2 days", then whole days — never "282:59:39"', () => {
    expect(HUMANIZE_ELAPSED_AFTER_MS).toBe(48 * H)
    expect(formatElapsedCountUp(48 * H)).toBe('2 days')
    expect(formatElapsedCountUp(2 * D + 23 * H)).toBe('2 days')
    expect(formatElapsedCountUp(282 * H + 59 * 60_000 + 39_000)).toBe('11 days')
    expect(formatElapsedCountUp(12 * D)).toBe('12 days')
  })
})

describe('formatElapsedCountUp — liveCountUp (the Collect Payment modal)', () => {
  it('keeps the stopwatch running past 48 h', () => {
    expect(formatElapsedCountUp(48 * H, { liveCountUp: true })).toBe('48:00:00')
    expect(formatElapsedCountUp(282 * H + 59 * 60_000 + 39_000, { liveCountUp: true })).toBe('282:59:39')
    expect(formatElapsedCountUp(65_000, { liveCountUp: true })).toBe('1:05')
  })
})

describe('formatWaitingLabelFromCertifiedAt', () => {
  const now = Date.parse('2026-09-05T15:00:00Z')
  it('— for missing/invalid; otherwise elapsed since certification in the chosen mode', () => {
    expect(formatWaitingLabelFromCertifiedAt(now, null)).toBe('—')
    expect(formatWaitingLabelFromCertifiedAt(now, '')).toBe('—')
    expect(formatWaitingLabelFromCertifiedAt(now, 'garbage')).toBe('—')
    expect(formatWaitingLabelFromCertifiedAt(now, new Date(now - 90_000).toISOString())).toBe('1:30')
    const twelveDaysAgo = new Date(now - 12 * D - 5 * H).toISOString()
    expect(formatWaitingLabelFromCertifiedAt(now, twelveDaysAgo)).toBe('12 days')
    expect(formatWaitingLabelFromCertifiedAt(now, twelveDaysAgo, { liveCountUp: true })).toBe('293:00:00')
  })
  it('a certification in the future clamps to zero rather than going negative', () => {
    expect(formatWaitingLabelFromCertifiedAt(now, new Date(now + 60_000).toISOString())).toBe('0:00')
  })
})
