import { describe, expect, it } from 'vitest'
import type { JobDetailClockSessionRow } from './fetchClockSessionsForJobLedger'
import {
  formatJobDetailModalDateFromYmd,
  formatJobDetailModalDateWithWeekdayFromYmd,
} from './formatJobDetailModalDateYmd'
import {
  computeJobDetailSessionGroups,
  formatJobDetailTotalHours,
} from './jobDetailSessionTotals'

function session(overrides: Partial<JobDetailClockSessionRow>): JobDetailClockSessionRow {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'u-1',
    clocked_in_at: null,
    clocked_out_at: null,
    work_date: null,
    notes: null,
    approved_at: null,
    rejected_at: null,
    users: { name: 'Michael A' },
    ...overrides,
  }
}

describe('computeJobDetailSessionGroups', () => {
  it('groups per person with summed closed hours, sorted by hours desc', () => {
    const groups = computeJobDetailSessionGroups([
      session({ clocked_in_at: '2026-07-31T13:56:00Z', clocked_out_at: '2026-07-31T21:43:00Z' }),
      session({ clocked_in_at: '2026-08-03T16:15:00Z', clocked_out_at: '2026-08-04T00:29:00Z' }),
      session({
        users: { name: 'Roxi' },
        user_id: 'u-2',
        clocked_in_at: '2026-08-03T16:00:00Z',
        clocked_out_at: '2026-08-03T18:00:00Z',
      }),
    ])
    expect(groups.map((g) => g.name)).toEqual(['Michael A', 'Roxi'])
    expect(groups[0]?.totalHours).toBeCloseTo(7.783 + 8.233, 2)
    expect(groups[0]?.sessions).toHaveLength(2)
    expect(groups[1]?.totalHours).toBeCloseTo(2, 5)
  })

  it('keeps rejected sessions in the rows but out of the totals; open sessions counted without hours', () => {
    const groups = computeJobDetailSessionGroups([
      session({
        clocked_in_at: '2026-08-03T16:00:00Z',
        clocked_out_at: '2026-08-03T20:00:00Z',
        rejected_at: '2026-08-04T00:00:00Z',
      }),
      session({ clocked_in_at: '2026-08-05T16:00:00Z' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.sessions).toHaveLength(2)
    expect(groups[0]).toMatchObject({ totalHours: 0, openCount: 1 })
  })

  it('falls back to user_id when the name is blank, ties broken alphabetically', () => {
    const groups = computeJobDetailSessionGroups([
      session({ users: { name: '  ' }, user_id: 'u-9' }),
      session({ users: null, user_id: 'u-2' }),
    ])
    expect(groups.map((g) => g.name)).toEqual(['u-2', 'u-9'])
  })

  it('formats hours with at most one decimal', () => {
    expect(formatJobDetailTotalHours(16.016)).toBe('16 h')
    expect(formatJobDetailTotalHours(7.7833)).toBe('7.8 h')
  })
})

describe('formatJobDetailModalDateWithWeekdayFromYmd', () => {
  it('prefixes the Chicago weekday onto the standard t-offset date', () => {
    const now = new Date('2026-08-10T18:00:00Z')
    expect(formatJobDetailModalDateWithWeekdayFromYmd('2026-07-31', now)).toBe(
      `Fri ${formatJobDetailModalDateFromYmd('2026-07-31', now)}`,
    )
    expect(formatJobDetailModalDateWithWeekdayFromYmd('2026-08-03', now)).toBe(
      `Mon ${formatJobDetailModalDateFromYmd('2026-08-03', now)}`,
    )
    expect(formatJobDetailModalDateWithWeekdayFromYmd('2026-08-10', now)).toBe(
      `Mon ${formatJobDetailModalDateFromYmd('2026-08-10', now)}`,
    )
  })

  it('returns null for invalid input, like the base formatter', () => {
    expect(formatJobDetailModalDateWithWeekdayFromYmd(null)).toBeNull()
    expect(formatJobDetailModalDateWithWeekdayFromYmd('not-a-date')).toBeNull()
  })
})
