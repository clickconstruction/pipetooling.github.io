import { describe, expect, it } from 'vitest'
import { formatMoneyShortK } from './formatMoneyShortK'

describe('formatMoneyShortK', () => {
  it('over 100k: whole thousands with k', () => {
    expect(formatMoneyShortK(151_676.08)).toBe('$151k')
    expect(formatMoneyShortK(131_653.48)).toBe('$131k')
    expect(formatMoneyShortK(100_000)).toBe('$100k')
    expect(formatMoneyShortK(1_234_567)).toBe('$1,234k')
  })

  it('10k to 100k: one decimal with k', () => {
    expect(formatMoneyShortK(64_749.77)).toBe('$64.7k')
    expect(formatMoneyShortK(51_676)).toBe('$51.6k')
    expect(formatMoneyShortK(10_000)).toBe('$10.0k')
    expect(formatMoneyShortK(99_999.99)).toBe('$99.9k')
  })

  it('under 10k: whole dollars', () => {
    expect(formatMoneyShortK(9_820.4)).toBe('$9,820')
    expect(formatMoneyShortK(0)).toBe('$0')
    expect(formatMoneyShortK(999.99)).toBe('$1,000')
  })

  it('truncates thousands instead of rounding up', () => {
    expect(formatMoneyShortK(151_999)).toBe('$151k')
    expect(formatMoneyShortK(64_999)).toBe('$64.9k')
  })

  it('handles negatives and non-finite input', () => {
    expect(formatMoneyShortK(-151_676)).toBe('-$151k')
    expect(formatMoneyShortK(Number.NaN)).toBe('$0')
  })
})
