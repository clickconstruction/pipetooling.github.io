import { describe, expect, it } from 'vitest'
import { CONFIRM_PRESS_PHONE_MIN_PX, confirmOpensOn, confirmPressSize } from './confirmDialogPress'

describe('confirmPressSize', () => {
  it('stands 44 px tall at a phone width', () => {
    expect(CONFIRM_PRESS_PHONE_MIN_PX).toBe(44)
    expect(confirmPressSize(true).minHeight).toBe(44)
    expect(confirmPressSize(true).boxSizing).toBe('border-box')
  })
  it('keeps the desk look: the same padding and no floor', () => {
    expect(confirmPressSize(false)).toEqual({ padding: '0.5rem 1rem' })
    expect(confirmPressSize(true).padding).toBe(confirmPressSize(false).padding)
  })
})

describe('confirmOpensOn (finding 339)', () => {
  it('a plain confirm opens on the press that acts, as it always did', () => {
    expect(confirmOpensOn({})).toBe('confirm')
    expect(confirmOpensOn({ danger: false })).toBe('confirm')
    expect(confirmOpensOn({ danger: false, cancelIsSafe: false })).toBe('confirm')
  })
  it('a red confirm opens on Cancel, so Enter does not act', () => {
    expect(confirmOpensOn({ danger: true })).toBe('cancel')
  })
  it('a confirm that asks for Cancel gets it, red or not', () => {
    expect(confirmOpensOn({ cancelIsSafe: true })).toBe('cancel')
    expect(confirmOpensOn({ cancelIsSafe: true, danger: true })).toBe('cancel')
  })
})
