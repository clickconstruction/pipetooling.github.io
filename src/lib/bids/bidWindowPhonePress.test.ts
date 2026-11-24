import { describe, expect, it } from 'vitest'
import { PHONE_PRESS_MIN_HEIGHT } from '../phonePress'
import { BID_WINDOW_LINE_DRAWN, bidWindowChipPress, bidWindowClosePress, bidWindowHeadPress, bidWindowLinePress } from './bidWindowPhonePress'

describe('the Bid window’s top presses on a phone (punch list #426)', () => {
  it('a desk adds nothing', () => {
    expect(bidWindowHeadPress(false)).toEqual({})
    expect(bidWindowClosePress(false)).toEqual({})
    expect(bidWindowChipPress(false)).toEqual({})
    expect(bidWindowLinePress(false, BID_WINDOW_LINE_DRAWN.map)).toEqual({})
  })

  it('Copy for text and Edit bid stand a fingertip tall', () => {
    expect(bidWindowHeadPress(true)).toEqual({ minHeight: PHONE_PRESS_MIN_HEIGHT, boxSizing: 'border-box' })
  })

  it('the ✕ is a fingertip’s square', () => {
    const s = bidWindowClosePress(true)
    expect(s.minHeight).toBe(PHONE_PRESS_MIN_HEIGHT)
    expect(s.minWidth).toBe(PHONE_PRESS_MIN_HEIGHT)
  })

  it('a tab chip and a link chip stand a fingertip tall', () => {
    expect(bidWindowChipPress(true)).toEqual({ minHeight: PHONE_PRESS_MIN_HEIGHT, boxSizing: 'border-box' })
  })

  it('a press in a line of words is padded to a fingertip and the margin gives the same back', () => {
    // Show all fields, drawn 18: 13 above and below, and 13 given back each way.
    expect(bidWindowLinePress(true, BID_WINDOW_LINE_DRAWN.showAllFields)).toEqual({ padding: '13px 0', margin: '-13px 0 -13px' })
    // The GC's name, drawn 22. Two lines of it are padded the same, so the second line stays clear.
    expect(bidWindowLinePress(true, BID_WINDOW_LINE_DRAWN.gcName)).toEqual({ padding: '11px 0', margin: '-11px 0 -11px' })
  })

  it('Map is a fingertip wide too', () => {
    expect(bidWindowLinePress(true, BID_WINDOW_LINE_DRAWN.map)).toEqual({ padding: '14px 8.5px', margin: '-14px -8.5px -14px' })
  })

  it('the development’s door keeps the gap it is drawn with above it', () => {
    // Drawn 15 with 4 above: 14.5 of padding, and the top margin is 4 less the 14.5 given back.
    expect(bidWindowLinePress(true, BID_WINDOW_LINE_DRAWN.development)).toEqual({ padding: '14.5px 0', margin: '-10.5px 0 -14.5px' })
  })

  it('every press in a line comes out a fingertip or more, by what it measured', () => {
    for (const drawn of Object.values(BID_WINDOW_LINE_DRAWN)) {
      const up = Number.parseFloat(String(bidWindowLinePress(true, drawn).padding))
      expect(drawn.height + 2 * up).toBe(PHONE_PRESS_MIN_HEIGHT)
    }
  })

  it('a press already a fingertip tall takes nothing', () => {
    expect(bidWindowLinePress(true, { height: 48 })).toEqual({ padding: '0 0', margin: '0 0 0' })
  })
})
