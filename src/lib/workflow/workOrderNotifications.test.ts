import { describe, expect, it } from 'vitest'
import { formatWorkOrderAmount, formatWorkOrderWindow } from './workOrderNotifications'

describe('formatWorkOrderWindow', () => {
  it('formats a full window, open ends, and the empty case', () => {
    expect(formatWorkOrderWindow('2026-08-12', '2026-08-19')).toBe('Aug 12 → Aug 19')
    expect(formatWorkOrderWindow('2026-08-12', null)).toBe('starting Aug 12')
    expect(formatWorkOrderWindow(null, '2026-08-19')).toBe('by Aug 19')
    expect(formatWorkOrderWindow(null, null)).toBe('not set')
  })
})

describe('formatWorkOrderAmount', () => {
  it('formats money with cents and thousands separators', () => {
    expect(formatWorkOrderAmount(6400)).toBe('$6,400.00')
    expect(formatWorkOrderAmount(1234567.5)).toBe('$1,234,567.50')
  })
})
