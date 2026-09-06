import { describe, expect, it } from 'vitest'
import { approxHoursLabel } from './approxHoursLabel'

describe('approxHoursLabel', () => {
  it('rounds raw floats to one decimal and marks the rounding', () => {
    expect(approxHoursLabel(22.773756)).toBe('≈ 22.8 hrs')
    expect(approxHoursLabel(1.25)).toBe('≈ 1.3 hrs')
    expect(approxHoursLabel(7.96)).toBe('≈ 8 hrs')
  })
  it('prints exact values without the ≈', () => {
    expect(approxHoursLabel(8)).toBe('8 hrs')
    expect(approxHoursLabel(2.5)).toBe('2.5 hrs')
  })
  it('handles zero, tiny, negative and non-finite input', () => {
    expect(approxHoursLabel(0)).toBe('0 hrs')
    expect(approxHoursLabel(0.02)).toBe('< 0.1 hrs')
    expect(approxHoursLabel(-3)).toBe('0 hrs')
    expect(approxHoursLabel(Number.NaN)).toBe('0 hrs')
  })
})
