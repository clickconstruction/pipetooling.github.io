import { describe, expect, it } from 'vitest'
import { PHONE_PRESS_MIN_HEIGHT } from '../../lib/phonePress'
import { THUMB, chipStyle, linePress, phoneButton } from './billsSentLook'

describe('billsSentLook — a press on a phone stands a fingertip tall', () => {
  it('takes its height from the app’s one source', () => {
    expect(THUMB).toBe(PHONE_PRESS_MIN_HEIGHT)
    expect(THUMB).toBe(44)
    expect(phoneButton.minHeight).toBe(44)
  })
  it('draws a chip 44 px tall on a phone, pressed or not, and as the office’s small chip at a desk', () => {
    // The live test of 2026-11-24 measured the chips of both views at 38 px on a phone.
    expect(chipStyle(false, true).minHeight).toBe(44)
    expect(chipStyle(true, true).minHeight).toBe(44)
    expect(chipStyle(false, true).whiteSpace).toBe('nowrap')
    expect(chipStyle(false).minHeight).toBeUndefined()
    expect(chipStyle(true, false).minHeight).toBeUndefined()
  })
  it('gives a name or a word that is a press its own 44 px on a phone, and nothing at a desk', () => {
    // A bill's name and a job's name in By day paid's day box were text links 16 px tall.
    expect(linePress(true)).toEqual({ display: 'inline-flex', alignItems: 'center', minHeight: 44 })
    expect(linePress(false)).toEqual({})
  })
})
