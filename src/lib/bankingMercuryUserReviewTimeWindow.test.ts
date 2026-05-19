import { describe, it, expect } from 'vitest'
import {
  filterMercuryTxByUserReviewTimeWindow,
  formatUserReviewTimeWindowRange,
  getUserReviewTimeWindowRange,
  mercuryTxCalendarDayKey,
  USER_REVIEW_TIME_WINDOW_DEFAULT,
  USER_REVIEW_TIME_WINDOW_OPTIONS,
  type TimeWindowMercuryTxRow,
} from './bankingMercuryUserReviewTimeWindow'

/**
 * Helper: "now" anchored to a known instant in America/Chicago.
 * 2026-05-17 is a Sunday, so this_week starts the same day.
 * `T18:00:00Z` is 1pm Chicago (CDT) → calendar day = 2026-05-17.
 */
const NOW_SUN_2026_05_17_18Z = Date.parse('2026-05-17T18:00:00Z')
/** 2026-05-13 is a Wednesday → 1pm Chicago. */
const NOW_WED_2026_05_13_18Z = Date.parse('2026-05-13T18:00:00Z')

function tx(id: string, postedAt: string | null, createdAt: string = postedAt ?? '2026-05-17T12:00:00Z'): TimeWindowMercuryTxRow {
  return { id, posted_at: postedAt, created_at: createdAt }
}

describe('USER_REVIEW_TIME_WINDOW_OPTIONS', () => {
  it('exposes the expected window keys in display order', () => {
    expect(USER_REVIEW_TIME_WINDOW_OPTIONS.map((o) => o.value)).toEqual([
      'this_week',
      'last_week',
      'last_2_weeks',
      'last_30_days',
      'last_60_days',
      'last_90_days',
      'all',
    ])
  })

  it('defaults to last_30_days', () => {
    expect(USER_REVIEW_TIME_WINDOW_DEFAULT).toBe('last_30_days')
    expect(USER_REVIEW_TIME_WINDOW_OPTIONS.some((o) => o.value === USER_REVIEW_TIME_WINDOW_DEFAULT)).toBe(true)
  })
})

describe('getUserReviewTimeWindowRange', () => {
  it('returns null for the all-time window', () => {
    expect(getUserReviewTimeWindowRange('all', NOW_SUN_2026_05_17_18Z)).toBeNull()
  })

  it('this_week from a Sunday spans Sun…Sat', () => {
    const r = getUserReviewTimeWindowRange('this_week', NOW_SUN_2026_05_17_18Z)
    expect(r).toEqual({ startYmd: '2026-05-17', endYmd: '2026-05-23' })
  })

  it('this_week from a midweek day still anchors on the preceding Sunday', () => {
    const r = getUserReviewTimeWindowRange('this_week', NOW_WED_2026_05_13_18Z)
    expect(r).toEqual({ startYmd: '2026-05-10', endYmd: '2026-05-16' })
  })

  it('last_week is the prior Sun-Sat block', () => {
    const r = getUserReviewTimeWindowRange('last_week', NOW_SUN_2026_05_17_18Z)
    expect(r).toEqual({ startYmd: '2026-05-10', endYmd: '2026-05-16' })
  })

  it('last_2_weeks is a trailing 14-day window inclusive of today', () => {
    const r = getUserReviewTimeWindowRange('last_2_weeks', NOW_SUN_2026_05_17_18Z)
    expect(r).toEqual({ startYmd: '2026-05-04', endYmd: '2026-05-17' })
  })

  it('last_30_days is a trailing 30-day window inclusive of today', () => {
    const r = getUserReviewTimeWindowRange('last_30_days', NOW_SUN_2026_05_17_18Z)
    expect(r).toEqual({ startYmd: '2026-04-18', endYmd: '2026-05-17' })
  })

  it('last_60_days is a trailing 60-day window inclusive of today', () => {
    const r = getUserReviewTimeWindowRange('last_60_days', NOW_SUN_2026_05_17_18Z)
    expect(r).toEqual({ startYmd: '2026-03-19', endYmd: '2026-05-17' })
  })

  it('last_90_days is a trailing 90-day window inclusive of today', () => {
    const r = getUserReviewTimeWindowRange('last_90_days', NOW_SUN_2026_05_17_18Z)
    expect(r).toEqual({ startYmd: '2026-02-17', endYmd: '2026-05-17' })
  })
})

describe('mercuryTxCalendarDayKey', () => {
  it('returns the Chicago calendar day for posted_at', () => {
    // 2026-05-17T04:00:00Z = 11pm 2026-05-16 in Chicago (CDT)
    expect(mercuryTxCalendarDayKey(tx('t1', '2026-05-17T04:00:00Z'))).toBe('2026-05-16')
  })

  it('falls back to created_at when posted_at is missing', () => {
    expect(mercuryTxCalendarDayKey(tx('t2', null, '2026-05-17T18:00:00Z'))).toBe('2026-05-17')
  })

  it('returns null when neither timestamp parses', () => {
    expect(mercuryTxCalendarDayKey({ id: 't3', posted_at: 'not-a-date', created_at: '' })).toBeNull()
  })
})

describe('filterMercuryTxByUserReviewTimeWindow', () => {
  const rows: TimeWindowMercuryTxRow[] = [
    tx('inWindow1', '2026-05-17T17:00:00Z'), // 12pm Chicago 2026-05-17 (today)
    tx('inWindow2', '2026-05-04T17:00:00Z'), // 2 weeks ago boundary
    tx('beforeWindow', '2026-05-03T17:00:00Z'), // just before 2-week window
    tx('afterToday', '2026-05-18T17:00:00Z'), // future relative to anchor
    tx('unparseable', 'not-a-date', 'also-bad'),
  ]

  it('returns input array unchanged for all-time', () => {
    const out = filterMercuryTxByUserReviewTimeWindow(rows, 'all', NOW_SUN_2026_05_17_18Z)
    expect(out).toBe(rows)
  })

  it('keeps only transactions inside the inclusive 2-week range', () => {
    const out = filterMercuryTxByUserReviewTimeWindow(rows, 'last_2_weeks', NOW_SUN_2026_05_17_18Z)
    expect(out.map((r) => r.id)).toEqual(['inWindow1', 'inWindow2'])
  })

  it('drops transactions with unparseable timestamps', () => {
    const out = filterMercuryTxByUserReviewTimeWindow(rows, 'last_30_days', NOW_SUN_2026_05_17_18Z)
    expect(out.some((r) => r.id === 'unparseable')).toBe(false)
  })

  it('this_week from Sunday excludes future days beyond Saturday', () => {
    const out = filterMercuryTxByUserReviewTimeWindow(
      [tx('a', '2026-05-17T15:00:00Z'), tx('b', '2026-05-23T15:00:00Z'), tx('c', '2026-05-24T15:00:00Z')],
      'this_week',
      NOW_SUN_2026_05_17_18Z,
    )
    expect(out.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('returns an empty array when nothing falls in the window', () => {
    const out = filterMercuryTxByUserReviewTimeWindow(
      [tx('x', '2025-01-01T12:00:00Z')],
      'last_30_days',
      NOW_SUN_2026_05_17_18Z,
    )
    expect(out).toEqual([])
  })
})

describe('formatUserReviewTimeWindowRange', () => {
  it('renders a short range label for finite windows', () => {
    expect(formatUserReviewTimeWindowRange('last_30_days', NOW_SUN_2026_05_17_18Z)).toBe('Apr 18 – May 17')
  })

  it('returns null for all-time', () => {
    expect(formatUserReviewTimeWindowRange('all', NOW_SUN_2026_05_17_18Z)).toBeNull()
  })
})
