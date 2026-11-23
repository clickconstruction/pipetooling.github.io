import { describe, expect, it } from 'vitest'
import { CONFIRM_PRESS_PHONE_MIN_PX, confirmPressSize } from './confirmDialogPress'

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
