import { describe, expect, it } from 'vitest'
import { PIN_LABEL_DARK_INK, PIN_LABEL_DARK_INK_DRAWN, PIN_LABEL_WHITE, pinLabelInk, pinLabelInkHex } from './pinLabelInk'

describe('pinLabelInk', () => {
  it('puts the dark ink on a bright fill: the waiting amber, the pending yellow, the paid green, the grey of a record with no section', () => {
    for (const fill of ['#f59e0b', '#eab308', '#22c55e', '#14b8a6', '#f97316', '#9ca3af', '#3b82f6']) expect(pinLabelInk(fill)).toBe(PIN_LABEL_DARK_INK)
  })

  it('keeps white on a deep fill: the unsent grey, the started green, the lost red, the estimates\' violet', () => {
    for (const fill of ['#6b7280', '#15803d', '#dc2626', '#8b5cf6', '#1e3a8a']) expect(pinLabelInk(fill)).toBe(PIN_LABEL_WHITE)
  })

  it('reads a short hex and any case, and keeps white for a fill that is not a hex', () => {
    expect(pinLabelInk('#FA0')).toBe(PIN_LABEL_DARK_INK)
    expect(pinLabelInk('#F59E0B')).toBe(PIN_LABEL_DARK_INK)
    expect(pinLabelInk('var(--text-link)')).toBe(PIN_LABEL_WHITE)
    expect(pinLabelInk('')).toBe(PIN_LABEL_WHITE)
  })

  it('gives Google\'s canvas the same choice as a hex', () => {
    expect(pinLabelInkHex('#f59e0b')).toBe(PIN_LABEL_DARK_INK_DRAWN)
    expect(pinLabelInkHex('#dc2626')).toBe(PIN_LABEL_WHITE)
  })
})
