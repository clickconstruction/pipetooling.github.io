import { describe, expect, it } from 'vitest'
import { recentReportsUnreadCount, recentReportsVisibleRows, type RecentReportRow } from './dashboardRecentReports'

const row = (id: string): RecentReportRow => ({
  id,
  template_name: 'Daily',
  job_display_name: `Job ${id}`,
  created_at: '2026-07-17T12:00:00Z',
  created_by_name: 'Sam',
})

const reports = [row('a'), row('b'), row('c'), row('d')]

describe('recentReportsUnreadCount', () => {
  it('counts reports that are neither hidden nor read', () => {
    expect(recentReportsUnreadCount(reports, new Set(['a']), new Set(['b']))).toBe(2)
  })

  it('is zero when everything is read', () => {
    expect(recentReportsUnreadCount(reports, new Set(), new Set(['a', 'b', 'c', 'd']))).toBe(0)
  })

  it('does not double-count a report both hidden and read', () => {
    expect(recentReportsUnreadCount(reports, new Set(['a']), new Set(['a']))).toBe(3)
  })
})

describe('recentReportsVisibleRows', () => {
  it('never shows hidden rows, in either view', () => {
    expect(recentReportsVisibleRows(reports, new Set(['a']), new Set(), 'all', null).map((r) => r.id)).toEqual(['b', 'c', 'd'])
    expect(recentReportsVisibleRows(reports, new Set(['a']), new Set(), 'unread', null).map((r) => r.id)).toEqual(['b', 'c', 'd'])
  })

  it("in 'unread' view, drops read rows", () => {
    expect(recentReportsVisibleRows(reports, new Set(), new Set(['b']), 'unread', null).map((r) => r.id)).toEqual(['a', 'c', 'd'])
  })

  it("in 'unread' view, keeps a read row while it is expanded", () => {
    expect(recentReportsVisibleRows(reports, new Set(), new Set(['b']), 'unread', 'b').map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it("in 'all' view, shows read rows", () => {
    expect(recentReportsVisibleRows(reports, new Set(), new Set(['a', 'b']), 'all', null)).toHaveLength(4)
  })

  it('preserves input order', () => {
    expect(recentReportsVisibleRows(reports, new Set(), new Set(), 'unread', null).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})
