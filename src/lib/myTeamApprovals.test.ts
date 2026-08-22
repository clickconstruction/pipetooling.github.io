import { describe, expect, it } from 'vitest'
import {
  formatHoursShort,
  formatTeamWeekLabel,
  isLongSession,
  pendingRollup,
  personWeekSummaryLine,
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
