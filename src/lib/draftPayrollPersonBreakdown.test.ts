import { describe, expect, it } from 'vitest'
import { sumPendingClockHoursByDay } from './draftPayrollPersonBreakdown'

describe('sumPendingClockHoursByDay', () => {
  it('sums closed session durations per work_date', () => {
    const byDay = sumPendingClockHoursByDay([
      { work_date: '2026-07-02', clocked_in_at: '2026-07-02T13:00:00Z', clocked_out_at: '2026-07-02T15:00:00Z' },
      { work_date: '2026-07-02', clocked_in_at: '2026-07-02T16:00:00Z', clocked_out_at: '2026-07-02T16:30:00Z' },
      { work_date: '2026-07-01', clocked_in_at: '2026-07-01T13:00:00Z', clocked_out_at: '2026-07-01T14:15:00Z' },
    ])
    expect(byDay['2026-07-02']).toBeCloseTo(2.5)
    expect(byDay['2026-07-01']).toBeCloseTo(1.25)
  })

  it('skips open sessions (no clock-out)', () => {
    const byDay = sumPendingClockHoursByDay([
      { work_date: '2026-07-02', clocked_in_at: '2026-07-02T13:00:00Z', clocked_out_at: null },
      { work_date: '2026-07-02', clocked_in_at: '2026-07-02T15:00:00Z', clocked_out_at: '2026-07-02T16:00:00Z' },
    ])
    expect(byDay['2026-07-02']).toBeCloseTo(1)
  })

  it('skips zero/negative and unparseable durations', () => {
    const byDay = sumPendingClockHoursByDay([
      { work_date: '2026-07-02', clocked_in_at: '2026-07-02T15:00:00Z', clocked_out_at: '2026-07-02T15:00:00Z' },
      { work_date: '2026-07-02', clocked_in_at: '2026-07-02T16:00:00Z', clocked_out_at: '2026-07-02T15:00:00Z' },
      { work_date: '2026-07-02', clocked_in_at: 'not-a-date', clocked_out_at: '2026-07-02T15:00:00Z' },
    ])
    expect(byDay).toEqual({})
  })

  it('returns an empty map for no sessions', () => {
    expect(sumPendingClockHoursByDay([])).toEqual({})
  })

  it('keys strictly by work_date, not by the timestamp calendar day', () => {
    // A session crossing midnight stays on its assigned work_date.
    const byDay = sumPendingClockHoursByDay([
      { work_date: '2026-07-01', clocked_in_at: '2026-07-01T23:00:00Z', clocked_out_at: '2026-07-02T01:00:00Z' },
    ])
    expect(byDay).toEqual({ '2026-07-01': 2 })
  })
})
