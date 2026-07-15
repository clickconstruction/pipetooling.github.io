import { describe, expect, it } from 'vitest'
import { firstLastClockByDay, sumPendingClockHoursByDay } from './draftPayrollPersonBreakdown'

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

describe('firstLastClockByDay', () => {
  it('picks earliest clock-in and latest clock-out per work_date, order-independent', () => {
    const byDay = firstLastClockByDay([
      { work_date: '2026-07-02', clocked_in_at: '2026-07-02T18:00:00Z', clocked_out_at: '2026-07-02T22:00:00Z' },
      { work_date: '2026-07-02', clocked_in_at: '2026-07-02T13:05:00Z', clocked_out_at: '2026-07-02T17:00:00Z' },
    ])
    expect(byDay['2026-07-02']).toEqual({
      firstIn: '2026-07-02T13:05:00Z',
      lastOut: '2026-07-02T22:00:00Z',
    })
  })

  it('leaves lastOut null when the only session is still open', () => {
    const byDay = firstLastClockByDay([
      { work_date: '2026-07-02', clocked_in_at: '2026-07-02T13:05:00Z', clocked_out_at: null },
    ])
    expect(byDay['2026-07-02']).toEqual({ firstIn: '2026-07-02T13:05:00Z', lastOut: null })
  })

  it('keeps a real clock-out even when a later session is still open', () => {
    const byDay = firstLastClockByDay([
      { work_date: '2026-07-02', clocked_in_at: '2026-07-02T13:00:00Z', clocked_out_at: '2026-07-02T15:00:00Z' },
      { work_date: '2026-07-02', clocked_in_at: '2026-07-02T16:00:00Z', clocked_out_at: null },
    ])
    expect(byDay['2026-07-02']).toEqual({ firstIn: '2026-07-02T13:00:00Z', lastOut: '2026-07-02T15:00:00Z' })
  })

  it('skips sessions with a missing/unparseable clock-in', () => {
    const byDay = firstLastClockByDay([
      { work_date: '2026-07-02', clocked_in_at: '', clocked_out_at: '2026-07-02T15:00:00Z' },
      { work_date: '2026-07-02', clocked_in_at: 'not-a-date', clocked_out_at: '2026-07-02T16:00:00Z' },
    ])
    expect(byDay).toEqual({})
  })

  it('returns an empty map for no sessions', () => {
    expect(firstLastClockByDay([])).toEqual({})
  })
})
