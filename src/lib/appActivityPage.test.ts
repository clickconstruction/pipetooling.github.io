import { describe, expect, it } from 'vitest'
import {
  appActivityPageKey,
  buildPersonActivityDetail,
  formatAppActivityPageLabel,
} from './appActivityPage'

describe('appActivityPageKey', () => {
  it('uses the first path segment plus the tab param', () => {
    expect(appActivityPageKey('/bids', '?tab=pricing&bidId=abc')).toBe('bids:pricing')
    expect(appActivityPageKey('/people', '?tab=pay_stubs')).toBe('people:pay_stubs')
    expect(appActivityPageKey('/dashboard', '')).toBe('dashboard')
  })

  it('ignores deeper path segments and sanitizes weird input', () => {
    expect(appActivityPageKey('/jobs/123/detail', '')).toBe('jobs')
    expect(appActivityPageKey('/Bids', '?tab=Pricing Review!')).toBe('bids:pricingreview')
    expect(appActivityPageKey('/', '')).toBe('home')
    expect(appActivityPageKey('', '')).toBe('home')
  })
})

describe('formatAppActivityPageLabel', () => {
  it('prettifies page and tab segments', () => {
    expect(formatAppActivityPageLabel('bids:pricing')).toBe('Bids · Pricing')
    expect(formatAppActivityPageLabel('people:pay_stubs')).toBe('People · Pay Stubs')
    expect(formatAppActivityPageLabel('schedule-dispatch')).toBe('Schedule Dispatch')
    expect(formatAppActivityPageLabel('dashboard')).toBe('Dashboard')
  })
})

describe('buildPersonActivityDetail', () => {
  it('merges daily totals with sparse page rows, newest day first', () => {
    const detail = buildPersonActivityDetail(
      [
        { activity_date: '2026-07-01', active_seconds: 3600, first_seen_at: 'a', last_seen_at: 'b' },
        { activity_date: '2026-07-02', active_seconds: 1800, first_seen_at: 'c', last_seen_at: 'd' },
      ],
      [
        { activity_date: '2026-07-02', page: 'bids:pricing', active_seconds: 1200 },
        { activity_date: '2026-07-02', page: 'dashboard', active_seconds: 600 },
      ],
    )
    expect(detail.days.map((d) => d.date)).toEqual(['2026-07-02', '2026-07-01'])
    expect(detail.days[0]?.pages).toEqual([
      { page: 'bids:pricing', seconds: 1200 },
      { page: 'dashboard', seconds: 600 },
    ])
    expect(detail.days[1]?.pages).toEqual([]) // historical day with no page data
    expect(detail.totalSeconds).toBe(5400)
  })

  it('sums page totals across the window, largest first', () => {
    const detail = buildPersonActivityDetail(
      [
        { activity_date: '2026-07-01', active_seconds: 900, first_seen_at: null, last_seen_at: null },
        { activity_date: '2026-07-02', active_seconds: 900, first_seen_at: null, last_seen_at: null },
      ],
      [
        { activity_date: '2026-07-01', page: 'dashboard', active_seconds: 300 },
        { activity_date: '2026-07-02', page: 'dashboard', active_seconds: 300 },
        { activity_date: '2026-07-02', page: 'bids:pricing', active_seconds: 900 },
      ],
    )
    expect(detail.pageTotals).toEqual([
      { page: 'bids:pricing', seconds: 900 },
      { page: 'dashboard', seconds: 600 },
    ])
  })

  it('handles empty inputs', () => {
    expect(buildPersonActivityDetail([], [])).toEqual({ days: [], pageTotals: [], totalSeconds: 0 })
  })
})
