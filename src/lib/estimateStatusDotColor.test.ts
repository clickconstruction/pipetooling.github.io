import { describe, expect, it } from 'vitest'
import { estimateStatusDotColor } from './estimateStatusDotColor'

describe('estimateStatusDotColor', () => {
  it('draft is neutral', () => {
    expect(estimateStatusDotColor('draft')).toBe('#9ca3af')
  })
  it('sent is blue', () => {
    expect(estimateStatusDotColor('sent')).toBe('#3b82f6')
  })
  it('customer_accepted is green', () => {
    expect(estimateStatusDotColor('customer_accepted')).toBe('#22c55e')
  })
  it('declined is red', () => {
    expect(estimateStatusDotColor('declined')).toBe('#ef4444')
  })
  it('superseded is neutral', () => {
    expect(estimateStatusDotColor('superseded')).toBe('#9ca3af')
  })
  it('unknown, null, and undefined fall back to neutral', () => {
    expect(estimateStatusDotColor('bogus')).toBe('#9ca3af')
    expect(estimateStatusDotColor(null)).toBe('#9ca3af')
    expect(estimateStatusDotColor(undefined)).toBe('#9ca3af')
  })
  it('trims and lowercases', () => {
    expect(estimateStatusDotColor(' Sent ')).toBe('#3b82f6')
  })
})
