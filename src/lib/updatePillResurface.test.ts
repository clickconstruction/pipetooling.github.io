import { describe, expect, it } from 'vitest'
import { shouldResurfaceUpdatePill, UPDATE_PILL_RESURFACE_MIN_GAP_MS } from './updatePillResurface'

const GAP = UPDATE_PILL_RESURFACE_MIN_GAP_MS

describe('shouldResurfaceUpdatePill', () => {
  it('never fires without a waiting update', () => {
    expect(shouldResurfaceUpdatePill({ updateWaiting: false, dismissedAtMs: 0, nowMs: GAP * 2 })).toBe(false)
  })
  it('never fires if the pill was never dismissed (it is already visible)', () => {
    expect(shouldResurfaceUpdatePill({ updateWaiting: true, dismissedAtMs: null, nowMs: GAP * 2 })).toBe(false)
  })
  it('stays quiet inside the throttle gap, fires after it', () => {
    expect(shouldResurfaceUpdatePill({ updateWaiting: true, dismissedAtMs: 0, nowMs: GAP - 1 })).toBe(false)
    expect(shouldResurfaceUpdatePill({ updateWaiting: true, dismissedAtMs: 0, nowMs: GAP })).toBe(true)
  })
  it('honors a custom gap', () => {
    expect(shouldResurfaceUpdatePill({ updateWaiting: true, dismissedAtMs: 0, nowMs: 500, minGapMs: 1000 })).toBe(false)
    expect(shouldResurfaceUpdatePill({ updateWaiting: true, dismissedAtMs: 0, nowMs: 1000, minGapMs: 1000 })).toBe(true)
  })
})
