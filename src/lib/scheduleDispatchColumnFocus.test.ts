import { describe, expect, it } from 'vitest'
import {
  scheduleColumnCenterScrollDelta,
  scheduleDispatchTodayColumnBoxShadow,
  SCHEDULE_DISPATCH_TODAY_OUTLINE_COLOR,
} from './scheduleDispatchColumnFocus'

describe('scheduleColumnCenterScrollDelta', () => {
  it('zero when the column is already centered', () => {
    // root 0..1000 (center 500), column 450..550 (center 500)
    expect(scheduleColumnCenterScrollDelta(0, 1000, 450, 100)).toBe(0)
  })

  it('positive when the column is right of center (scroll right)', () => {
    expect(scheduleColumnCenterScrollDelta(0, 1000, 700, 100)).toBe(250)
  })

  it('negative when the column is left of center (scroll left)', () => {
    expect(scheduleColumnCenterScrollDelta(0, 1000, 100, 100)).toBe(-350)
  })

  it('accounts for a root not at the viewport origin', () => {
    // root 200..1200 (center 700), column 650..750 (center 700)
    expect(scheduleColumnCenterScrollDelta(200, 1000, 650, 100)).toBe(0)
  })
})

describe('scheduleDispatchTodayColumnBoxShadow', () => {
  const c = SCHEDULE_DISPATCH_TODAY_OUTLINE_COLOR

  it('undefined when not today', () => {
    expect(scheduleDispatchTodayColumnBoxShadow(false, { top: true, bottom: true })).toBeUndefined()
  })

  it('left/right rails only for middle body rows', () => {
    expect(scheduleDispatchTodayColumnBoxShadow(true)).toBe(`inset 2px 0 0 ${c}, inset -2px 0 0 ${c}`)
  })

  it('adds the top edge for the header and the bottom edge for the last row', () => {
    expect(scheduleDispatchTodayColumnBoxShadow(true, { top: true })).toContain(`inset 0 2px 0 ${c}`)
    expect(scheduleDispatchTodayColumnBoxShadow(true, { bottom: true })).toContain(`inset 0 -2px 0 ${c}`)
  })
})
