import { describe, expect, it } from 'vitest'
import { isUnpricedFixture, summarizeUnpricedFixtures, unpricedFixturesChipLabel, type UnpricedFixtureRow } from './unpricedFixtures'

const NOW = Date.parse('2026-10-26T17:00:00Z')
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()
const row = (job_id: string, created_at: string | null, over: Partial<UnpricedFixtureRow> = {}): UnpricedFixtureRow => ({
  job_id,
  part_id: null,
  fixture_cost: null,
  created_at,
  ...over,
})

describe('isUnpricedFixture', () => {
  it('no part and no cost of its own, or a cost of zero', () => {
    expect(isUnpricedFixture({ part_id: null, fixture_cost: null })).toBe(true)
    expect(isUnpricedFixture({ part_id: null, fixture_cost: 0 })).toBe(true)
    expect(isUnpricedFixture({ part_id: null, fixture_cost: 42 })).toBe(false)
    expect(isUnpricedFixture({ part_id: 'p1', fixture_cost: null })).toBe(false)
  })
})

describe('summarizeUnpricedFixtures (punch list #184 sweep B)', () => {
  it('counts the jobs once each and ages the oldest unpriced fixture: amber at 3 days, red at 7', () => {
    const rows = [
      row('j1', daysAgo(1)),
      row('j1', daysAgo(4)),
      row('j2', daysAgo(2)),
      row('j3', daysAgo(30), { part_id: 'p9' }),
      row('j4', daysAgo(40), { fixture_cost: 120 }),
    ]
    const s = summarizeUnpricedFixtures(rows, NOW)
    expect(s.jobCount).toBe(2)
    expect(s.oldestCreatedAt).toBe(daysAgo(4))
    expect(s.oldestAge).toEqual({ days: 4, state: 'amber', label: '4 days waiting' })
    expect(summarizeUnpricedFixtures([row('j1', daysAgo(7))], NOW).oldestAge).toEqual({ days: 7, state: 'red', label: '7 days waiting' })
    expect(summarizeUnpricedFixtures([row('j1', daysAgo(0))], NOW).oldestAge).toEqual({ days: 0, state: 'fresh', label: 'today' })
  })

  it('an unstamped fixture still counts its job but never sets the age; nothing unpriced is a zero with no chip', () => {
    expect(summarizeUnpricedFixtures([row('j1', null), row('j2', 'garbage')], NOW)).toEqual({ jobCount: 2, oldestCreatedAt: null, oldestAge: null })
    expect(summarizeUnpricedFixtures([], NOW)).toEqual({ jobCount: 0, oldestCreatedAt: null, oldestAge: null })
    expect(summarizeUnpricedFixtures([row('j1', daysAgo(9), { part_id: 'p1' })], NOW)).toEqual({ jobCount: 0, oldestCreatedAt: null, oldestAge: null })
  })
})

describe('unpricedFixturesChipLabel', () => {
  it('names the oldest, or says they are all from today', () => {
    expect(unpricedFixturesChipLabel({ days: 12, state: 'red', label: '12 days waiting' })).toBe('oldest 12 days waiting')
    expect(unpricedFixturesChipLabel({ days: 1, state: 'fresh', label: '1 day waiting' })).toBe('oldest 1 day waiting')
    expect(unpricedFixturesChipLabel({ days: 0, state: 'fresh', label: 'today' })).toBe('tallied today')
  })
})
