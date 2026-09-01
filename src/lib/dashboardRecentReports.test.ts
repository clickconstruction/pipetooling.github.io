import { describe, expect, it } from 'vitest'
import {
  formatReportRowTime,
  isDashboardRecentReportsRole,
  openedNotShownCount,
  recentReportsNewCount,
  reportRowState,
  visibleRecentReports,
  type RecentReportRow,
} from './dashboardRecentReports'

const row = (id: string): RecentReportRow => ({
  id,
  template_name: 'Daily',
  job_display_name: `Job ${id}`,
  created_at: '2026-07-17T12:00:00Z',
  created_by_name: 'Sam',
})

const reports = [row('a'), row('b'), row('c'), row('d')]
const none = new Set<string>()

describe('reportRowState', () => {
  it('maps read/done sets to states, done winning', () => {
    expect(reportRowState('a', none, none)).toBe('new')
    expect(reportRowState('a', new Set(['a']), none)).toBe('opened')
    expect(reportRowState('a', new Set(['a']), new Set(['a']))).toBe('done')
    expect(reportRowState('a', none, new Set(['a']))).toBe('done')
  })
})

describe('recentReportsNewCount', () => {
  it('counts only rows with no read state', () => {
    expect(recentReportsNewCount(reports, new Set(['a']), new Set(['b']))).toBe(2)
    expect(recentReportsNewCount(reports, none, none)).toBe(4)
  })
})

describe('visibleRecentReports', () => {
  it('always shows new rows, never done rows', () => {
    const ids = visibleRecentReports(reports, new Set(['b']), new Set(['c']), none, false).map((r) => r.id)
    expect(ids).toEqual(['a', 'd'])
  })

  it('keeps session-opened rows inline even with the toggle off', () => {
    const ids = visibleRecentReports(reports, new Set(['b']), none, new Set(['b']), false).map((r) => r.id)
    expect(ids).toEqual(['a', 'b', 'c', 'd'])
  })

  it('shows all opened rows when the toggle is on', () => {
    const ids = visibleRecentReports(reports, new Set(['a', 'b']), none, none, true).map((r) => r.id)
    expect(ids).toEqual(['a', 'b', 'c', 'd'])
  })

  it('done rows stay hidden even when the toggle is on', () => {
    const ids = visibleRecentReports(reports, new Set(['a']), new Set(['a']), new Set(['a']), true).map((r) => r.id)
    expect(ids).toEqual(['b', 'c', 'd'])
  })
})

describe('openedNotShownCount', () => {
  it('counts opened rows hidden behind the footer toggle', () => {
    expect(openedNotShownCount(reports, new Set(['a', 'b']), new Set(['b']), new Set(['a']))).toBe(0)
    expect(openedNotShownCount(reports, new Set(['a', 'b']), none, none)).toBe(2)
  })
})

describe('formatReportRowTime', () => {
  // 2026-08-07 19:04 Chicago (CDT, UTC-5) = 2026-08-08T00:04:38Z
  const createdIso = '2026-08-08T00:04:38Z'

  it('same Chicago day reads today', () => {
    const now = Date.parse('2026-08-08T01:00:00Z') // still Aug 7 evening in Chicago
    expect(formatReportRowTime(createdIso, now)).toEqual({ clock: '7:04 PM', day: 'today' })
  })

  it('next Chicago day reads yesterday', () => {
    const now = Date.parse('2026-08-08T17:00:00Z') // Aug 8 midday Chicago
    expect(formatReportRowTime(createdIso, now)).toEqual({ clock: '7:04 PM', day: 'yesterday' })
  })

  it('older same-year dates read month + day', () => {
    const now = Date.parse('2026-08-20T17:00:00Z')
    expect(formatReportRowTime(createdIso, now)).toEqual({ clock: '7:04 PM', day: 'Aug 7' })
  })

  it('cross-year dates carry the year', () => {
    const now = Date.parse('2027-02-01T17:00:00Z')
    expect(formatReportRowTime(createdIso, now)).toEqual({ clock: '7:04 PM', day: 'Aug 7, 2026' })
  })

  it('tolerates junk input', () => {
    expect(formatReportRowTime('not-a-date', Date.now())).toEqual({ clock: '', day: '' })
  })
})

describe('isDashboardRecentReportsRole', () => {
  it('admits office roles, primary, and superintendent', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent']) {
      expect(isDashboardRecentReportsRole(role)).toBe(true)
    }
  })

  it('excludes field roles, estimator, and null', () => {
    for (const role of ['subcontractor', 'helpers', 'estimator', null, undefined, '']) {
      expect(isDashboardRecentReportsRole(role)).toBe(false)
    }
  })
})
