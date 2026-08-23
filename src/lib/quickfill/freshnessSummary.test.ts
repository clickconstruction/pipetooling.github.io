import { describe, expect, it } from 'vitest'
import { freshnessBucket, quickfillFreshnessSummary } from './freshnessSummary'

const NOW = new Date('2026-08-23T18:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString()

describe('freshnessSummary', () => {
  it('buckets by the 12h rule', () => {
    expect(freshnessBucket(hoursAgo(1), NOW)).toBe('fresh')
    expect(freshnessBucket(hoursAgo(13), NOW)).toBe('stale')
    expect(freshnessBucket(null, NOW)).toBe('never')
  })
  it('writes the strip line; personal sections are ignored', () => {
    const s = quickfillFreshnessSummary(
      [
        { sectionId: 'a', markedAt: hoursAgo(2) },
        { sectionId: 'b', markedAt: hoursAgo(30) },
        { sectionId: 'c', markedAt: hoursAgo(80) },
        { sectionId: 'my-inbox', markedAt: null, personal: true },
      ],
      NOW,
    )
    expect(s).toMatchObject({ total: 3, fresh: 1, needLook: 2, oldestDays: 3 })
    expect(s.line).toBe('1 of 3 fresh · 2 need a look · oldest 3d')
  })
  it('names never-marked sections instead of an age', () => {
    expect(quickfillFreshnessSummary([{ sectionId: 'a', markedAt: null }, { sectionId: 'b', markedAt: hoursAgo(1) }], NOW).line).toBe('1 of 2 fresh · 1 needs a look · some never marked')
  })
  it('all fresh reads clean', () => {
    expect(quickfillFreshnessSummary([{ sectionId: 'a', markedAt: hoursAgo(1) }], NOW).line).toBe('1 of 1 fresh')
  })
})
