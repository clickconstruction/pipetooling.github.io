import { describe, expect, it } from 'vitest'
import { stepperKeeps, stepperTyped } from './stepperInput'

describe('the number sheet’s field as it is typed in (v2.7252)', () => {
  it('reads no number from an empty field, so clearing it does not put the 1 back', () => {
    expect(stepperTyped('', 40)).toBeNull()
    expect(stepperTyped('  ', 40)).toBeNull()
    expect(stepperTyped('-', 40)).toBeNull()
    // The field keeps what is typed, the empty field included.
    expect(stepperKeeps('', 40)).toBe('')
    expect(stepperKeeps('2', 40)).toBe('2')
    expect(stepperKeeps('25', 40)).toBe('25')
  })
  it('holds a typed number to 1 and the most the box has, and shows the number it was held to', () => {
    expect(stepperTyped('25', 40)).toBe(25)
    expect(stepperTyped('50', 40)).toBe(40)
    expect(stepperTyped('0', 40)).toBe(1)
    expect(stepperTyped('2.6', 40)).toBe(3)
    expect(stepperTyped('7', 0)).toBe(1)
    // Out of range, the text is not kept: the field shows the number.
    expect(stepperKeeps('50', 40)).toBeNull()
    expect(stepperKeeps('0', 40)).toBeNull()
  })
})
