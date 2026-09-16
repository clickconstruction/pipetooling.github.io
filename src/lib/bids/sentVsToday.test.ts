import { describe, expect, it } from 'vitest'
import { compareSentVsToday, formatSentOn, formatSignedDelta, sentVsTodayText } from './sentVsToday'

describe('compareSentVsToday', () => {
  it('is null on an unsent bid, a bid with no sent value, or before the live number exists', () => {
    expect(compareSentVsToday({ bidDateSent: null, bidValue: 100, today: 100 })).toBeNull()
    expect(compareSentVsToday({ bidDateSent: '2026-07-01', bidValue: null, today: 100 })).toBeNull()
    expect(compareSentVsToday({ bidDateSent: '2026-07-01', bidValue: 0, today: 100 })).toBeNull()
    expect(compareSentVsToday({ bidDateSent: '2026-07-01', bidValue: 100, today: null })).toBeNull()
    expect(compareSentVsToday({ bidDateSent: '2026-07-01', bidValue: 100, today: Number.NaN })).toBeNull()
  })

  it('reads BP315: sent Jul 1 at $379,895.70, the grid at $385,506.07 today', () => {
    const r = compareSentVsToday({ bidDateSent: '2026-07-01', bidValue: 379895.7, today: 385506.07 })
    expect(r?.kind).toBe('differs')
    expect(r && r.kind === 'differs' ? r.delta : null).toBeCloseTo(5610.37, 2)
    expect(sentVsTodayText(r!, { where: 'grid', currentYear: 2026 })).toBe(
      'Sent Jul 1 at $379,895.70 · the book prices it at $385,506.07 today (+$5,610.37)',
    )
  })

  it('agrees within a cent — rounding is not drift', () => {
    const r = compareSentVsToday({ bidDateSent: '2026-09-08', bidValue: 45000.004, today: 45000.0 })
    expect(r?.kind).toBe('agrees')
    expect(sentVsTodayText(r!, { where: 'grid', currentYear: 2026 })).toBe('Sent Sep 8 at $45,000.00 · the book still prices it there')
    expect(sentVsTodayText(r!, { where: 'letter', currentYear: 2026 })).toBe('Sent Sep 8 at $45,000.00 · the letter still says so')
  })

  it('a cent and a half is a difference', () => {
    expect(compareSentVsToday({ bidDateSent: '2026-09-08', bidValue: 100, today: 100.015 })?.kind).toBe('differs')
  })

  it('a lower number reads with a minus, and the letter wording names the letter', () => {
    const r = compareSentVsToday({ bidDateSent: '2026-04-17', bidValue: 40560.05, today: 37780.59 })
    expect(sentVsTodayText(r!, { where: 'letter', currentYear: 2026 })).toBe(
      'Sent Apr 17 at $40,560.05 · the letter would say $37,780.59 today (−$2,779.46)',
    )
  })
})

describe('formatSentOn', () => {
  it('drops the year only when it is the current year', () => {
    expect(formatSentOn('2026-07-01', 2026)).toBe('Jul 1')
    expect(formatSentOn('2025-09-22', 2026)).toBe('Sep 22, 2025')
  })
})

describe('formatSignedDelta', () => {
  it('signs and formats', () => {
    expect(formatSignedDelta(5610.37)).toBe('+$5,610.37')
    expect(formatSignedDelta(-2779.46)).toBe('−$2,779.46')
    expect(formatSignedDelta(0)).toBe('+$0.00')
  })
})
