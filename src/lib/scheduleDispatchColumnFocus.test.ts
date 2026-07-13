import { describe, expect, it } from 'vitest'
import { scheduleColumnCenterScrollDelta } from './scheduleDispatchColumnFocus'

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
