import { describe, expect, it } from 'vitest'
import { AWAY_THRESHOLD_MS, awayMsSince, shouldLandOnDispatch } from './assistantDispatchLanding'

const base = { role: 'assistant', isMobile: true, pathname: '/dashboard', awayMs: AWAY_THRESHOLD_MS }

describe('shouldLandOnDispatch', () => {
  it('redirects a mobile assistant who returned after the away threshold, on the home landing', () => {
    expect(shouldLandOnDispatch(base)).toBe(true)
    expect(shouldLandOnDispatch({ ...base, pathname: '/' })).toBe(true)
  })

  it('does not redirect a non-assistant', () => {
    expect(shouldLandOnDispatch({ ...base, role: 'estimator' })).toBe(false)
    expect(shouldLandOnDispatch({ ...base, role: null })).toBe(false)
  })

  it('does not redirect on desktop', () => {
    expect(shouldLandOnDispatch({ ...base, isMobile: false })).toBe(false)
  })

  it('does not redirect off a non-home page (no yanking mid-task / deep links)', () => {
    expect(shouldLandOnDispatch({ ...base, pathname: '/jobs' })).toBe(false)
    expect(shouldLandOnDispatch({ ...base, pathname: '/schedule-dispatch' })).toBe(false)
  })

  it('does not redirect when the gap is under the threshold', () => {
    expect(shouldLandOnDispatch({ ...base, awayMs: AWAY_THRESHOLD_MS - 1 })).toBe(false)
    expect(shouldLandOnDispatch({ ...base, awayMs: 0 })).toBe(false)
  })
})

describe('awayMsSince', () => {
  it('treats a missing prior timestamp as away (infinite)', () => {
    expect(awayMsSince(null, 1000)).toBe(Number.POSITIVE_INFINITY)
  })

  it('computes elapsed time, clamped at 0', () => {
    expect(awayMsSince(1000, 5000)).toBe(4000)
    expect(awayMsSince(5000, 1000)).toBe(0) // clock skew → not negative
  })
})
