import { describe, expect, it } from 'vitest'
import { bidOutcomeDotColor } from './bidOutcomeDotColor'

describe('bidOutcomeDotColor', () => {
  it('won is green', () => {
    expect(bidOutcomeDotColor('won')).toBe('#22c55e')
  })
  it('lost is red', () => {
    expect(bidOutcomeDotColor('lost')).toBe('#ef4444')
  })
  it('started_or_complete is teal', () => {
    expect(bidOutcomeDotColor('started_or_complete')).toBe('#14b8a6')
  })
  it('pending (null/undefined/unknown) is neutral', () => {
    expect(bidOutcomeDotColor(null)).toBe('#9ca3af')
    expect(bidOutcomeDotColor(undefined)).toBe('#9ca3af')
    expect(bidOutcomeDotColor('mystery')).toBe('#9ca3af')
  })
  it('trims and lowercases', () => {
    expect(bidOutcomeDotColor(' Won ')).toBe('#22c55e')
  })
})
