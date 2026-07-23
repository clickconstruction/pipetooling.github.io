import { describe, expect, it } from 'vitest'
import { isOnScreenKeyboardOccluding, KEYBOARD_OCCLUSION_MIN_PX } from './onScreenKeyboardOcclusion'

describe('isOnScreenKeyboardOccluding', () => {
  it('is false without a visual viewport (older browsers / SSR)', () => {
    expect(isOnScreenKeyboardOccluding(800, null, null)).toBe(false)
    expect(isOnScreenKeyboardOccluding(800, undefined, undefined)).toBe(false)
  })

  it('is false when the visual viewport matches the window (no keyboard)', () => {
    expect(isOnScreenKeyboardOccluding(800, 800, 1)).toBe(false)
  })

  it('is true when the keyboard shrinks the visual viewport past the threshold', () => {
    // iPhone-ish: 800px window, keyboard leaves 450px visible
    expect(isOnScreenKeyboardOccluding(800, 450, 1)).toBe(true)
  })

  it('ignores small deltas from browser chrome / rounding', () => {
    expect(isOnScreenKeyboardOccluding(800, 800 - (KEYBOARD_OCCLUSION_MIN_PX - 1), 1)).toBe(false)
  })

  it('triggers exactly at the threshold', () => {
    expect(isOnScreenKeyboardOccluding(800, 800 - KEYBOARD_OCCLUSION_MIN_PX, 1)).toBe(true)
  })

  it('does not mistake pinch-zoom for the keyboard (height shrinks, scale rises)', () => {
    // Zoomed 2x: visual viewport height halves but layout-space coverage is unchanged
    expect(isOnScreenKeyboardOccluding(800, 400, 2)).toBe(false)
    // Zoomed 2x WITH the keyboard open still detects it
    expect(isOnScreenKeyboardOccluding(800, 225, 2)).toBe(true)
  })

  it('treats a missing or invalid scale as 1', () => {
    expect(isOnScreenKeyboardOccluding(800, 450, null)).toBe(true)
    expect(isOnScreenKeyboardOccluding(800, 450, 0)).toBe(true)
    expect(isOnScreenKeyboardOccluding(800, 450, Number.NaN)).toBe(true)
  })

  it('is false for degenerate window heights', () => {
    expect(isOnScreenKeyboardOccluding(0, 450, 1)).toBe(false)
    expect(isOnScreenKeyboardOccluding(Number.NaN, 450, 1)).toBe(false)
  })
})
