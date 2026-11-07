import { describe, expect, it } from 'vitest'
import { clockOutTime, hoursThisWeek, isLastClockOutOfWeek, weekSheetSeenKey, weekSheetWords } from './weekSheet'
import type { YourWeekCard } from './weekSignal'

const WEEK = { start: '2026-11-01', end: '2026-11-07' }

describe('isLastClockOutOfWeek', () => {
  it('is the last when no block follows today in the pay week', () => {
    expect(isLastClockOutOfWeek({ todayYmd: '2026-11-04', week: WEEK, blockDays: ['2026-11-02', '2026-11-04'] })).toBe(true)
    expect(isLastClockOutOfWeek({ todayYmd: '2026-11-04', week: WEEK, blockDays: ['2026-11-04', '2026-11-05'] })).toBe(false)
    expect(isLastClockOutOfWeek({ todayYmd: '2026-11-06', week: WEEK, blockDays: ['2026-11-06', '2026-11-09'] })).toBe(true)
  })

  it('with no schedule this week it is Friday or Saturday, never a mid-week day off', () => {
    expect(isLastClockOutOfWeek({ todayYmd: '2026-11-04', week: WEEK, blockDays: [] })).toBe(false)
    expect(isLastClockOutOfWeek({ todayYmd: '2026-11-06', week: WEEK, blockDays: [] })).toBe(true)
    expect(isLastClockOutOfWeek({ todayYmd: '2026-11-07', week: WEEK, blockDays: ['2026-10-30'] })).toBe(true)
  })
})

describe('hoursThisWeek and clockOutTime', () => {
  it('counts the closed hours inside the pay week and reads the clock on the company calendar', () => {
    const hours = [
      { work_date: '2026-11-02', hours: 8.25 },
      { work_date: '2026-11-06', hours: 7.5 },
      { work_date: '2026-10-30', hours: 9 },
    ] as never
    expect(hoursThisWeek({ hours }, WEEK)).toBe(15.8)
    expect(clockOutTime('2026-11-06T23:31:00Z')).toBe('5:31 PM')
    expect(clockOutTime('nonsense')).toBe('')
  })
})

const card: YourWeekCard = { signal: 'jobs_without_callback', title: 'Your week', range: 'Nov 1 to Nov 7', kicker: 'Jobs without a callback', head: '29 of your last 30 jobs', sub: '', move: { tone: 'up', text: '▲ 5 jobs this week, none came back' }, bar: null, mark: '', note: '', dots: [], dashed: false }

describe('weekSheetWords', () => {
  it('says the clock-out, the week, the signal, the move and the customer’s words, then the weekend', () => {
    const w = weekSheetWords(
      card,
      { id: 'r', customerName: 'Dana Whitfield', score: 5, words: 'Marcus explained everything before he started and cleaned up after.', answeredAt: '2026-11-05T22:12:00Z', googlePressedAt: null, jobId: 'j', jobNumber: '1184', jobName: 'Water heater', jobAddress: '', seenAt: null },
      '2026-11-06T23:31:00Z',
      41.5,
      '2026-11-06',
      new Date('2026-11-06T23:31:00Z'),
    )
    expect(w.clockLine).toBe('Clocked out at 5:31 PM. 41.5 hours this week.')
    expect(w).toMatchObject({ kicker: 'Jobs without a callback', head: '29 of your last 30 jobs', closing: 'Have a good weekend', button: 'Have a good weekend' })
    expect(w.quote).toEqual({ stars: 5, words: 'Marcus explained everything before he started and cleaned up after.', who: 'Dana W. · water heater · yesterday' })
  })

  it('reads a mid-week last shift and no words', () => {
    const w = weekSheetWords(card, null, '2026-11-04T22:00:00Z', 1, '2026-11-04')
    expect(w.clockLine).toBe('Clocked out at 4:00 PM. 1 hour this week.')
    expect(w.quote).toBeNull()
    expect(w.closing).toBe('Have a good one')
    expect(weekSheetSeenKey('u1', '2026-11-01')).toBe('your_week_sheet_seen_u1_2026-11-01')
  })
})
