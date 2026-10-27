import { describe, expect, it } from 'vitest'
import {
  compareOnTheClockNewestFirst,
  formatHoursShort,
  formatTeamWeekLabel,
  isLongSession,
  pendingRollup,
  pendingSessionAge,
  personWeekSummaryLine,
  sortPendingSessionsOldestFirst,
} from './myTeamApprovals'

describe('isLongSession', () => {
  it('flags only sessions past 12h', () => {
    expect(isLongSession(14.49)).toBe(true)
    expect(isLongSession(12.01)).toBe(true)
    expect(isLongSession(12)).toBe(false)
    expect(isLongSession(7.82)).toBe(false)
  })
})

describe('formatHoursShort', () => {
  it('keeps one decimal and trims .0', () => {
    expect(formatHoursShort(46.36)).toBe('46.4h')
    expect(formatHoursShort(8)).toBe('8h')
    expect(formatHoursShort(7.96)).toBe('8h')
    expect(formatHoursShort(0.25)).toBe('0.3h')
  })
})

describe('pendingRollup', () => {
  it('sums count and hours', () => {
    expect(pendingRollup([14.49, 7.82])).toEqual({ count: 2, totalHours: 22.31 })
    expect(pendingRollup([])).toEqual({ count: 0, totalHours: 0 })
  })
})

describe('formatTeamWeekLabel', () => {
  it('marks the current week and formats same-month ranges', () => {
    expect(formatTeamWeekLabel('2026-08-16', '2026-08-22', '2026-08-22')).toBe('This week · Aug 16–22')
    expect(formatTeamWeekLabel('2026-08-09', '2026-08-15', '2026-08-22')).toBe('Aug 9–15')
  })
  it('spans months', () => {
    expect(formatTeamWeekLabel('2026-08-30', '2026-09-05', '2026-08-22')).toBe('Aug 30 – Sep 5')
  })
})

describe('personWeekSummaryLine', () => {
  it('leads with the all-pending "your move" form', () => {
    expect(personWeekSummaryLine({ total: 46.36, active: 0, pending: 46.36, approved: 0, manual: 0 })).toBe(
      '46.4h this week — all waiting on you',
    )
  })
  it('lists only non-zero buckets', () => {
    expect(personWeekSummaryLine({ total: 38, active: 0, pending: 8, approved: 30, manual: 0 })).toBe(
      '38h this week — 30h approved · 8h pending',
    )
    expect(personWeekSummaryLine({ total: 40, active: 2.5, pending: 0, approved: 33, manual: 4.5 })).toBe(
      '40h this week — 33h approved · 4.5h manual · 2.5h on the clock now',
    )
  })
  it('handles empty weeks', () => {
    expect(personWeekSummaryLine({ total: 0, active: 0, pending: 0, approved: 0, manual: 0 })).toBe(
      'No hours this week yet',
    )
  })
})

describe('pending sessions, oldest first (punch list #184 sweep B)', () => {
  const s = (id: string, work_date: string, clocked_in_at: string) => ({ id, work_date, clocked_in_at })
  const rows = [
    s('mon-late', '2026-10-19', '2026-10-19T19:00:00Z'),
    s('wed', '2026-10-21', '2026-10-21T13:00:00Z'),
    s('mon-early', '2026-10-19', '2026-10-19T12:30:00Z'),
    s('fri', '2026-10-23', '2026-10-23T12:00:00Z'),
  ]

  it('the oldest work date leads, then the earliest clock-in that day; the input is not touched', () => {
    expect(sortPendingSessionsOldestFirst(rows).map((r) => r.id)).toEqual(['mon-early', 'mon-late', 'wed', 'fri'])
    expect(rows.map((r) => r.id)).toEqual(['mon-late', 'wed', 'mon-early', 'fri'])
  })

  it('the live strip keeps its own order, newest first', () => {
    expect([...rows].sort(compareOnTheClockNewestFirst).map((r) => r.id)).toEqual(['fri', 'wed', 'mon-late', 'mon-early'])
  })

  it('the age chip reads whole days from the work date on the HOURS_APPROVAL_AGE scale', () => {
    expect(pendingSessionAge('2026-10-26', '2026-10-26')).toEqual({ days: 0, state: 'fresh', label: 'today' })
    expect(pendingSessionAge('2026-10-24', '2026-10-26')).toEqual({ days: 2, state: 'fresh', label: '2 days waiting' })
    expect(pendingSessionAge('2026-10-23', '2026-10-26')).toEqual({ days: 3, state: 'amber', label: '3 days waiting' })
    expect(pendingSessionAge('2026-10-19', '2026-10-26')).toEqual({ days: 7, state: 'red', label: '7 days waiting' })
    expect(pendingSessionAge('', '2026-10-26')).toBeNull()
    expect(pendingSessionAge('not a date', '2026-10-26')).toBeNull()
  })
})
