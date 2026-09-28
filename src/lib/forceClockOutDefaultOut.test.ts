import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultClockOutLocal, forceClockOutDefaultOutIso } from './forceClockOutDefaultOut'

/** 2026-01-05, Central standard time: 12:05:40 PM wall is 18:05:40 UTC. */
const NOW = '2026-01-05T18:05:40.000Z'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('defaultClockOutLocal', () => {
  it('is now on the Central wall clock, to the minute', () => {
    expect(defaultClockOutLocal('2026-01-05T14:00:00.000Z')).toBe('2026-01-05T12:05')
  })

  it('is one minute after clock-in when that is later than now', () => {
    expect(defaultClockOutLocal('2026-01-05T18:05:10.000Z')).toBe('2026-01-05T12:06')
  })
})

describe('forceClockOutDefaultOutIso', () => {
  it('a session open for hours closes at the start of the current minute', () => {
    expect(forceClockOutDefaultOutIso('2026-01-05T14:00:00.000Z')).toBe('2026-01-05T18:05:00.000Z')
  })

  it('never closes after now: a session under a minute old closes at now', () => {
    expect(forceClockOutDefaultOutIso('2026-01-05T18:05:10.000Z')).toBe(NOW)
  })

  it('a clock-in late in the minute before closes at the start of this one', () => {
    expect(forceClockOutDefaultOutIso('2026-01-05T18:04:50.000Z')).toBe('2026-01-05T18:05:00.000Z')
  })

  it('a clock-in ahead of now closes at now — never past it, though that is before clock-in', () => {
    expect(forceClockOutDefaultOutIso('2026-01-05T18:10:00.000Z')).toBe(NOW)
  })

  it('throws on a clock-in it cannot read', () => {
    expect(() => forceClockOutDefaultOutIso('not a date')).toThrow(RangeError)
  })
})
