import { describe, expect, it } from 'vitest'
import { PHONE_PRESS_MIN_HEIGHT } from '../phonePress'
import { bidWindowClosePress, bidWindowHeadPress } from './bidWindowPhonePress'

describe('the Bid window’s top presses on a phone (punch list #426)', () => {
  it('a desk adds nothing', () => {
    expect(bidWindowHeadPress(false)).toEqual({})
    expect(bidWindowClosePress(false)).toEqual({})
  })

  it('Copy for text and Edit bid stand a fingertip tall', () => {
    expect(bidWindowHeadPress(true)).toEqual({ minHeight: PHONE_PRESS_MIN_HEIGHT, boxSizing: 'border-box' })
  })

  it('the ✕ is a fingertip’s square', () => {
    const s = bidWindowClosePress(true)
    expect(s.minHeight).toBe(PHONE_PRESS_MIN_HEIGHT)
    expect(s.minWidth).toBe(PHONE_PRESS_MIN_HEIGHT)
  })
})
