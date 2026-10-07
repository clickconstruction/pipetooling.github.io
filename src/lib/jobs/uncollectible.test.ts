import { describe, expect, it } from 'vitest'
import { uncollectibleDayWords, uncollectibleFactsFor, uncollectiblePhoneLine, uncollectibleStampLine, uncollectibleStampLines } from './uncollectible'
import type { JobWithDetails } from '../../types/jobWithDetails'

const job = (o: Record<string, unknown>): JobWithDetails =>
  ({ id: 'j1', status: 'billed', revenue: 7502, payments_made: 0, collections_at: '2026-04-13T00:00:00Z', ...o }) as unknown as JobWithDetails

describe('uncollectibleFactsFor — what the stamp prints (punch list #94, v2.4792)', () => {
  it('reads the day on the company calendar, the trimmed reason and the open balance', () => {
    const f = uncollectibleFactsFor(job({ uncollectible_at: '2026-10-07T03:30:00Z', uncollectible_reason: '  Customer is engaging in theft of service.  ', payments_made: 2 }))
    expect(f).toEqual({ markedYmd: '2026-10-06', reason: 'Customer is engaging in theft of service.', open: 7500 })
  })

  it('is null off a marked Collections job, so no row wears an empty stamp', () => {
    expect(uncollectibleFactsFor(job({}))).toBeNull()
    expect(uncollectibleFactsFor(job({ uncollectible_at: '2026-10-07T03:30:00Z', collections_at: null }))).toBeNull()
    expect(uncollectibleFactsFor(job({ uncollectible_at: '2026-10-07T03:30:00Z', status: 'paid' }))).toBeNull()
  })

  it('an empty reason still reads as words, never a blank line', () => {
    expect(uncollectibleFactsFor(job({ uncollectible_at: '2026-10-07T03:30:00Z', uncollectible_reason: '   ' }))?.reason).toBe('No reason recorded.')
  })
})

describe('the stamp\'s and the phone card\'s words', () => {
  it('day, dollars, and the reason in quotes', () => {
    expect(uncollectibleDayWords('2026-10-06')).toBe('Oct 6, 2026')
    expect(uncollectibleStampLine({ markedYmd: '2026-10-06', open: 7502 })).toBe('Oct 6, 2026 · $7,502 given up on')
    expect(uncollectibleStampLine({ markedYmd: '', open: 250 })).toBe('date unknown · $250 given up on')
    // v2.4819: the stamp draws them as two lines.
    expect(uncollectibleStampLines({ markedYmd: '2026-10-07', open: 350 })).toEqual({ day: 'Oct 7, 2026', dollars: '$350 given up on' })
    expect(uncollectiblePhoneLine({ markedYmd: '2026-10-06', reason: 'No response in 7 months.' })).toBe('\u201cNo response in 7 months.\u201d \u2014 Oct 6, 2026')
    expect(uncollectiblePhoneLine({ markedYmd: '', reason: 'No response.' })).toBe('\u201cNo response.\u201d')
  })
})
