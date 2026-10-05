import { describe, expect, it } from 'vitest'
import { DOWNLOADING_MIN_MS, remainingHoldMs } from './downloadFeedback'

describe('remainingHoldMs', () => {
  it('holds the rest of the minimum after a quick build, and nothing after a slow one', () => {
    expect(remainingHoldMs(1000, 1200)).toBe(DOWNLOADING_MIN_MS - 200)
    expect(remainingHoldMs(1000, 1000 + DOWNLOADING_MIN_MS)).toBe(0)
    expect(remainingHoldMs(1000, 9000)).toBe(0)
    expect(remainingHoldMs(1000, 1100, 400)).toBe(300)
  })

  it('a clock that ran backwards holds the whole minimum', () => {
    expect(remainingHoldMs(2000, 1000)).toBe(DOWNLOADING_MIN_MS)
    expect(remainingHoldMs(Number.NaN, 1000)).toBe(DOWNLOADING_MIN_MS)
  })
})
