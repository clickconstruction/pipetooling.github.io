import { describe, expect, it } from 'vitest'
import { formatDollarsAsThousandsK } from './format'

describe('formatDollarsAsThousandsK', () => {
  it('rounds large amounts to integer thousands with K', () => {
    expect(formatDollarsAsThousandsK(625073.07)).toBe('$625K')
  })

  it('returns $0 for zero', () => {
    expect(formatDollarsAsThousandsK(0)).toBe('$0')
  })

  it('uses one decimal in thousands when round thousands is 0 but amount is positive', () => {
    expect(formatDollarsAsThousandsK(400)).toBe('$0.4K')
  })

  it('rounds to nearest thousand for mid-range totals', () => {
    expect(formatDollarsAsThousandsK(1500)).toBe('$2K')
  })

  it('preserves sign for negative totals', () => {
    expect(formatDollarsAsThousandsK(-625_000)).toBe('-$625K')
  })

  it('groups thousands in the K figure (e.g. 4.456M dollars)', () => {
    expect(formatDollarsAsThousandsK(4_456_000)).toBe('$4,456K')
  })

  it('groups millions in the K figure', () => {
    expect(formatDollarsAsThousandsK(1_000_000_000)).toBe('$1,000,000K')
  })
})
