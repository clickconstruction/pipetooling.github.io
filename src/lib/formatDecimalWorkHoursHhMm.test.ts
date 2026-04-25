import { describe, expect, it } from 'vitest'
import { formatDecimalWorkHoursToHhMm } from './formatDecimalWorkHoursHhMm'

describe('formatDecimalWorkHoursToHhMm', () => {
  it('8.25 to 8h 15m', () => {
    expect(formatDecimalWorkHoursToHhMm(8.25)).toBe('8h 15m')
  })

  it('sub-hour minutes only', () => {
    expect(formatDecimalWorkHoursToHhMm(0.5)).toBe('30m')
  })

  it('zero and invalid return em dash', () => {
    expect(formatDecimalWorkHoursToHhMm(0)).toBe('—')
    expect(formatDecimalWorkHoursToHhMm(-1)).toBe('—')
    expect(formatDecimalWorkHoursToHhMm(Number.NaN)).toBe('—')
  })

  it('whole hours', () => {
    expect(formatDecimalWorkHoursToHhMm(8)).toBe('8h 0m')
  })
})
