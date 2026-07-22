import { describe, expect, it } from 'vitest'
import {
  DISPATCH_MODE_AWAY_MS,
  isDispatchModeReturnAfterAway,
} from './dispatchModeReturnFocus'

describe('isDispatchModeReturnAfterAway', () => {
  const now = 10_000_000

  it('no stamp → treated as away (fresh device/session)', () => {
    expect(isDispatchModeReturnAfterAway(null, now)).toBe(true)
  })

  it('under five minutes → not away', () => {
    expect(isDispatchModeReturnAfterAway(now - DISPATCH_MODE_AWAY_MS + 1, now)).toBe(false)
    expect(isDispatchModeReturnAfterAway(now - 1000, now)).toBe(false)
  })

  it('at or beyond five minutes → away', () => {
    expect(isDispatchModeReturnAfterAway(now - DISPATCH_MODE_AWAY_MS, now)).toBe(true)
    expect(isDispatchModeReturnAfterAway(now - DISPATCH_MODE_AWAY_MS * 3, now)).toBe(true)
  })

  it('custom threshold', () => {
    expect(isDispatchModeReturnAfterAway(now - 2000, now, 1000)).toBe(true)
  })
})
