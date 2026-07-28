import { describe, expect, it } from 'vitest'
import {
  buildJobCalendarModel,
  jobCalendarAddMonths,
  jobCalendarMonthGrid,
  jobCalendarMonthLabel,
  type JobCalendarBlockInput,
  type JobCalendarSessionInput,
} from './jobCalendarModal'

const TODAY = '2026-07-28'

function block(over: Partial<JobCalendarBlockInput> & { id: string }): JobCalendarBlockInput {
  return {
    assignee_user_id: 'u1',
    work_date: '2026-07-31',
    time_start: '09:30:00',
    time_end: '11:00:00',
    note: null,
    shared_block_group_id: null,
    users: { name: 'Abraham' },
    ...over,
  }
}

function session(over: Partial<JobCalendarSessionInput>): JobCalendarSessionInput {
  return {
    work_date: '2026-07-14',
    clocked_out_at: '2026-07-14T20:00:00Z',
    approved_at: '2026-07-15T00:00:00Z',
    rejected_at: null,
    ...over,
  }
}

describe('buildJobCalendarModel', () => {
  it('handles the empty job', () => {
    const m = buildJobCalendarModel([], [], TODAY)
    expect(m.people).toEqual([])
    expect(m.upcoming).toEqual([])
    expect(m.past).toEqual([])
    expect(m.summary).toEqual({ dayCount: 0, peopleCount: 0, firstYmd: null, lastYmd: null, next: null })
    expect(m.initialMonth).toEqual({ year: 2026, month: 7 })
  })

  it('assigns name-sorted stable person colors', () => {
    const m = buildJobCalendarModel(
      [
        block({ id: 'b1', assignee_user_id: 'u2', users: { name: 'Darren' } }),
        block({ id: 'b2', assignee_user_id: 'u1', users: { name: 'Abraham' } }),
        block({ id: 'b3', assignee_user_id: 'u3', users: { name: null } }),
      ],
      [],
      TODAY,
    )
    expect(m.people.map((p) => [p.name, p.colorIndex])).toEqual([
      ['Abraham', 0],
      ['Darren', 1],
      ['Unknown', 2],
    ])
  })

  it('merges shared block groups into one appointment with both people', () => {
    const m = buildJobCalendarModel(
      [
        block({ id: 'b1', assignee_user_id: 'u1', shared_block_group_id: 'g1', note: 'bring the camera' }),
        block({ id: 'b2', assignee_user_id: 'u2', users: { name: 'Darren' }, shared_block_group_id: 'g1' }),
        block({ id: 'b3', assignee_user_id: 'u1', work_date: '2026-08-01' }),
      ],
      [],
      TODAY,
    )
    expect(m.upcoming).toHaveLength(2)
    const shared = m.upcoming[0]!
    expect(shared.people.map((p) => p.name)).toEqual(['Abraham', 'Darren'])
    expect(shared.note).toBe('bring the camera')
    expect(m.upcoming[1]!.people.map((p) => p.name)).toEqual(['Abraham'])
  })

  it('splits upcoming (today counts, soonest first) from past (most recent first)', () => {
    const m = buildJobCalendarModel(
      [
        block({ id: 'b1', work_date: '2026-07-14' }),
        block({ id: 'b2', work_date: '2026-07-20' }),
        block({ id: 'b3', work_date: TODAY }),
        block({ id: 'b4', work_date: '2026-08-02' }),
      ],
      [],
      TODAY,
    )
    expect(m.upcoming.map((a) => a.ymd)).toEqual([TODAY, '2026-08-02'])
    expect(m.past.map((a) => a.ymd)).toEqual(['2026-07-20', '2026-07-14'])
    expect(m.summary.next?.ymd).toBe(TODAY)
    expect(m.summary.dayCount).toBe(4)
    expect(m.summary.firstYmd).toBe('2026-07-14')
    expect(m.summary.lastYmd).toBe('2026-08-02')
  })

  it('orders same-day appointments by start time', () => {
    const m = buildJobCalendarModel(
      [
        block({ id: 'b1', time_start: '13:00:00' }),
        block({ id: 'b2', time_start: '08:00:00' }),
      ],
      [],
      TODAY,
    )
    expect(m.upcoming.map((a) => a.timeStart)).toEqual(['08:00:00', '13:00:00'])
  })

  it('collects unique person color indexes per scheduled day', () => {
    const m = buildJobCalendarModel(
      [
        block({ id: 'b1', assignee_user_id: 'u1' }),
        block({ id: 'b2', assignee_user_id: 'u2', users: { name: 'Darren' }, time_start: '13:00:00' }),
        block({ id: 'b3', assignee_user_id: 'u1', time_start: '15:00:00' }),
      ],
      [],
      TODAY,
    )
    expect(m.scheduledColorIdxByYmd['2026-07-31']).toEqual([0, 1])
  })

  it('marks worked days only for approved, closed, unrejected sessions', () => {
    const m = buildJobCalendarModel(
      [block({ id: 'b1' })],
      [
        session({}),
        session({ work_date: '2026-07-15', approved_at: null }),
        session({ work_date: '2026-07-16', clocked_out_at: null }),
        session({ work_date: '2026-07-17', rejected_at: '2026-07-18T00:00:00Z' }),
        session({ work_date: null }),
      ],
      TODAY,
    )
    expect([...m.workedYmds]).toEqual(['2026-07-14'])
  })

  it('opens on the month of the next upcoming, else the latest appointment', () => {
    const withUpcoming = buildJobCalendarModel([block({ id: 'b1', work_date: '2026-09-02' })], [], TODAY)
    expect(withUpcoming.initialMonth).toEqual({ year: 2026, month: 9 })
    const pastOnly = buildJobCalendarModel([block({ id: 'b1', work_date: '2026-05-10' })], [], TODAY)
    expect(pastOnly.initialMonth).toEqual({ year: 2026, month: 5 })
  })
})

describe('jobCalendarMonthGrid', () => {
  it('covers July 2026 in Sunday-start weeks', () => {
    const weeks = jobCalendarMonthGrid(2026, 7)
    // July 1, 2026 is a Wednesday → first row starts Sun Jun 28.
    expect(weeks[0]![0]).toEqual({ ymd: '2026-06-28', inMonth: false })
    expect(weeks[0]![3]).toEqual({ ymd: '2026-07-01', inMonth: true })
    const last = weeks[weeks.length - 1]!
    expect(last.some((d) => d.ymd === '2026-07-31' && d.inMonth)).toBe(true)
    for (const w of weeks) expect(w).toHaveLength(7)
  })

  it('handles a month starting on Sunday without a leading spill row', () => {
    // Feb 2026 starts Sunday Feb 1.
    const weeks = jobCalendarMonthGrid(2026, 2)
    expect(weeks[0]![0]).toEqual({ ymd: '2026-02-01', inMonth: true })
    expect(weeks).toHaveLength(4)
  })
})

describe('jobCalendarAddMonths / jobCalendarMonthLabel', () => {
  it('wraps year boundaries in both directions', () => {
    expect(jobCalendarAddMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
    expect(jobCalendarAddMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
    expect(jobCalendarAddMonths(2026, 7, -19)).toEqual({ year: 2024, month: 12 })
  })

  it('labels months', () => {
    expect(jobCalendarMonthLabel(2026, 7)).toBe('July 2026')
  })
})
