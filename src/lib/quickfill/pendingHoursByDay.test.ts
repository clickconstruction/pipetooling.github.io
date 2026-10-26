import { describe, expect, it } from 'vitest'
import { buildPendingHoursByDay, closedSessionDurationHours } from './pendingHoursByDay'

const s = (work_date: string, hours: number, open = false) => ({
  work_date,
  clocked_in_at: `${work_date}T13:00:00Z`,
  clocked_out_at: open ? null : new Date(Date.parse(`${work_date}T13:00:00Z`) + hours * 3_600_000).toISOString(),
})

describe('buildPendingHoursByDay (punch list #184 sweep B)', () => {
  it('one row per work date, OLDEST first, with the count, the closed hours and the HOURS_APPROVAL_AGE state', () => {
    const rows = buildPendingHoursByDay(
      [s('2026-10-25', 8), s('2026-10-18', 4), s('2026-10-25', 2), s('2026-10-22', 6), s('2026-10-26', 1, true)],
      '2026-10-26',
    )
    expect(rows.map((r) => [r.workDate, r.count, r.hours, r.ageDays, r.state])).toEqual([
      ['2026-10-18', 1, 4, 8, 'red'],
      ['2026-10-22', 1, 6, 4, 'amber'],
      ['2026-10-25', 2, 10, 1, 'fresh'],
      ['2026-10-26', 1, 0, 0, 'fresh'],
    ])
  })

  it('an open session counts but adds no hours; a bad date is fresh with no age', () => {
    const rows = buildPendingHoursByDay([{ work_date: 'garbage', clocked_in_at: '2026-10-26T13:00:00Z', clocked_out_at: null }], '2026-10-26')
    expect(rows).toEqual([{ workDate: 'garbage', count: 1, hours: 0, ageDays: null, state: 'fresh' }])
    expect(buildPendingHoursByDay([], '2026-10-26')).toEqual([])
  })

  it('closedSessionDurationHours is never negative', () => {
    expect(closedSessionDurationHours('2026-10-26T13:00:00Z', '2026-10-26T15:30:00Z')).toBe(2.5)
    expect(closedSessionDurationHours('2026-10-26T15:00:00Z', '2026-10-26T13:00:00Z')).toBe(0)
  })
})
