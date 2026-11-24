import { describe, expect, it } from 'vitest'
import { PHONE_PRESS_MIN_HEIGHT } from './phonePress'
import { TOAST_ACTION_DRAWN_HEIGHT, TOAST_DISMISS_DRAWN, toastActionPress, toastDismissPress } from './toastPress'

describe('a toast’s presses on a phone (punch list #426)', () => {
  it('a desk adds nothing to either press', () => {
    expect(toastActionPress(false)).toEqual({})
    expect(toastDismissPress(false)).toEqual({})
  })

  it('the action stands a fingertip tall, and its margins give back what it grew by', () => {
    const s = toastActionPress(true)
    expect(s.minHeight).toBe(PHONE_PRESS_MIN_HEIGHT)
    const grew = PHONE_PRESS_MIN_HEIGHT - TOAST_ACTION_DRAWN_HEIGHT
    expect(Number(s.marginTop) + Number(s.marginBottom)).toBe(-grew)
    // The toast stays as tall as it was drawn: the press's box less its margins is the old height.
    expect(PHONE_PRESS_MIN_HEIGHT + Number(s.marginTop) + Number(s.marginBottom)).toBe(TOAST_ACTION_DRAWN_HEIGHT)
  })

  it('the × is a fingertip’s square, and takes no more room in the toast than its glyph did', () => {
    const s = toastDismissPress(true)
    expect(s.minHeight).toBe(PHONE_PRESS_MIN_HEIGHT)
    expect(s.minWidth).toBe(PHONE_PRESS_MIN_HEIGHT)
    expect(PHONE_PRESS_MIN_HEIGHT + Number(s.marginLeft) + Number(s.marginRight)).toBe(TOAST_DISMISS_DRAWN.width)
    expect(PHONE_PRESS_MIN_HEIGHT + Number(s.marginTop) + Number(s.marginBottom)).toBe(TOAST_DISMISS_DRAWN.height)
  })

  it('the × grows no further than the gap beside it and the toast’s padding', () => {
    // The toast keeps 1rem between its words, its action and its ×, and 1.5rem of padding at its right edge.
    const reach = -Number(toastDismissPress(true).marginLeft)
    expect(reach).toBeLessThanOrEqual(16)
    expect(reach).toBeLessThanOrEqual(24)
  })
})
