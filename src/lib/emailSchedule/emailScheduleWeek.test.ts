import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { describe, expect, it } from 'vitest'
import {
  addDaysYmd,
  buildMyEmailWeekGrid,
  currentWeekDays,
  dowForYmd,
  formatMinutes,
  parseHhMm,
} from './emailScheduleWeek'

// 2026-08-03 is a Monday.
const MONDAY = '2026-08-03'

describe('time helpers', () => {
  it('parses HH:MM and formats 12h labels', () => {
    expect(parseHhMm('06:30')).toBe(390)
    expect(parseHhMm('00:00')).toBe(0)
    expect(parseHhMm('23:59')).toBe(23 * 60 + 59)
    expect(parseHhMm('7:05')).toBe(425)
    expect(parseHhMm('nope')).toBeNull()
    expect(parseHhMm('25:00')).toBeNull()
    expect(formatMinutes(390)).toBe('6:30 AM')
    expect(formatMinutes(0)).toBe('12:00 AM')
    expect(formatMinutes(12 * 60)).toBe('12:00 PM')
    expect(formatMinutes(19 * 60 + 5)).toBe('7:05 PM')
  })
  it('dow and day math', () => {
    expect(dowForYmd(MONDAY)).toBe(1)
    expect(dowForYmd('2026-08-02')).toBe(0) // Sunday
    expect(addDaysYmd(MONDAY, 6)).toBe('2026-08-09')
    expect(addDaysYmd('2026-08-01', -1)).toBe('2026-07-31') // month boundary
  })
})

describe('currentWeekDays', () => {
  it('returns Monday-first week containing today', () => {
    const days = currentWeekDays('2026-08-05') // a Wednesday
    expect(days[0]).toEqual({ ymd: '2026-08-03', dow: 1 })
    expect(days[6]).toEqual({ ymd: '2026-08-09', dow: 0 })
  })
  it('a Sunday belongs to the week that STARTED the prior Monday', () => {
    const days = currentWeekDays('2026-08-09')
    expect(days[0]?.ymd).toBe('2026-08-03')
    expect(days[6]?.ymd).toBe('2026-08-09')
  })
})

describe('buildMyEmailWeekGrid', () => {
  const weekly = [
    {
      name: 'Morning recap',
      enabled: true,
      time_local: '06:30',
      days_of_week: [1, 2, 3, 4, 5], // Mon–Fri (0=Sun convention)
      timezone: APP_CALENDAR_TZ,
      include_costs: false,
      activity_scope: 'calendar_yesterday',
    },
  ]

  it('expands weekly digests onto their weekdays, Monday-first', () => {
    const grid = buildMyEmailWeekGrid({ weekly }, [], MONDAY)
    expect(grid.map((d) => d.entries.length)).toEqual([1, 1, 1, 1, 1, 0, 0])
    expect(grid[0]?.isToday).toBe(true)
    expect(grid[0]?.entries[0]?.timeLabel).toBe('6:30 AM')
    expect(grid[5]?.label).toBe('Sat')
    expect(grid[6]?.label).toBe('Sun')
  })

  it('places one-offs on their exact day and sorts by time within the day', () => {
    const grid = buildMyEmailWeekGrid({ weekly }, [
      { stream: 'billed_report', detail: 'from Malachi', ymd: MONDAY, minutes: 7 * 60 },
      { stream: 'schedule_day', detail: 'for Aug 5', ymd: '2026-08-05', minutes: 6 * 60 + 45 },
      { stream: 'billed_report', detail: 'next week — not shown', ymd: '2026-08-10', minutes: 7 * 60 },
    ], MONDAY)
    expect(grid[0]?.entries.map((e) => e.label)).toEqual(['Job report digest', 'Billed report'])
    expect(grid[2]?.entries.map((e) => e.timeLabel)).toEqual(['6:30 AM', '6:45 AM'])
    const allLabels = grid.flatMap((d) => d.entries.map((e) => e.detail))
    expect(allLabels).not.toContain('next week — not shown')
  })

  it('disabled schedules render muted with a (paused) tag, not hidden', () => {
    const grid = buildMyEmailWeekGrid(
      { weekly: [{ ...weekly[0]!, enabled: false }] },
      [],
      MONDAY,
    )
    expect(grid[0]?.entries[0]?.muted).toBe(true)
    expect(grid[0]?.entries[0]?.detail).toContain('(paused)')
  })
})
