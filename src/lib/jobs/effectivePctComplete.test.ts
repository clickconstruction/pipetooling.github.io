import { describe, expect, it } from 'vitest'
import { effectivePctComplete } from './effectivePctComplete'

describe('effectivePctComplete', () => {
  it('null/undefined pct falls back to 0, or 100 when Paid in Full', () => {
    expect(effectivePctComplete(null, 'working')).toBe(0)
    expect(effectivePctComplete(undefined, 'ready_to_bill')).toBe(0)
    expect(effectivePctComplete(null, null)).toBe(0)
    expect(effectivePctComplete(null, 'paid')).toBe(100)
  })

  it('a recorded pct always wins, including 0 and on paid jobs', () => {
    expect(effectivePctComplete(62, 'working')).toBe(62)
    expect(effectivePctComplete(0, 'working')).toBe(0)
    expect(effectivePctComplete(90, 'paid')).toBe(90)
  })

  it('non-finite recorded values fall back too', () => {
    expect(effectivePctComplete(Number.NaN, 'paid')).toBe(100)
  })
})
