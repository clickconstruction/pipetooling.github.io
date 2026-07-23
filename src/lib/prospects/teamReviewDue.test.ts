import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TEAM_REVIEW_CADENCE_DAYS,
  overdueReviewSubjects,
  parseTeamReviewCadenceDays,
} from './teamReviewDue'
import type { MyReviewStamp } from './teamReviewDue'
import type { RatableUser } from './teamMemberReviews'

const NOW = new Date('2026-07-22T12:00:00Z')

const roster: RatableUser[] = [
  { id: 'me', name: 'Me', role: 'dev' },
  { id: 'fresh', name: 'Fresh', role: 'helpers' },
  { id: 'stale', name: 'Stale', role: 'helpers' },
  { id: 'never', name: 'Never', role: 'helpers' },
]

const stamp = (subject: string, updated_at: string | null, review_month = '2026-07-01'): MyReviewStamp => ({
  subject_user_id: subject,
  review_month,
  updated_at,
})

describe('parseTeamReviewCadenceDays', () => {
  it('accepts positive whole days, floors fractions, defaults otherwise', () => {
    expect(parseTeamReviewCadenceDays(45)).toBe(45)
    expect(parseTeamReviewCadenceDays(14.9)).toBe(14)
    expect(parseTeamReviewCadenceDays(null)).toBe(DEFAULT_TEAM_REVIEW_CADENCE_DAYS)
    expect(parseTeamReviewCadenceDays(0)).toBe(DEFAULT_TEAM_REVIEW_CADENCE_DAYS)
    expect(parseTeamReviewCadenceDays(-5)).toBe(DEFAULT_TEAM_REVIEW_CADENCE_DAYS)
    expect(parseTeamReviewCadenceDays(Number.NaN)).toBe(DEFAULT_TEAM_REVIEW_CADENCE_DAYS)
  })
})

describe('overdueReviewSubjects', () => {
  it('flags never-reviewed and stale subjects, excludes self and fresh ones, keeps roster order', () => {
    const stamps = [
      stamp('fresh', '2026-07-10T00:00:00Z'), // 12 days ago — fine at 30
      stamp('stale', '2026-06-01T00:00:00Z', '2026-06-01'), // 51 days ago — overdue
    ]
    const overdue = overdueReviewSubjects(roster, stamps, 'me', 30, NOW)
    expect(overdue.map((u) => u.id)).toEqual(['stale', 'never'])
  })

  it('uses the NEWEST stamp per subject (an old month plus a fresh save is fine)', () => {
    const stamps = [
      stamp('stale', '2026-01-15T00:00:00Z', '2026-01-01'),
      stamp('stale', '2026-07-20T00:00:00Z'),
    ]
    const overdue = overdueReviewSubjects(roster, stamps, 'me', 30, NOW)
    expect(overdue.map((u) => u.id)).toEqual(['fresh', 'never'])
  })

  it('falls back to review_month when updated_at is missing', () => {
    const stamps = [stamp('fresh', null, '2026-07-01')] // 21 days ago via month fallback
    expect(overdueReviewSubjects(roster, stamps, 'me', 30, NOW).map((u) => u.id)).toEqual(['stale', 'never'])
    expect(overdueReviewSubjects(roster, stamps, 'me', 14, NOW).map((u) => u.id)).toEqual(['fresh', 'stale', 'never'])
  })

  it('respects the cadence boundary', () => {
    const stamps = [stamp('fresh', '2026-06-22T12:00:01Z')] // 30 days minus 1s — not overdue at 30
    expect(overdueReviewSubjects(roster, stamps, 'me', 30, NOW).map((u) => u.id)).toEqual(['stale', 'never'])
  })
})
