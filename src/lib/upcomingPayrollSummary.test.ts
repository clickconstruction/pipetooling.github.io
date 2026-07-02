import { describe, expect, it } from 'vitest'
import {
  buildUpcomingPayrollSummary,
  payWeekStartYmd,
  upcomingPayrollFetchStartYmd,
  upcomingWeekDayBreakdown,
  type UpcomingClockSessionRow,
} from './upcomingPayrollSummary'

// 2026-06-28 is a Sunday; 2026-07-02 (today in these tests) is a Thursday.
const TODAY = '2026-07-02'
const NOW_MS = new Date('2026-07-02T18:00:00Z').getTime()

function session(userId: string, workDate: string, hours: number): UpcomingClockSessionRow {
  const inAt = `${workDate}T13:00:00Z`
  const outAt = new Date(new Date(inAt).getTime() + hours * 3_600_000).toISOString()
  return { user_id: userId, work_date: workDate, clocked_in_at: inAt, clocked_out_at: outAt }
}

describe('payWeekStartYmd', () => {
  it('returns the local Sunday of the week, including for Sunday itself', () => {
    expect(payWeekStartYmd('2026-07-02')).toBe('2026-06-28') // Thu -> Sun
    expect(payWeekStartYmd('2026-06-28')).toBe('2026-06-28') // Sun -> itself
    expect(payWeekStartYmd('2026-07-04')).toBe('2026-06-28') // Sat -> same week
  })
})

describe('upcomingPayrollFetchStartYmd', () => {
  it('uses the week after each last stub end and takes the minimum', () => {
    expect(
      upcomingPayrollFetchStartYmd({
        personNames: ['A', 'B'],
        lastStubEndByPerson: { A: '2026-06-20', B: '2026-06-27' }, // Sats -> next weeks 6/21, 6/28
        todayYmd: TODAY,
      }),
    ).toBe('2026-06-21')
  })

  it('caps stub-less people at capWeeks back from the current week', () => {
    expect(
      upcomingPayrollFetchStartYmd({
        personNames: ['A'],
        lastStubEndByPerson: {},
        todayYmd: TODAY,
        capWeeksForStubless: 2,
      }),
    ).toBe('2026-06-14')
  })
})

describe('buildUpcomingPayrollSummary', () => {
  const base = {
    personNames: ['Alice'],
    userIdByPersonName: { Alice: 'u1' },
    hourlyWageByPersonName: { Alice: 20 },
    todayYmd: TODAY,
    nowMs: NOW_MS,
  }

  it('counts uncovered weeks with clock time since the last stub', () => {
    // Last stub through Sat 6/20 -> candidate weeks 6/21 and 6/28 (current).
    const out = buildUpcomingPayrollSummary({
      ...base,
      stubsByPerson: { Alice: [{ period_start: '2026-06-14', period_end: '2026-06-20' }] },
      sessions: [session('u1', '2026-06-23', 10), session('u1', '2026-06-30', 5)],
    })
    expect(out.personWeekCount).toBe(2)
    expect(out.estimatedGrossDollars).toBeCloseTo(15 * 20)
    expect(out.lines).toHaveLength(2)
    expect(out.lines[0]).toMatchObject({ personName: 'Alice', weekStartYmd: '2026-06-21', weekEndYmd: '2026-06-27' })
    expect(out.lines[0]?.hours).toBeCloseTo(10)
    expect(out.lines[0]?.estimatedGrossDollars).toBeCloseTo(200)
    expect(out.lines[1]).toMatchObject({ personName: 'Alice', weekStartYmd: '2026-06-28', weekEndYmd: '2026-07-04' })
  })

  it('suppresses weeks any stub overlaps, even partially', () => {
    const out = buildUpcomingPayrollSummary({
      ...base,
      // Odd-length stub poking one day into the 6/21 week suppresses it.
      stubsByPerson: { Alice: [{ period_start: '2026-06-14', period_end: '2026-06-21' }] },
      sessions: [session('u1', '2026-06-23', 10)],
    })
    expect(out.personWeekCount).toBe(0)
  })

  it('skips zero-hour weeks and people with no roster user id', () => {
    const out = buildUpcomingPayrollSummary({
      ...base,
      personNames: ['Alice', 'Ghost'],
      stubsByPerson: { Alice: [{ period_start: '2026-06-14', period_end: '2026-06-20' }] },
      sessions: [session('u1', '2026-06-30', 5)], // nothing in 6/21 week
    })
    expect(out.personWeekCount).toBe(1)
    expect(out.estimatedGrossDollars).toBeCloseTo(100)
  })

  it('clips open sessions at nowMs', () => {
    const out = buildUpcomingPayrollSummary({
      ...base,
      stubsByPerson: {},
      capWeeksForStubless: 1,
      sessions: [
        { user_id: 'u1', work_date: '2026-07-02', clocked_in_at: '2026-07-02T16:00:00Z', clocked_out_at: null },
      ],
    })
    expect(out.personWeekCount).toBe(1)
    expect(out.estimatedGrossDollars).toBeCloseTo(2 * 20) // 16:00 -> 18:00 = 2h
  })

  it('uses the stub-less cap window and counts multiple people independently', () => {
    const out = buildUpcomingPayrollSummary({
      ...base,
      personNames: ['Alice', 'Bob'],
      userIdByPersonName: { Alice: 'u1', Bob: 'u2' },
      hourlyWageByPersonName: { Alice: 20, Bob: 30 },
      stubsByPerson: {},
      capWeeksForStubless: 2,
      sessions: [
        session('u1', '2026-06-16', 8), // Alice, week 6/14 (inside 2-week cap)
        session('u2', '2026-06-30', 4), // Bob, current week
        session('u2', '2026-06-01', 40), // Bob, before the cap window -> ignored
      ],
    })
    expect(out.personWeekCount).toBe(2)
    expect(out.estimatedGrossDollars).toBeCloseTo(8 * 20 + 4 * 30)
  })

  it('sorts lines by person then week and totals derive from them', () => {
    const out = buildUpcomingPayrollSummary({
      ...base,
      personNames: ['Zed', 'Alice'],
      userIdByPersonName: { Alice: 'u1', Zed: 'u2' },
      hourlyWageByPersonName: { Alice: 20, Zed: 10 },
      stubsByPerson: {},
      capWeeksForStubless: 2,
      sessions: [
        session('u2', '2026-06-16', 2),
        session('u1', '2026-06-30', 3),
        session('u1', '2026-06-16', 1),
      ],
    })
    expect(out.lines.map((l) => `${l.personName}:${l.weekStartYmd}`)).toEqual([
      'Alice:2026-06-14',
      'Alice:2026-06-28',
      'Zed:2026-06-14',
    ])
    expect(out.personWeekCount).toBe(out.lines.length)
    expect(out.estimatedGrossDollars).toBeCloseTo(out.lines.reduce((s, l) => s + l.estimatedGrossDollars, 0))
  })

  it('breaks a user week down into per-day hours (upcomingWeekDayBreakdown)', () => {
    const days = upcomingWeekDayBreakdown({
      sessions: [
        session('u1', '2026-06-30', 3),
        session('u1', '2026-06-30', 2), // same day, second session -> summed
        session('u1', '2026-06-29', 4),
        session('u1', '2026-06-27', 8), // previous week -> excluded
        session('u2', '2026-06-30', 6), // other user -> excluded
        { user_id: 'u1', work_date: '2026-07-02', clocked_in_at: '2026-07-02T16:00:00Z', clocked_out_at: null }, // open -> clips at nowMs (2h)
      ],
      userId: 'u1',
      weekStartYmd: '2026-06-28',
      nowMs: NOW_MS,
    })
    expect(days).toEqual([
      { workDate: '2026-06-29', hours: expect.closeTo(4, 5) },
      { workDate: '2026-06-30', hours: expect.closeTo(5, 5) },
      { workDate: '2026-07-02', hours: expect.closeTo(2, 5) },
    ])
  })

  it('returns zeros for empty inputs', () => {
    const out = buildUpcomingPayrollSummary({
      ...base,
      personNames: [],
      stubsByPerson: {},
      sessions: [],
    })
    expect(out).toEqual({ personWeekCount: 0, estimatedGrossDollars: 0, lines: [] })
  })
})
