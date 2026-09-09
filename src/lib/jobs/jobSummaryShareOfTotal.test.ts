import { describe, expect, it } from 'vitest'
import { shareOfTotalLabel } from './jobSummaryShareOfTotal'

describe('shareOfTotalLabel', () => {
  it('rounds a row total to a whole share of the grand total', () => {
    expect(shareOfTotalLabel(3292.6, 6176.38)).toBe('53%')
    expect(shareOfTotalLabel(1340.35, 6176.38)).toBe('22%')
    expect(shareOfTotalLabel(6176.38, 6176.38)).toBe('100%')
  })
  it('says "<1%" for a real but tiny share instead of "0%"', () => {
    expect(shareOfTotalLabel(10, 6176.38)).toBe('<1%')
    expect(shareOfTotalLabel(35.51, 6176.38)).toBe('1%')
  })
  it('is null when there is nothing to divide by or nothing in the row', () => {
    expect(shareOfTotalLabel(100, 0)).toBeNull()
    expect(shareOfTotalLabel(100, null)).toBeNull()
    expect(shareOfTotalLabel(null, 100)).toBeNull()
    expect(shareOfTotalLabel(0, 100)).toBeNull()
    expect(shareOfTotalLabel(-5, 100)).toBeNull()
    expect(shareOfTotalLabel(100, Number.NaN)).toBeNull()
  })
})
