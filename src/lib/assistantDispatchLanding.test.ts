import { describe, expect, it } from 'vitest'
import {
  AWAY_THRESHOLD_MS,
  DISPATCH_MODE_AWAY_THRESHOLD_MS,
  DISPATCH_MODE_SCHEDULE_PATH,
  DISPATCH_PATH,
  awayMsSince,
  awayThresholdMs,
  isHomePath,
  landingPath,
  resolveAssistantLanding,
  shouldLandOnDispatch,
} from './assistantDispatchLanding'

const base = { role: 'assistant', isMobile: true, pathname: '/dashboard', awayMs: AWAY_THRESHOLD_MS, dispatchMode: false }
const dispatchOn = { ...base, dispatchMode: true, awayMs: DISPATCH_MODE_AWAY_THRESHOLD_MS }

describe('shouldLandOnDispatch — Dispatch Mode off (1 hour, phones only)', () => {
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

  it('five minutes is not enough with Dispatch Mode off', () => {
    expect(shouldLandOnDispatch({ ...base, awayMs: DISPATCH_MODE_AWAY_THRESHOLD_MS })).toBe(false)
  })
})

describe('shouldLandOnDispatch — Dispatch Mode on (5 minutes, any viewport)', () => {
  it('redirects after five minutes from the home landing', () => {
    expect(shouldLandOnDispatch(dispatchOn)).toBe(true)
    expect(shouldLandOnDispatch({ ...dispatchOn, pathname: '/' })).toBe(true)
    expect(shouldLandOnDispatch({ ...dispatchOn, awayMs: Number.POSITIVE_INFINITY })).toBe(true)
  })

  it('under five minutes → not a return', () => {
    expect(shouldLandOnDispatch({ ...dispatchOn, awayMs: DISPATCH_MODE_AWAY_THRESHOLD_MS - 1 })).toBe(false)
    expect(shouldLandOnDispatch({ ...dispatchOn, awayMs: 1000 })).toBe(false)
  })

  it('the home-path guard applies here too — a cold deep link is left alone (punch list #30, bug 1)', () => {
    expect(shouldLandOnDispatch({ ...dispatchOn, pathname: '/jobs' })).toBe(false)
    expect(shouldLandOnDispatch({ ...dispatchOn, pathname: '/dispatch-mode/inbox' })).toBe(false)
    expect(shouldLandOnDispatch({ ...dispatchOn, pathname: '/dispatch-mode/schedule' })).toBe(false)
    expect(shouldLandOnDispatch({ ...dispatchOn, pathname: '/jobs', awayMs: Number.POSITIVE_INFINITY })).toBe(false)
  })

  it('fires on desktop as well — the person opted into the dispatch shell', () => {
    expect(shouldLandOnDispatch({ ...dispatchOn, isMobile: false })).toBe(true)
  })

  it('still assistant-only', () => {
    expect(shouldLandOnDispatch({ ...dispatchOn, role: 'master_technician' })).toBe(false)
    expect(shouldLandOnDispatch({ ...dispatchOn, role: 'dev' })).toBe(false)
  })
})

describe('resolveAssistantLanding / landingPath / awayThresholdMs', () => {
  it('Dispatch Mode on lands on the Schedule tab after five minutes', () => {
    expect(landingPath(true)).toBe(DISPATCH_MODE_SCHEDULE_PATH)
    expect(awayThresholdMs(true)).toBe(DISPATCH_MODE_AWAY_THRESHOLD_MS)
    expect(resolveAssistantLanding(dispatchOn)).toBe('/dispatch-mode/schedule')
  })

  it('Dispatch Mode off lands on Schedule Dispatch after an hour', () => {
    expect(landingPath(false)).toBe(DISPATCH_PATH)
    expect(awayThresholdMs(false)).toBe(AWAY_THRESHOLD_MS)
    expect(resolveAssistantLanding(base)).toBe('/schedule-dispatch')
  })

  it('returns null when the rule does not fire', () => {
    expect(resolveAssistantLanding({ ...dispatchOn, pathname: '/jobs' })).toBeNull()
    expect(resolveAssistantLanding({ ...base, awayMs: 0 })).toBeNull()
  })
})

describe('isHomePath', () => {
  it('only the root and the dashboard count as home', () => {
    expect(isHomePath('/')).toBe(true)
    expect(isHomePath('/dashboard')).toBe(true)
    expect(isHomePath('/dashboard/')).toBe(false)
    expect(isHomePath('/jobs')).toBe(false)
    expect(isHomePath('/dispatch-mode')).toBe(false)
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
