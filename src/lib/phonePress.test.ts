import { describe, expect, it } from 'vitest'
import { PHONE_PILL_MIN_HEIGHT, PHONE_PRESS_MIN_HEIGHT, activityPillStyle } from './phonePress'

describe('phonePress', () => {
  it('holds the two heights the walk asked for', () => {
    expect(PHONE_PRESS_MIN_HEIGHT).toBe(44)
    expect(PHONE_PILL_MIN_HEIGHT).toBe(32)
  })

  it('grows the activity pills to 32 px on a phone and leaves the office chip alone', () => {
    expect(activityPillStyle(true).minHeight).toBe(32)
    expect(activityPillStyle(true).fontSize).toBe('0.75rem')
    expect(activityPillStyle(false).minHeight).toBeUndefined()
    expect(activityPillStyle(false).padding).toBe('0.15rem 0.5rem')
  })
})
