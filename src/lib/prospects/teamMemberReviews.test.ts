import { describe, expect, it } from 'vitest'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import {
  averageLatestRatings,
  currentReviewMonth,
  formatReviewMonthLabel,
  formatReviewMonthShort,
  formatTenure,
  hasMonthReview,
  latestReviewsByReviewer,
  monthlyRatingSeries,
  myLatestReview,
  nextUnratedIndex,
  orderUsersForRating,
  recentJobsByUser,
  subjectReviewHistory,
} from './teamMemberReviews'
import type { RecentJobRow, TeamMemberReviewRow } from './teamMemberReviews'

const review = (overrides: Partial<TeamMemberReviewRow>): TeamMemberReviewRow => ({
  id: 'r1',
  subject_user_id: 'subject',
  reviewer_user_id: 'reviewer',
  review_month: '2026-07-01',
  rating_ability: 80,
  rating_drive: 70,
  rating_integrity: 90,
  comment_ability: null,
  comment_drive: null,
  comment_integrity: null,
  ...overrides,
})

describe('orderUsersForRating', () => {
  it('orders by People → Users role sections, then name case-insensitively; unknown roles last', () => {
    const ordered = orderUsersForRating([
      { id: '1', name: 'zed', role: 'dev' },
      { id: '2', name: 'Amy', role: 'helpers' },
      { id: '3', name: 'bob', role: 'master_technician' },
      { id: '4', name: 'Ann', role: 'master_technician' },
      { id: '5', name: 'Mystery', role: 'not_a_role' },
      { id: '6', name: null, role: 'helpers' },
    ])
    expect(ordered.map((u) => u.id)).toEqual(['4', '3', '6', '2', '1', '5'])
  })
})

describe('currentReviewMonth', () => {
  it('returns the first of the month in the company zone', () => {
    expect(currentReviewMonth(APP_CALENDAR_TZ, new Date('2026-07-15T12:00:00Z'))).toBe('2026-07-01')
  })

  it('respects the zone across the month boundary (UTC already in August, company time still July)', () => {
    expect(currentReviewMonth(APP_CALENDAR_TZ, new Date('2026-08-01T03:00:00Z'))).toBe('2026-07-01')
    expect(currentReviewMonth('UTC', new Date('2026-08-01T03:00:00Z'))).toBe('2026-08-01')
  })
})

describe('formatReviewMonthLabel', () => {
  it('renders Month YYYY', () => {
    expect(formatReviewMonthLabel('2026-07-01')).toBe('July 2026')
    expect(formatReviewMonthLabel('2025-12-01')).toBe('December 2025')
  })
})

describe('latestReviewsByReviewer / myLatestReview', () => {
  const rows = [
    review({ id: 'a-jun', reviewer_user_id: 'alice', review_month: '2026-06-01', rating_ability: 50 }),
    review({ id: 'a-jul', reviewer_user_id: 'alice', review_month: '2026-07-01', rating_ability: 60 }),
    review({ id: 'b-may', reviewer_user_id: 'bob', review_month: '2026-05-01' }),
    review({ id: 'other-subject', subject_user_id: 'someone-else', reviewer_user_id: 'alice' }),
  ]

  it('keeps one newest row per reviewer for the subject, newest first', () => {
    const latest = latestReviewsByReviewer(rows, 'subject')
    expect(latest.map((r) => r.id)).toEqual(['a-jul', 'b-may'])
  })

  it('myLatestReview finds mine or returns null', () => {
    expect(myLatestReview(rows, 'subject', 'alice')?.id).toBe('a-jul')
    expect(myLatestReview(rows, 'subject', 'nobody')).toBeNull()
  })
})

describe('averageLatestRatings', () => {
  it('averages per dimension over rated values only, rounding to whole numbers', () => {
    const result = averageLatestRatings([
      review({ rating_ability: 80, rating_drive: null, rating_integrity: 91 }),
      review({ rating_ability: 71, rating_drive: 60, rating_integrity: null }),
    ])
    expect(result).toEqual({ ability: 76, drive: 60, integrity: 91, reviewerCount: 2 })
  })

  it('returns nulls and zero count for no reviews', () => {
    expect(averageLatestRatings([])).toEqual({ ability: null, drive: null, integrity: null, reviewerCount: 0 })
  })
})

describe('recentJobsByUser', () => {
  it('groups RPC rows per user preserving order', () => {
    const row = (user_id: string, job: string): RecentJobRow => ({ user_id, job_ledger_id: job, job_display: job, last_worked_date: '2026-07-01' })
    const map = recentJobsByUser([row('u1', 'j1'), row('u2', 'j2'), row('u1', 'j3')])
    expect(map.get('u1')?.map((r) => r.job_ledger_id)).toEqual(['j1', 'j3'])
    expect(map.get('u2')?.map((r) => r.job_ledger_id)).toEqual(['j2'])
  })
})

describe('hasMonthReview / nextUnratedIndex', () => {
  const roster = [
    { id: 'u1', name: 'A', role: 'dev' },
    { id: 'u2', name: 'B', role: 'dev' },
    { id: 'u3', name: 'C', role: 'dev' },
  ]
  const month = '2026-07-01'
  const mine = (subject: string) => review({ id: `me-${subject}`, subject_user_id: subject, reviewer_user_id: 'me', review_month: month })

  it('hasMonthReview matches subject+reviewer+month exactly', () => {
    expect(hasMonthReview([mine('u1')], 'u1', 'me', month)).toBe(true)
    expect(hasMonthReview([mine('u1')], 'u1', 'me', '2026-06-01')).toBe(false)
    expect(hasMonthReview([mine('u1')], 'u1', 'someone-else', month)).toBe(false)
    expect(hasMonthReview([mine('u1')], 'u2', 'me', month)).toBe(false)
  })

  it('nextUnratedIndex searches forward with wrap-around, skipping rated people', () => {
    expect(nextUnratedIndex(roster, [], 'me', month, 0)).toBe(1)
    expect(nextUnratedIndex(roster, [mine('u2')], 'me', month, 0)).toBe(2)
    expect(nextUnratedIndex(roster, [mine('u2'), mine('u3')], 'me', month, 1)).toBe(0)
    // Only the current card left unrated: wraps all the way back to it.
    expect(nextUnratedIndex(roster, [mine('u2'), mine('u3')], 'me', month, 0)).toBe(0)
  })

  it('returns null when everyone is rated this month', () => {
    expect(nextUnratedIndex(roster, [mine('u1'), mine('u2'), mine('u3')], 'me', month, 1)).toBeNull()
    // Other months and other reviewers don't count.
    expect(nextUnratedIndex(roster, [review({ subject_user_id: 'u1', reviewer_user_id: 'me', review_month: '2026-06-01' })], 'me', month, 0)).toBe(1)
  })
})

describe('formatTenure', () => {
  const now = new Date('2026-07-22T12:00:00Z')
  it('formats years and months', () => {
    expect(formatTenure('2024-03-10', now)).toBe('2 yr 4 mo')
    expect(formatTenure('2025-07-22', now)).toBe('1 yr')
    expect(formatTenure('2025-12-01', now)).toBe('7 mo')
    expect(formatTenure('2026-07-05', now)).toBe('under a month')
  })
  it('counts partial months conservatively (day-of-month not reached yet)', () => {
    expect(formatTenure('2025-07-23', now)).toBe('11 mo')
  })
  it('returns null for missing, malformed, or future dates', () => {
    expect(formatTenure(null, now)).toBeNull()
    expect(formatTenure('not-a-date', now)).toBeNull()
    expect(formatTenure('2027-01-01', now)).toBeNull()
  })
})

describe('monthlyRatingSeries', () => {
  it('averages per month across reviewers, oldest first', () => {
    const rows = [
      review({ id: '1', review_month: '2026-07-01', reviewer_user_id: 'a', rating_ability: 80, rating_drive: 60, rating_integrity: null }),
      review({ id: '2', review_month: '2026-07-01', reviewer_user_id: 'b', rating_ability: 71, rating_drive: null, rating_integrity: 90 }),
      review({ id: '3', review_month: '2026-05-01', reviewer_user_id: 'a', rating_ability: 40, rating_drive: 40, rating_integrity: 40 }),
      review({ id: 'other', subject_user_id: 'someone-else', review_month: '2026-06-01' }),
    ]
    expect(monthlyRatingSeries(rows, 'subject')).toEqual([
      { month: '2026-05-01', ability: 40, drive: 40, integrity: 40, reviewerCount: 1 },
      { month: '2026-07-01', ability: 76, drive: 60, integrity: 90, reviewerCount: 2 },
    ])
  })
  it('is empty for a subject with no reviews', () => {
    expect(monthlyRatingSeries([], 'subject')).toEqual([])
  })
})

describe('formatReviewMonthShort', () => {
  it('renders compact month labels', () => {
    expect(formatReviewMonthShort('2026-07-01')).toBe("Jul '26")
    expect(formatReviewMonthShort('2025-12-01')).toBe("Dec '25")
  })
})

describe('subjectReviewHistory', () => {
  it('returns the subject rows newest month first', () => {
    const rows = [
      review({ id: 'old', review_month: '2026-05-01' }),
      review({ id: 'new', review_month: '2026-07-01', reviewer_user_id: 'zoe' }),
      review({ id: 'other', subject_user_id: 'someone-else' }),
    ]
    expect(subjectReviewHistory(rows, 'subject').map((r) => r.id)).toEqual(['new', 'old'])
  })
})
