import { describe, expect, it } from 'vitest'
import { hasInAppHistory } from './inAppHistory'

describe('hasInAppHistory', () => {
  it('an in-app entry behind us → true (router idx > 0)', () => {
    expect(hasInAppHistory({ usr: null, key: 'abc', idx: 3 }, 'abc')).toBe(true)
    expect(hasInAppHistory({ idx: 1 }, undefined)).toBe(true)
  })

  it('a cold open → false (idx 0, or the router default key)', () => {
    expect(hasInAppHistory({ usr: null, key: 'default', idx: 0 }, 'default')).toBe(false)
    expect(hasInAppHistory(null, 'default')).toBe(false)
    expect(hasInAppHistory(undefined, undefined)).toBe(false)
    expect(hasInAppHistory(null, '')).toBe(false)
  })

  it('falls back to the location key when the state carries no idx', () => {
    expect(hasInAppHistory(null, 'k9x2')).toBe(true)
    expect(hasInAppHistory({ something: 'else' }, 'k9x2')).toBe(true)
    expect(hasInAppHistory({ idx: 'not a number' }, 'default')).toBe(false)
  })
})
