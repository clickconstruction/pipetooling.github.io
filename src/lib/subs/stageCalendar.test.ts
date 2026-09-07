import { describe, expect, it } from 'vitest'
import { calendarDays, calendarMonthTitle, calendarMonthsFor, workingDaysIn } from './stageCalendar'

const TODAY = '2026-09-07'

describe('calendarMonthsFor', () => {
  it('draws every month the window, pick and ask touch, in order, capped at three', () => {
    expect(calendarMonthsFor({ todayYmd: TODAY, window: { start: '2026-09-22', end: '2026-10-02' } })).toEqual(['2026-09', '2026-10'])
    expect(calendarMonthsFor({ todayYmd: TODAY, window: { start: '2026-09-22', end: '2026-09-30' }, ask: { start: '2026-10-05', end: '2026-10-09' } })).toEqual(['2026-09', '2026-10'])
    expect(calendarMonthsFor({ todayYmd: TODAY, window: { start: '2026-09-01', end: '2026-09-05' } })).toEqual(['2026-09'])
    expect(calendarMonthsFor({ todayYmd: TODAY, window: { start: '2026-11-20', end: '2027-02-10' } })).toEqual(['2026-11', '2026-12', '2027-01'])
    expect(calendarMonthsFor({ todayYmd: TODAY, window: null })).toEqual(['2026-09'])
  })
})

describe('calendarDays', () => {
  const input = {
    todayYmd: TODAY,
    window: { start: '2026-09-22', end: '2026-10-02' },
    ask: { start: '2026-09-29', end: '2026-10-10' },
    offDays: ['2026-09-24'],
    siblings: [{ start: '2026-09-08', end: '2026-09-19' }],
    siblingPicks: [{ start: '2026-09-09', end: '2026-09-10' }],
  }
  it('lays September 2026 out Monday-first with leading August days and flags each day', () => {
    const days = calendarDays('2026-09', input)
    // Sep 1 2026 is a Tuesday → one leading day (Mon Aug 31); 30 days → 5 rows = 35 cells.
    expect(days.length).toBe(35)
    expect(days[0]).toMatchObject({ ymd: '2026-08-31', inMonth: false, weekend: false, window: false, sibling: false })
    // October's grid starts with Sep 28–30 as dimmed context: no flags there, so Sep 29 is only marked once across the two months.
    expect(calendarDays('2026-10', input).find((d) => d.ymd === '2026-09-29')).toMatchObject({ inMonth: false, window: false, ask: false })
    expect(days[1]).toMatchObject({ ymd: '2026-09-01', inMonth: true })
    const by = new Map(days.map((d) => [d.ymd, d]))
    expect(by.get('2026-09-07')).toMatchObject({ today: true, window: false })
    expect(by.get('2026-09-22')).toMatchObject({ window: true, ask: false, passed: false })
    expect(by.get('2026-09-29')).toMatchObject({ window: true, ask: true })
    expect(by.get('2026-09-24')).toMatchObject({ window: true, off: true })
    expect(by.get('2026-09-09')).toMatchObject({ sibling: true, siblingPick: true, window: false })
    expect(by.get('2026-09-12')).toMatchObject({ weekend: true, sibling: true })
  })
  it('runs six rows when the month needs them and marks a passed window', () => {
    // Nov 2026 starts on a Sunday → six leading days + 30 = 36 cells → 42.
    expect(calendarDays('2026-11', { todayYmd: TODAY, window: null }).length).toBe(42)
    const passed = calendarDays('2026-09', { todayYmd: TODAY, window: { start: '2026-09-01', end: '2026-09-05' } })
    expect(passed.find((d) => d.ymd === '2026-09-03')).toMatchObject({ window: true, passed: true })
  })
})

describe('titles and counts', () => {
  it('names the month and counts working days', () => {
    expect(calendarMonthTitle('2026-09')).toBe('September 2026')
    expect(workingDaysIn({ start: '2026-09-22', end: '2026-10-02' })).toBe(9)
    expect(workingDaysIn({ start: '2026-09-05', end: '2026-09-06' })).toBe(0)
  })
})
