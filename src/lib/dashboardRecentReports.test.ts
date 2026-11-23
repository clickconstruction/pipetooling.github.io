import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from './plainWords'
import {
  RECENT_REPORTS_LIST_LIMIT,
  RECENT_REPORTS_OPENED_GLOSS,
  RECENT_REPORTS_WINDOW_DAYS,
  buildRecentReportsCard,
  formatReportRowTime,
  formatReportRowWhen,
  markedOpenedWords,
  recentReportsNewWords,
  recentReportsOpenedMoreWords,
  recentReportsWindowStartIso,
  reportsInWindow,
  isDashboardRecentReportsRole,
  readIdsWithOwnReports,
  PRIMARY_REPORTS_SCOPE_LINE,
  reportsScopeLine,
  type RecentReportRow,
} from './dashboardRecentReports'

const row = (id: string, over: Partial<RecentReportRow> = {}): RecentReportRow => ({
  id,
  template_name: 'Daily',
  job_display_name: `Job ${id}`,
  created_at: '2026-07-17T12:00:00Z',
  created_by_name: 'Sam',
  ...over,
})

describe('readIdsWithOwnReports (punch list #384)', () => {
  const mine = { ...row('a'), created_by_user_id: 'me' }
  const theirs = { ...row('b'), created_by_user_id: 'them' }
  const unknown = row('c')

  it('the viewer’s own report is never new to them, and nobody else’s changes', () => {
    const read = readIdsWithOwnReports(new Set(), [mine, theirs, unknown], 'me')
    expect([...read]).toEqual(['a'])
    // It reads as opened, so it waits in the Opened group with the rest and never counts as new.
    const card = buildRecentReportsCard([mine, theirs, unknown], read, new Set(), Date.parse('2026-07-18T12:00:00Z'))
    expect(card.fresh).toBe(2)
    expect(card.listed.map((r) => r.id)).toEqual(['b', 'c'])
    expect(card.opened.map((r) => r.id)).toEqual(['a'])
  })

  it('keeps what was read already and leaves the set it was given alone', () => {
    const given = new Set(['b'])
    const read = readIdsWithOwnReports(given, [mine, theirs], 'me')
    expect([...read].sort()).toEqual(['a', 'b'])
    expect([...given]).toEqual(['b'])
  })

  it('with no viewer, or a report with no author on the row, nothing is added', () => {
    expect(readIdsWithOwnReports(new Set(), [mine, unknown], null).size).toBe(0)
    expect(readIdsWithOwnReports(new Set(), [mine, unknown], undefined).size).toBe(0)
    expect([...readIdsWithOwnReports(new Set(), [unknown], 'me')]).toEqual([])
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

describe('reportsScopeLine (a primary reads their own jobs\' reports, 2026-11-19)', () => {
  it('a primary reads the line that says whose reports the list holds', () => {
    expect(reportsScopeLine('primary')).toBe(PRIMARY_REPORTS_SCOPE_LINE)
    expect(PRIMARY_REPORTS_SCOPE_LINE).toBe('You see reports on jobs where you are the account manager or the superintendent, and reports you wrote.')
  })

  it('every other role reads the list with no line', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'estimator', 'helpers', 'subcontractor', null, undefined, '']) {
      expect(reportsScopeLine(role)).toBeNull()
    }
  })

  it('the line is plain words', () => {
    expect(plainWordsFailures(PRIMARY_REPORTS_SCOPE_LINE)).toEqual([])
  })
})

describe('the card since punch list #426: one put-away state, a list that refills', () => {
  const NOW = Date.parse('2026-11-23T18:00:00Z')
  const hoursAgo = (h: number) => new Date(NOW - h * 60 * 60 * 1000).toISOString()
  /** `n` reports, newest first, an hour apart: r0 is the newest. */
  const filed = (n: number, startHoursAgo = 1) => Array.from({ length: n }, (_, i) => row(`r${i}`, { created_at: hoursAgo(startHoursAgo + i) }))
  const ids = (list: ReadonlyArray<{ id: string }>) => list.map((r) => r.id)

  it('the window is 14 days, and its start is the instant that many days back', () => {
    expect(RECENT_REPORTS_WINDOW_DAYS).toBe(14)
    expect(recentReportsWindowStartIso(NOW)).toBe('2026-11-09T18:00:00.000Z')
    const list = [row('in', { created_at: hoursAgo(24 * 13) }), row('edge', { created_at: '2026-11-09T18:00:00.000Z' }), row('out', { created_at: hoursAgo(24 * 15) }), row('junk', { created_at: 'not a date' })]
    expect(ids(reportsInWindow(list, NOW))).toEqual(['in', 'edge'])
  })

  it('lists eight new reports at a time and counts every new one, so a ninth is no longer lost', () => {
    const card = buildRecentReportsCard(filed(11), new Set(), new Set(), NOW)
    expect(RECENT_REPORTS_LIST_LIMIT).toBe(8)
    expect(ids(card.listed)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'])
    expect(card.fresh).toBe(11)
    expect(card.freshListed).toBe(8)
    expect(card.openedCount).toBe(0)
    expect(card.inWindow).toBe(11)
  })

  it('the list refills when a report is put away: the next new one comes up', () => {
    const card = buildRecentReportsCard(filed(11), new Set(['r0', 'r3']), new Set(), NOW)
    expect(ids(card.listed)).toEqual(['r1', 'r2', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9'])
    expect(card.fresh).toBe(9)
    expect(ids(card.opened)).toEqual(['r0', 'r3'])
  })

  it('a report opened in place this session stays in the list and is not counted as new', () => {
    const card = buildRecentReportsCard(filed(3), new Set(['r1']), new Set(['r1']), NOW)
    expect(ids(card.listed)).toEqual(['r0', 'r1', 'r2'])
    expect(card.fresh).toBe(2)
    expect(card.freshListed).toBe(2)
    expect(card.opened).toEqual([])
  })

  it('with every report put away the list is empty and Opened holds them, eight drawn at most', () => {
    const all = filed(10)
    const card = buildRecentReportsCard(all, new Set(ids(all)), new Set(), NOW)
    expect(card.listed).toEqual([])
    expect(card.fresh).toBe(0)
    expect(card.opened.length).toBe(8)
    expect(card.openedCount).toBe(10)
    expect(recentReportsOpenedMoreWords(card.opened.length, card.openedCount)).toBe('Showing the newest 8. View all has every report.')
    expect(recentReportsOpenedMoreWords(3, 3)).toBeNull()
  })

  it('a report older than the window is in neither place', () => {
    const card = buildRecentReportsCard([row('old', { created_at: hoursAgo(24 * 20) })], new Set(), new Set(), NOW)
    expect(card).toMatchObject({ listed: [], opened: [], fresh: 0, inWindow: 0 })
  })

  it('the day and the time read as one value', () => {
    expect(formatReportRowWhen('2026-11-22T19:02:00Z', NOW)).toBe('yesterday 1:02 PM')
    expect(formatReportRowWhen('2026-11-21T22:08:00Z', NOW)).toBe('Nov 21 4:08 PM')
    expect(formatReportRowWhen('junk', NOW)).toBe('')
  })

  it('the words of the foot and the toast', () => {
    expect(recentReportsNewWords(3)).toBe('3 new reports')
    expect(recentReportsNewWords(1)).toBe('1 new report')
    expect(recentReportsNewWords(0)).toBe('Every report here is opened.')
    expect(markedOpenedWords(['Okafor Gas Test'])).toBe('Marked opened: Okafor Gas Test.')
    expect(markedOpenedWords(['a', 'b', 'c'])).toBe('3 reports marked opened.')
    for (const words of [RECENT_REPORTS_OPENED_GLOSS, recentReportsNewWords(0), recentReportsOpenedMoreWords(8, 10) ?? '']) expect(plainWordsFailures(words), words).toEqual([])
  })
})

